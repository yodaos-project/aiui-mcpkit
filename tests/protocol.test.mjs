import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const mimeType = 'text/html;profile=mcp-app';
const uiCapabilities = { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [mimeType] } } };
function transport(example) {
  return new StdioClientTransport({ command: process.execPath, args: ['dist/server.mjs'], cwd: `${process.cwd()}/dist/examples/${example}` });
}

for (const era of ['legacy', 'modern']) {
  for (const ui of [true, false]) {
    test(`${era} protocol: discovery, tools, resources and ${ui ? 'Apps View' : 'text fallback'}`, async () => {
      const client = new Client({ name: 'protocol-test', version: '1' }, {
        versionNegotiation: { mode: era === 'modern' ? { pin: '2026-07-28' } : 'legacy' },
        capabilities: ui ? uiCapabilities : {},
      });
      const wire = transport('counter');
      const sent = [];
      const send = wire.send.bind(wire);
      wire.send = (message, options) => { sent.push(message); return send(message, options); };
      try {
        await client.connect(wire);
        assert.equal(client.getProtocolEra(), era);
        assert.equal(client.getNegotiatedProtocolVersion(), era === 'modern' ? '2026-07-28' : '2025-11-25');
        assert.equal(client.getServerVersion().name, 'ink-counter');
        assert.ok(client.getServerCapabilities().tools);
        assert.ok(client.getServerCapabilities().resources);
        if (era === 'modern') assert.ok(client.getDiscoverResult());
        const { tools } = await client.listTools();
        assert.deepEqual(tools.map(tool => tool.name), ['open_counter', 'open_countdown']);
        const tool = tools[0];
        assert.equal(tool._meta.mcpkit.ui, ui ? 'available' : 'unavailable');
        assert.equal(tool._meta.ui?.resourceUri, ui ? 'ui://ink-counter/open_counter.html' : undefined);
        assert.equal(tool._meta['ui/resourceUri'], ui ? tool._meta.ui.resourceUri : undefined);
        assert.equal(tool._meta['openai/ui'] !== undefined, ui);
        const result = await client.callTool({ name: tool.name, arguments: { initialCount: 5 } });
        assert.equal(result.isError, undefined);
        assert.equal(result._meta.mcpkit.ui, ui ? 'available' : 'unavailable');
        assert.deepEqual(result._meta.aiui.query, { initialCount: 5 });
        assert.match(result.content[0].text, ui ? /opened/ : /interactive view unavailable/);
        assert.equal((await client.callTool({ name: 'open_countdown', arguments: {} })).isError, true);
        const { resources } = await client.listResources();
        assert.equal(resources.length, 2);
        assert.equal(resources[0].mimeType, mimeType);
        const resource = await client.readResource({ uri: resources[0].uri });
        assert.equal(resource.contents[0].mimeType, mimeType);
        assert.deepEqual(resource.contents[0]._meta.ui.csp.connectDomains, []);
        assert.match(resource.contents[0].text, /<body data-page="pages\/counter\/index">/);
        await assert.rejects(client.readResource({ uri: 'ui://missing/view.html' }));
        const request = sent.find(message => message.method === 'tools/list');
        if (era === 'modern') {
          assert.equal(request.params._meta['io.modelcontextprotocol/protocolVersion'], '2026-07-28');
          assert.deepEqual(request.params._meta['io.modelcontextprotocol/clientCapabilities'], ui ? uiCapabilities : {});
        } else {
          assert.ok(sent.some(message => message.method === 'initialize'));
          assert.ok(sent.some(message => message.method === 'notifications/initialized'));
          assert.deepEqual(await client.ping(), {});
        }
      } finally { await client.close(); }
    });
  }
}

for (const era of ['legacy', 'modern']) {
  test(`${era} business results, progress notification and cancellation`, async () => {
    const client = new Client({ name: 'business-protocol-test', version: '1' }, {
      versionNegotiation: { mode: era === 'modern' ? { pin: '2026-07-28' } : 'legacy' },
    });
    try {
      await client.connect(transport('business'));
      await client.listTools();
      const progress = [];
      client.setNotificationHandler('notifications/progress', notification => progress.push(notification.params));
      const result = await client.callTool({ name: 'quote_order', arguments: { quantity: 2 }, _meta: { progressToken: 'quote' } });
      assert.equal(result.structuredContent.total, 40);
      assert.equal(result._meta.uiOnly.stockRemaining, 98);
      assert.equal(result._meta.request.state, 'ready');
      assert.equal(result._meta.mcpkit.ui, 'unavailable');
      assert.match(result.content.at(-1).text, /Interactive view unavailable/);
      assert.deepEqual(progress, [{ progressToken: 'quote', progress: 0, total: 1, message: 'Calculating quote' }]);
      const failure = await client.callTool({ name: 'quote_order', arguments: { quantity: 2, coupon: 'bad' } });
      assert.equal(failure.isError, true);
      assert.equal(failure.structuredContent, undefined);
      assert.equal(failure._meta.businessError.code, 'INVALID_COUPON');
      const controller = new AbortController();
      client.setNotificationHandler('notifications/progress', notification => {
        if (notification.params.progressToken === 'cancel-quote') controller.abort(new Error('Cancel test'));
      });
      const cancelled = client.callTool({ name: 'quote_order', arguments: { quantity: 1 }, _meta: { progressToken: 'cancel-quote' } }, { signal: controller.signal });
      await assert.rejects(cancelled, /Cancel test/);
      // A cancelled call must leave the connection usable.
      assert.equal((await client.callTool({ name: 'check_stock', arguments: { sku: 'DEMO' } })).structuredContent.available, 100);
    } finally { await client.close(); }
  });
}

// Change only request-local Apps capabilities on one modern connection.
// This catches accidental use of initialize state or a cached list decision.
test('modern Views capability is evaluated on each request', async () => {
  const client = new Client({ name: 'changing-capabilities', version: '1' }, {
    versionNegotiation: { mode: { pin: '2026-07-28' } }, capabilities: uiCapabilities,
  });
  const wire = transport('counter');
  let ui = true;
  const send = wire.send.bind(wire);
  wire.send = (message, options) => {
    if (message.params?._meta?.['io.modelcontextprotocol/clientCapabilities']) {
      message = { ...message, params: { ...message.params, _meta: { ...message.params._meta,
        'io.modelcontextprotocol/clientCapabilities': ui ? uiCapabilities : {},
      } } };
    }
    return send(message, options);
  };
  try {
    await client.connect(wire);
    assert.ok((await client.listTools()).tools[0]._meta.ui);
    ui = false;
    assert.equal((await client.callTool({ name: 'open_counter', arguments: {} }))._meta.mcpkit.ui, 'unavailable');
    assert.equal((await client.listTools()).tools[0]._meta.ui, undefined);
    ui = true;
    assert.equal((await client.callTool({ name: 'open_counter', arguments: {} }))._meta.mcpkit.ui, 'available');
  } finally { await client.close(); }
});

for (const revision of ['2024-11-05', '2025-03-26', '2025-06-18']) {
  test(`legacy revision ${revision} keeps initialization and page tools working`, async () => {
    const client = new Client({ name: 'legacy-revision', version: '1' }, {
      supportedProtocolVersions: [revision], capabilities: uiCapabilities,
    });
    try {
      await client.connect(transport('counter'));
      assert.equal(client.getNegotiatedProtocolVersion(), revision);
      const { tools } = await client.listTools();
      assert.equal(tools[0]._meta.ui.resourceUri, 'ui://ink-counter/open_counter.html');
      assert.equal((await client.callTool({ name: 'open_counter', arguments: {} }))._meta.request.state, 'ready');
    } finally { await client.close(); }
  });
}

test('an Apps extension without the supported MIME type receives a text fallback', async () => {
  const client = new Client({ name: 'unsupported-view-format', version: '1' }, {
    versionNegotiation: { mode: { pin: '2026-07-28' } },
    capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/plain'] } } },
  });
  try {
    await client.connect(transport('counter'));
    assert.equal((await client.listTools()).tools[0]._meta.ui, undefined);
    assert.match((await client.callTool({ name: 'open_counter', arguments: {} })).content[0].text, /interactive view unavailable/);
  } finally { await client.close(); }
});

test('modern stdio rejects unsupported opening revisions and missing capability metadata', async () => {
  const { spawn } = await import('node:child_process');
  const { createInterface } = await import('node:readline');
  const child = spawn(process.execPath, ['dist/server.mjs'], { cwd: `${process.cwd()}/dist/examples/counter`, stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = createInterface({ input: child.stdout });
  const pending = new Map();
  lines.on('line', line => {
    const response = JSON.parse(line);
    pending.get(response.id)?.(response);
  });
  let id = 0;
  function request(method, params = {}) {
    return new Promise((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`No response to ${method}`)); }, 5000);
      pending.set(requestId, response => { clearTimeout(timer); pending.delete(requestId); resolve(response); });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }) + '\n');
    });
  }
  const meta = {
    'io.modelcontextprotocol/protocolVersion': '2026-07-28',
    'io.modelcontextprotocol/clientInfo': { name: 'wire-test', version: '1' },
    'io.modelcontextprotocol/clientCapabilities': uiCapabilities,
  };
  try {
    const unsupported = await request('tools/list', { _meta: { ...meta, 'io.modelcontextprotocol/protocolVersion': '2099-01-01' } });
    assert.ok(unsupported.error);
    assert.match(unsupported.error.message, /protocol|version/i);
    assert.ok((await request('server/discover', { _meta: meta })).result);
    assert.ok((await request('tools/list', { _meta: meta })).result.tools);
    const missing = { ...meta }; delete missing['io.modelcontextprotocol/clientCapabilities'];
    const invalid = await request('tools/list', { _meta: missing });
    assert.equal(invalid.error.code, -32602);
    assert.match(invalid.error.message, /clientCapabilities|envelope|metadata/i);
    // Validation errors do not corrupt the connection.
    assert.ok((await request('tools/list', { _meta: meta })).result.tools);
  } finally {
    lines.close(); child.kill();
  }
});
