import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('stdio MCP exposes opener and self-contained UI resource', async () => {
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: 'node', args: ['dist/server.mjs'], cwd: `${process.cwd()}/plugins/aiui-mcpkit` });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const opener = tools.tools.find(tool => tool.name === 'open_counter');
    assert.equal(opener?._meta?.ui?.resourceUri, 'ui://aiui-mcpkit/counter.html');
    const result = await client.callTool({ name: 'open_counter', arguments: {} });
    assert.equal(result.isError, undefined);
    const resource = await client.readResource({ uri: 'ui://aiui-mcpkit/counter.html' });
    const content = resource.contents[0];
    assert.equal(content.mimeType, 'text/html;profile=mcp-app');
    assert.match(content.text, /Ink counter/);
    assert.deepEqual(content._meta.ui.csp.resourceDomains, []);
    assert.deepEqual(content._meta.ui.csp.connectDomains, []);
    assert.ok(content.text.length > 1_000_000);
  } finally {
    await client.close();
  }
});
