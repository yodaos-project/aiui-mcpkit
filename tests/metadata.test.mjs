import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

const capabilities = { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } };
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'mcpkit-metadata-'));
  const source = join(root, 'agent'); await mkdir(source);
  await writeFile(join(source, 'app.json'), JSON.stringify({ name: 'Metadata', pages: ['home'] }));
  await writeFile(join(source, 'home.ink'), '<page><text>Metadata</text></page>');
  await writeFile(join(source, '.env'), 'SECRET_NEVER_INSPECTED=secret-value');
  await mkdir(join(source, 'mcp-server'));
  await writeFile(join(source, 'mcp-server/config.js'), 'SERVER_SECRET_NEVER_INSPECTED');
  return { root, source, name: 'metadata-test', outputDir: join(root, 'plugin') };
}

test('author metadata, custom resources and build inspection match live protocol items in both eras', async () => {
  const f = await fixture();
  try {
    const options = { ...f,
      toolMetadata: { open_app: { ui: { resourceUri: 'ui://custom/dashboard', visibility: ['model', 'app'] },
        'openai/ui': { entrypoints: [{ type: 'thread' }], customHint: 'public' }, 'example/vendor': { nested: { theme: 'green' }, features: [1, null, true] } } },
      resourceMetadata: { ui: { csp: { connectDomains: ['https://api.example.com'] }, prefersBorder: false }, 'example/resource': 'public' },
      uiResources: [{ name: 'Custom dashboard', uri: 'ui://custom/dashboard', description: 'An external UI implementation',
        html: '<!doctype html><html><body>Custom public View</body></html>',
        _meta: { ui: { csp: { connectDomains: [], resourceDomains: ['https://cdn.example.com'] } }, 'openai/ui': { preferredDisplayMode: 'fullscreen' } } }],
    };
    const result = await buildPlugin(options);
    const inspected = result.inspectProtocol(capabilities);
    assert.equal(result.tools[0].resourceUri, 'ui://custom/dashboard');
    assert.equal(inspected.tools[0]._meta['ui/resourceUri'], 'ui://custom/dashboard');
    assert.deepEqual(inspected.tools[0]._meta['openai/ui'].entrypoints, [{ type: 'thread' }]);
    assert.equal(inspected.tools[0]._meta['openai/ui'].customHint, 'public');
    assert.deepEqual(inspected.tools[0]._meta['example/vendor'].features, [1, null, true]);
    const custom = inspected.resources.find(resource => resource.uri === 'ui://custom/dashboard');
    assert.deepEqual(custom._meta.ui.csp, { connectDomains: [], resourceDomains: ['https://cdn.example.com'] });
    assert.equal(custom._meta.ui.prefersBorder, false);
    assert.equal(custom._meta['openai/ui'].preferredDisplayMode, 'fullscreen');
    assert.deepEqual(custom._meta['openai/ui'].availableDisplayModes, ['inline', 'fullscreen']);
    const generated = inspected.resources.find(resource => resource.uri === 'ui://metadata-test/app.html');
    assert.deepEqual(generated._meta.ui.csp, { connectDomains: ['https://api.example.com'], resourceDomains: [] });
    assert.deepEqual(inspected.connection, JSON.parse(await readFile(result.files.mcp, 'utf8')));
    assert.ok(!JSON.stringify(inspected).includes('Custom public View'), 'inspection must exclude HTML');
    assert.ok(!JSON.stringify(inspected).includes(f.root), 'inspection must not expose private source/handler paths');
    assert.ok(!JSON.stringify(inspected).includes('SECRET_NEVER_INSPECTED'));
    assert.ok(!JSON.stringify(inspected).includes('SERVER_SECRET_NEVER_INSPECTED'));
    assert.ok(!('env' in inspected.connection.mcpServers['metadata-test']));
    for (const era of ['legacy', 'modern']) {
      for (const ui of [true, false]) {
        const client = new Client({ name: 'metadata-test', version: '1' }, {
          capabilities: ui ? capabilities : {}, versionNegotiation: { mode: era === 'modern' ? { pin: '2026-07-28' } : 'legacy' },
        });
        try {
          await client.connect(new StdioClientTransport({ command: process.execPath, args: [result.files.server], cwd: tmpdir() }));
          const expected = result.inspectProtocol(ui ? capabilities : {});
          assert.deepEqual((await client.listTools()).tools, expected.tools);
          assert.deepEqual((await client.listResources()).resources, expected.resources);
          const response = await client.readResource({ uri: custom.uri });
          assert.deepEqual(response.contents[0], { uri: custom.uri, mimeType: custom.mimeType, text: options.uiResources[0].html, _meta: custom._meta });
          assert.deepEqual((await client.readResource({ uri: generated.uri })).contents[0]._meta, generated._meta);
          const call = await client.callTool({ name: 'open_app', arguments: {} });
          assert.equal(call._meta.mcpkit.ui, ui ? 'available' : 'unavailable');
          assert.deepEqual(expected.tools[0]._meta['example/vendor'], inspected.tools[0]._meta['example/vendor']);
          if (!ui) { assert.equal(expected.tools[0]._meta.ui, undefined); assert.equal(expected.tools[0]._meta['openai/ui'], undefined); }
        } finally { await client.close(); }
      }
    }
    // Caller mutations cannot change the already-built protocol model.
    result.tools[0].resourceUri = 'ui://mutated';
    inspected.tools[0]._meta['example/vendor'].features.push('mutated');
    options.toolMetadata.open_app.ui.resourceUri = 'ui://mutated';
    assert.equal(result.inspectProtocol(capabilities).tools[0]._meta.ui.resourceUri, 'ui://custom/dashboard');
    assert.deepEqual(result.inspectProtocol(capabilities).tools[0]._meta['example/vendor'].features, [1, null, true]);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('legacy resource alias normalizes to both tool UI references', async () => {
  const f = await fixture();
  try {
    const result = await buildPlugin({ ...f, toolMetadata: { open_app: { 'ui/resourceUri': 'ui://metadata-test/app.html', 'openai/ui': null } } });
    const meta = result.inspectProtocol(capabilities).tools[0]._meta;
    assert.equal(meta.ui.resourceUri, meta['ui/resourceUri']);
    assert.equal(meta['openai/ui'], null, 'null replaces default host metadata');
    assert.equal(result.inspectProtocol().tools[0]._meta.mcpkit.ui, 'unavailable');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('invalid metadata and resources fail before output, without leaking rejected values', async () => {
  const f = await fixture();
  const tool = meta => ({ toolMetadata: { open_app: meta } });
  const cyclic = {}; cyclic.self = cyclic;
  const getter = {}; Object.defineProperty(getter, 'read', { enumerable: true, get() { throw new Error('GETTER_MUST_NOT_RUN'); } });
  const cases = [
    ...['request', 'uiOnly', 'businessError'].map(key => [tool({ [key]: {} }), /reserved/]),
    [tool({ requestPolicy: {} }), /reserved/], [tool({ mcpkit: {} }), /reserved/], [tool({ aiui: {} }), /reserved/],
    [tool({ 'io.modelcontextprotocol/serverInfo': {} }), /reserved/],
    [tool({ vendor: { apiKey: 'PRIVATE_VALUE_MUST_NOT_LEAK' } }), /forbidden/],
    [tool({ env: { private: 'PRIVATE_VALUE_MUST_NOT_LEAK' } }), /forbidden/],
    [tool({ value: undefined }), /JSON/], [tool({ value: () => {} }), /JSON/], [tool({ value: NaN }), /JSON/],
    [tool({ value: 1n }), /JSON/], [tool({ value: new Date() }), /plain JSON/], [tool({ value: cyclic }), /acyclic/],
    [tool({ value: getter }), /accessors/], [tool(JSON.parse('{"__proto__":{}}')), /forbidden/],
    [tool({ ui: null }), /ui/], [{ resourceMetadata: { ui: { prefersBorder: 'yes' } } }, /boolean/],
    [{ resourceMetadata: { ui: { csp: { connectDomains: [1] } } } }, /domain list/],
    [tool({ ui: { visibility: ['other'] } }), /model\/app/],
    [{ resourceMetadata: { ui: { permissions: { camera: true } } } }, /permission/],
    [tool({ ui: { resourceUri: 'https://example.com' } }), /ui:\/\//],
    [tool({ ui: { resourceUri: 'ui://missing' } }), /not registered/],
    [tool({ ui: { resourceUri: 'ui://metadata-test/app.html' }, 'ui/resourceUri': 'ui://other' }), /conflicting/],
    [tool({ ui: { permissions: { camera: {} } } }), /belongs on resource/],
    [{ resourceMetadata: { ui: { resourceUri: 'ui://custom' } } }, /belongs on tool/],
    [{ resourceMetadata: null }, /metadata object/], [{ toolMetadata: null }, /keyed by tool/], [{ uiResources: null }, /array/],
    [{ toolMetadata: { missing: {} } }, /unknown tool/],
    [{ resourceMetadata: { password: 'PRIVATE_VALUE_MUST_NOT_LEAK' } }, /forbidden/],
    [{ uiResources: [{ uri: 'ui://metadata-test/app.html', name: 'Collision', html: 'html' }] }, /duplicate/],
    [{ uiResources: [{ uri: 'ui://user:password@custom/path', name: 'Credentials', html: 'html' }] }, /invalid public/],
    [{ uiResources: [{ uri: 'ui://custom', name: 'Empty', html: '' }] }, /nonempty/],
  ];
  try {
    for (const [options, pattern] of cases) {
      await assert.rejects(buildPlugin({ ...f, ...options }), error => {
        assert.match(error.message, pattern); assert.ok(!error.message.includes('PRIVATE_VALUE_MUST_NOT_LEAK')); return true;
      });
      await assert.rejects(access(f.outputDir));
    }
    // Invalid rebuilds preserve previously generated artifacts.
    const built = await buildPlugin(f);
    const original = await readFile(built.files.server, 'utf8');
    await assert.rejects(buildPlugin({ ...f, ...tool({ request: {} }) }), /reserved/);
    assert.equal(await readFile(built.files.server, 'utf8'), original);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
