import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema, ProgressNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

const schema = { type: 'object', properties: { value: { type: 'integer' } }, required: ['value'], additionalProperties: false };
const definitions = ['double', 'app', 'expected_error', 'crash', 'bad_output', 'slow', 'progress', 'bad_content', 'cyclic', 'wire_output', 'bad_details'].map(name => ({
  name, title: name, description: `Run ${name}`, page: name, inputSchema: schema, outputSchema: schema,
}));
const handlerSource = `
import { BusinessToolError } from '@yodaos-pkg/aiui-mcpkit/tools';
import { writeFileSync } from 'node:fs';
import { secret } from './secret-config.js';
const privateMarker = 'HANDLER_SOURCE_MUST_STAY_SERVER_ONLY';
export const handlers = {
  app: input => ({ content: [], structuredContent: input }),
  double: input => ({ content: [{ type: 'text', text: 'Doubled value' }], structuredContent: { value: input.value * 2 }, uiOnly: { privateMarker } }),
  expected_error: () => { throw new BusinessToolError('NOT_AVAILABLE', 'Try another item.', { reason: 'UI_ONLY_REASON' }); },
  crash: () => { throw new Error(secret); },
  bad_output: () => ({ content: [], structuredContent: { value: 'bad' } }),
  bad_content: () => ({ content: [{ type: 'invalid' }], structuredContent: { value: 1 } }),
  bad_details: () => { const details = {}; details.self = details; throw new BusinessToolError('BAD_DETAILS', 'Safe error message.', details); },
  wire_output: () => { const data = { value: 1 }; Object.defineProperty(data, 'toJSON', { value: () => ({ value: 'bad' }) }); return { content: [], structuredContent: data }; },
  cyclic: () => { const uiOnly = {}; uiOnly.self = uiOnly; return { content: [], structuredContent: { value: 1 }, uiOnly }; },
  slow: async (input, { signal }) => { writeFileSync(process.env.STARTED_FILE, 'started'); return new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { writeFileSync(process.env.ABORT_FILE, 'aborted'); reject(signal.reason); }, { once: true });
  }); },
  progress: async (input, context) => {
    for (let i = 0; i < 3; i++) { await new Promise(resolve => setTimeout(resolve, 100)); context.progress({ progress: i, total: 3 }); }
    return { content: [], structuredContent: input };
  },
};`;

async function writeDeclarations(source, tools) {
  await writeFile(join(source, 'app.json'), JSON.stringify({ pages: ['home', ...tools.map(tool => tool.page)] }));
  for (const tool of tools) await writeFile(join(source, `${tool.page}.ink`), `<script def>${JSON.stringify({ tool: tool.name, navigationBarTitleText: tool.title,
    description: tool.description, schema: { data: tool.inputSchema, output: tool.outputSchema } })}</script><page><text>Business</text></page>`);
}
async function fixture() {
  const project = await mkdtemp(join(tmpdir(), 'mcpkit-business-'));
  const source = join(project, 'agent'); await mkdir(join(source, 'mcp-server'), { recursive: true });
  await writeFile(join(source, 'home.ink'), '<page><text>Business</text></page>');
  await writeDeclarations(source, definitions);
  const handlers = join(source, 'mcp-server/handlers.ts'); await writeFile(handlers, handlerSource);
  await writeFile(join(source, 'mcp-server/secret-config.js'), "export const secret = 'SECRET_CONFIGURATION_MUST_STAY_SERVER_ONLY';");
  await writeFile(join(source, '.env'), 'UNIMPORTED_ENV_SECRET=private');
  await writeFile(join(source, 'mcp-server/unused-config.txt'), 'UNIMPORTED_SERVER_SECRET');
  const options = { source, name: 'business-test', outputDir: join(project, 'plugin'), typesFile: join(source, '.mcpkit/tools.d.ts') };
  return { project, source, handlers, options };
}

function transport(result, project) {
  return new StdioClientTransport({ command: process.execPath, args: [result.files.server], cwd: tmpdir(),
    env: { ...process.env, STARTED_FILE: join(project, 'started'), ABORT_FILE: join(project, 'aborted') } });
}
async function waitFile(path) {
  for (let i = 0; i < 100; i++) { try { return await readFile(path, 'utf8'); } catch { await new Promise(resolve => setTimeout(resolve, 20)); } }
  throw new Error(`Missing file: ${path}`);
}

test('custom business tools advertise schemas, isolate server source, and return stable MCP results/errors', async () => {
  const f = await fixture(); const client = new Client({ name: 'business-test', version: '1' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } } });
  try {
    const result = await buildPlugin(f.options);
    await client.connect(transport(result, f.project));
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name), definitions.map(tool => tool.name));
    assert.deepEqual(tools[0].inputSchema, schema); assert.deepEqual(tools[0].outputSchema, schema);
    assert.equal(tools[0].title, 'double'); assert.equal(result.tools[0].page, 'double');
    const html = await readFile(result.files.view, 'utf8'); const server = await readFile(result.files.server, 'utf8');
    for (const marker of ['HANDLER_SOURCE_MUST_STAY_SERVER_ONLY', 'SECRET_CONFIGURATION_MUST_STAY_SERVER_ONLY', 'STARTED_FILE', 'ABORT_FILE']) {
      assert.ok(!html.includes(marker), marker); assert.ok(server.includes(marker), marker);
    }
    assert.equal(new Set(tools.map(tool => tool._meta.ui.resourceUri)).size, tools.length);
    assert.deepEqual((await client.callTool({ name: 'app', arguments: { value: 1 } })).structuredContent, { value: 1 });
    const success = await client.callTool({ name: 'double', arguments: { value: 3 } });
    assert.equal(success.isError, undefined); assert.deepEqual(success.structuredContent, { value: 6 });
    assert.deepEqual(success.content, [{ type: 'text', text: 'Doubled value' }]);
    assert.equal(success._meta.uiOnly.privateMarker, 'HANDLER_SOURCE_MUST_STAY_SERVER_ONLY');
    assert.ok(!JSON.stringify({ content: success.content, structuredContent: success.structuredContent }).includes('HANDLER_SOURCE'));
    assert.equal(success._meta.request.state, 'ready');
    assert.ok(!html.includes('UNIMPORTED_ENV_SECRET'));
    assert.ok(!html.includes('UNIMPORTED_SERVER_SECRET'));
    assert.ok(!html.includes('interface ToolInputs'));
    assert.match(await readFile(result.files.types, 'utf8'), /"double": \{ "value": number \}/);
    const resource = await client.readResource({ uri: tools[0]._meta.ui.resourceUri }); assert.match(resource.contents[0].text, /<body data-page="double">/);
    for (const [name, args, code, message] of [
      ['double', { value: 'bad' }, 'INVALID_INPUT', 'Tool arguments do not match the input schema.'],
      ['slow', {}, 'INVALID_INPUT', 'Tool arguments do not match the input schema.'],
      ['expected_error', { value: 1 }, 'NOT_AVAILABLE', 'Try another item.'],
      ['crash', { value: 1 }, 'INTERNAL_ERROR', 'Tool execution failed.'],
      ['bad_output', { value: 1 }, 'INVALID_OUTPUT', 'Tool result does not match the output schema.'],
      ['bad_content', { value: 1 }, 'INVALID_OUTPUT', 'Tool result is not a valid MCP response.'],
      ['cyclic', { value: 1 }, 'INVALID_OUTPUT', 'Tool result must be JSON serializable.'],
      ['wire_output', { value: 1 }, 'INVALID_OUTPUT', 'Serialized tool result does not match its contract.'],
      ['bad_details', { value: 1 }, 'BAD_DETAILS', 'Safe error message.'],
    ]) {
      const response = await client.callTool({ name, arguments: args });
      assert.equal(response.isError, true); assert.equal(response.structuredContent, undefined);
      assert.deepEqual(response._meta.businessError, { code, message });
      assert.deepEqual(response.content, [{ type: 'text', text: `${code}: ${message}` }]);
      assert.equal(response._meta.request.state, 'error');
      assert.ok(!JSON.stringify(response).includes('SECRET_CONFIGURATION'), 'unexpected errors must not reveal configuration');
      if (name === 'expected_error') assert.deepEqual(response._meta.uiOnly, { reason: 'UI_ONLY_REASON' });
    }
    await assert.rejects(access(join(f.project, 'started')), 'invalid input must not run the handler');
    const concurrent = await Promise.all([1, 2, 3].map(value => client.callTool({ name: 'double', arguments: { value } })));
    assert.deepEqual(concurrent.map(result => result.structuredContent.value), [2, 4, 6]);
    assert.equal(new Set(concurrent.map(result => result._meta.request.requestId)).size, 3);
  } finally { await client.close(); await rm(f.project, { recursive: true, force: true }); }
});

test('business handler timeout and client cancellation abort unfinished server work', async () => {
  for (const cancel of [false, true]) {
    const f = await fixture(); const client = new Client({ name: 'cancel-test', version: '1' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } } });
    try {
      const result = await buildPlugin({ ...f.options, requestPolicy: { requestTimeoutMs: 1000, totalTimeoutMs: 5000 } });
      await client.connect(transport(result, f.project)); await client.listTools();
      const controller = new AbortController();
      const response = client.callTool({ name: 'slow', arguments: { value: 1 } }, CallToolResultSchema, { signal: controller.signal }).catch(error => error);
      assert.equal(await waitFile(join(f.project, 'started')), 'started'); if (cancel) controller.abort();
      const outcome = await response;
      if (cancel) assert.ok(outcome instanceof Error);
      else { assert.equal(outcome.isError, true); assert.equal(outcome._meta.businessError.code, 'REQUEST_TIMEOUT'); }
      assert.equal(await waitFile(join(f.project, 'aborted')), 'aborted');
    } finally { await client.close(); await rm(f.project, { recursive: true, force: true }); }
  }
});

test('handler progress is forwarded to MCP clients and resets only the configured request timer', async () => {
  const f = await fixture(); const client = new Client({ name: 'progress-test', version: '1' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } } });
  try {
    const result = await buildPlugin({ ...f.options, requestPolicy: { requestTimeoutMs: 250, totalTimeoutMs: 2000, resetTimeoutOnProgress: true } });
    await client.connect(transport(result, f.project)); await client.listTools();
    const progress = [];
    // Observe protocol notifications directly: the SDK's onprogress callback can
    // lose the last update when stdio reads it and the result in the same chunk.
    // Notification dispatch is deferred, but result handling removes the callback.
    const progressToken = 'business-progress-test';
    client.setNotificationHandler(ProgressNotificationSchema, notification => progress.push(notification.params));
    const response = await client.callTool({ name: 'progress', arguments: { value: 7 }, _meta: { progressToken } });
    assert.deepEqual(response.structuredContent, { value: 7 });
    assert.deepEqual(progress, [0, 1, 2].map(value => ({ progressToken, progress: value, total: 3 })));
  } finally { await client.close(); await rm(f.project, { recursive: true, force: true }); }
});

test('page-owned business contracts are validated before output, and private dependencies stay out of the UI', async () => {
  const f = await fixture();
  try {
    const invalid = join(f.project, 'invalid');
    for (const [tools, pattern] of [
      [[{ ...definitions[0], name: 'bad name' }], /tool must contain/],
      [[{ ...definitions[0], name: 123 }], /tool must contain/],
      [[definitions[0], { ...definitions[0], page: 'second' }], /Duplicate tool name/],
      [[{ ...definitions[0], outputSchema: { type: 'string' } }], /schema.output/],
      [[{ ...definitions[0], inputSchema: { type: 'object', $ref: 'missing.json' } }], /resolve reference/],
      [[{ ...definitions[0], description: '' }], /nonempty description/],
    ]) {
      await writeDeclarations(f.source, tools);
      await assert.rejects(buildPlugin({ ...f.options, outputDir: invalid }), pattern);
      await assert.rejects(access(invalid));
    }
    await writeDeclarations(f.source, definitions);
    await writeFile(join(f.source, 'app.json'), JSON.stringify({ pages: ['home', 'missing'] }));
    await assert.rejects(buildPlugin({ ...f.options, outputDir: invalid }), /Page not found/);
    await writeDeclarations(f.source, definitions);
    // Discovery follows app.json.pages even when another .ink file declares a tool.
    await writeFile(join(f.source, 'unregistered.ink'), `<script def>${JSON.stringify({ tool: 'unregistered', description: 'Ignored', schema: { data: schema, output: schema } })}</script><page />`);
    // A server dependency can live at project root without entering the UI assets.
    await writeFile(join(f.source, 'private-config.js'), "export const secret = 'ROOT_CONFIGURATION_SECRET';");
    await writeFile(f.handlers, handlerSource.replace("'./secret-config.js'", "'../private-config.js'"));
    const result = await buildPlugin(f.options);
    assert.ok(!result.tools.some(tool => tool.name === 'unregistered'));
    assert.ok(!(await readFile(result.files.view, 'utf8')).includes('ROOT_CONFIGURATION_SECRET'));
    await assert.rejects(buildPlugin({ ...f.options, businessTools: { tools: definitions, handlers: f.handlers } }), /script def/);
  } finally { await rm(f.project, { recursive: true, force: true }); }
});

test('root-package handler imports share the server error type without bundling the builder', async () => {
  const f = await fixture(); const client = new Client({ name: 'root-import', version: '1' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } } });
  try {
    await writeFile(f.handlers, handlerSource.replace('@yodaos-pkg/aiui-mcpkit/tools', '@yodaos-pkg/aiui-mcpkit'));
    const result = await buildPlugin(f.options); await client.connect(transport(result, f.project)); await client.listTools();
    const response = await client.callTool({ name: 'expected_error', arguments: { value: 1 } });
    assert.equal(response._meta.businessError.code, 'NOT_AVAILABLE');
    assert.ok(!(await readFile(result.files.server, 'utf8')).includes('esbuild/lib/main'));
  } finally { await client.close(); await rm(f.project, { recursive: true, force: true }); }
});

test('2026-07-28 cancellation and timeout reach the business handler AbortSignal', async () => {
  const { Client: ModernClient } = await import('@modelcontextprotocol/client');
  const { StdioClientTransport: ModernTransport } = await import('@modelcontextprotocol/client/stdio');
  for (const cancel of [false, true]) {
    const f = await fixture();
    const client = new ModernClient({ name: 'modern-abort-test', version: '1' }, {
      versionNegotiation: { mode: { pin: '2026-07-28' } },
    });
    try {
      const built = await buildPlugin({ ...f.options, requestPolicy: { requestTimeoutMs: 1000, totalTimeoutMs: 5000 } });
      await client.connect(new ModernTransport({ command: process.execPath, args: [built.files.server], cwd: tmpdir(),
        env: { ...process.env, STARTED_FILE: join(f.project, 'started'), ABORT_FILE: join(f.project, 'aborted') } }));
      await client.listTools();
      const controller = new AbortController();
      const response = client.callTool({ name: 'slow', arguments: { value: 1 } }, { signal: controller.signal }).catch(error => error);
      assert.equal(await waitFile(join(f.project, 'started')), 'started');
      if (cancel) controller.abort();
      const outcome = await response;
      if (cancel) assert.ok(outcome instanceof Error);
      else { assert.equal(outcome.isError, true); assert.equal(outcome._meta.businessError.code, 'REQUEST_TIMEOUT'); }
      assert.equal(await waitFile(join(f.project, 'aborted')), 'aborted');
    } finally { await client.close(); await rm(f.project, { recursive: true, force: true }); }
  }
});
