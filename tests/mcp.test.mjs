import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('Counter example exposes page tools, validates arguments, and serves their UI resources', async () => {
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: 'node', args: ['dist/server.mjs'], cwd: `${process.cwd()}/dist/examples/counter` });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map(tool => tool.name), ['open_counter', 'open_countdown']);
    const opener = tools.tools.find(tool => tool.name === 'open_counter');
    assert.equal(opener?._meta?.ui?.resourceUri, 'ui://ink-counter/open_counter.html');
    assert.equal(opener.inputSchema.properties.initialCount.type, 'integer');
    assert.deepEqual(opener._meta['openai/ui'].entrypoints, [{ type: 'thread' }, { type: 'global' }]);
    const result = await client.callTool({ name: 'open_counter', arguments: {} });
    assert.equal(result.isError, undefined);
    assert.equal(result._meta.request.state, 'ready');
    assert.equal(typeof result._meta.request.requestId, 'string');
    assert.equal(result._meta.request.policy.maxRetries, 0);
    assert.equal(opener._meta.requestPolicy.totalTimeoutMs, 60000);
    const configured = await client.callTool({ name: 'open_counter', arguments: { initialCount: 5, label: 'Demo' } });
    assert.deepEqual(configured._meta.aiui, { page: 'pages/counter/index', query: { initialCount: 5, label: 'Demo' } });
    const countdown = tools.tools.find(tool => tool.name === 'open_countdown');
    assert.equal(countdown._meta.ui.resourceUri, 'ui://ink-counter/open_countdown.html');
    assert.deepEqual(countdown.inputSchema.required, ['start']);
    const countdownResult = await client.callTool({ name: 'open_countdown', arguments: { start: 8, step: 2 } });
    assert.deepEqual(countdownResult._meta.aiui, { page: 'pages/countdown/index', query: { start: 8, step: 2 } });
    for (const [name, args] of [['open_counter', { initialCount: -1 }], ['open_counter', { initialCount: '5' }], ['open_countdown', {}], ['open_countdown', { start: 8, step: 0 }]]) {
      assert.equal((await client.callTool({ name, arguments: args })).isError, true);
    }
    const countdownResource = await client.readResource({ uri: countdown._meta.ui.resourceUri });
    assert.match(countdownResource.contents[0].text, /<body data-page="pages\/countdown\/index">/);
    const resource = await client.readResource({ uri: opener._meta.ui.resourceUri });
    const content = resource.contents[0];
    assert.match(content.text, /<body data-page="pages\/counter\/index">/);
    assert.equal(content.mimeType, 'text/html;profile=mcp-app');
    assert.match(content.text, /AIUI MCPKit Counter/);
    assert.deepEqual(content._meta.ui.csp.resourceDomains, []);
    assert.deepEqual(content._meta.ui.csp.connectDomains, []);
    assert.deepEqual(content._meta['openai/ui'].availableDisplayModes, ['inline', 'fullscreen']);
    assert.equal(content._meta['openai/ui'].preferredDisplayMode, 'inline');
    assert.ok(content.text.length > 1_000_000);
    // Internal transport-size budget; this is not a documented host limit.
    assert.ok(Buffer.byteLength(JSON.stringify(resource), 'utf8') < 10_000_000);
  } finally {
    await client.close();
  }
});
