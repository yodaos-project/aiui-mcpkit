import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, cp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const exec = promisify(execFile);
const root = process.cwd();

test('unified example build creates one marketplace with both independently callable plugins', async () => {
  const project = await mkdtemp(join(tmpdir(), 'mcpkit-examples-'));
  try {
    await exec(process.execPath, ['scripts/build-examples.mjs', '--out', project]);
    const marketplace = JSON.parse(await readFile(join(project, '.agents/plugins/marketplace.json'), 'utf8'));
    assert.equal(marketplace.name, 'aiui-mcpkit-examples');
    assert.deepEqual(marketplace.plugins.map(plugin => [plugin.name, plugin.source.path]), [['ink-counter', './counter'], ['business-demo', './business']]);
    for (const [index, expected] of [['open_counter', 'open_countdown'], ['quote_order', 'check_stock', 'find_products', 'search_catalog', 'inspect_catalog_product', 'select_catalog_product']].entries()) {
      const directory = resolve(project, marketplace.plugins[index].source.path);
      const client = new Client({ name: 'examples-test', version: '1' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } } });
      try {
        await assert.rejects(access(join(directory, '.agents/plugins/marketplace.json')));
        await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(directory, 'dist/server.mjs')], cwd: tmpdir() }));
        assert.deepEqual((await client.listTools()).tools.map(tool => tool.name), expected);
      } finally { await client.close(); }
    }
  } finally { await rm(project, { recursive: true, force: true }); }
});

test('start:examples selects a stdio server and preserves the default Counter', async () => {
  for (const [selector, names] of [[undefined, ['open_counter', 'open_countdown']], ['business', ['quote_order', 'check_stock', 'find_products', 'search_catalog', 'inspect_catalog_product', 'select_catalog_product']]]) {
    const client = new Client({ name: 'start-examples', version: '1' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } } });
    try {
      await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(root, 'scripts/start-examples.mjs'), ...(selector ? [selector] : [])], cwd: tmpdir() }));
      assert.deepEqual((await client.listTools()).tools.map(tool => tool.name), names);
    } finally { await client.close(); }
  }
  await assert.rejects(exec(process.execPath, ['scripts/start-examples.mjs', 'missing']), /Unknown example/);
});

test('product search returns validated candidates and keeps supplier metadata UI-only', async () => {
  const client = new Client({ name: 'selection-protocol', version: '1' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } } });
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/examples/business/dist/server.mjs'], env: { INK_WORKER_BIN: process.env.INK_WORKER_BIN || 'ink-worker' } }));
    const tool = (await client.listTools()).tools.find(tool => tool.name === 'find_products');
    assert.equal(tool._meta.ui.resourceUri, 'ui://business-demo/find_products.html');
    const result = await client.callTool({ name: 'find_products', arguments: { query: ' travel ' } });
    assert.deepEqual(result.structuredContent, { candidates: [
      { sku: 'TRAVEL-MUG', name: 'Travel mug', unitPrice: 89, currency: 'CNY' },
      { sku: 'TRAVEL-BAG', name: 'Travel bag', unitPrice: 249, currency: 'CNY' },
    ] });
    assert.equal(typeof result._meta.uiOnly.supplier, 'string');
    assert.ok(!JSON.stringify({ content: result.content, structuredContent: result.structuredContent }).includes(result._meta.uiOnly.supplier));
    assert.match((await client.readResource({ uri: tool._meta.ui.resourceUri })).contents[0].text, /<body data-page="pages\/selection\/index">/);
    assert.deepEqual((await client.callTool({ name: 'find_products', arguments: { query: 'missing' } })).structuredContent, { candidates: [] });
    const invalid = await client.callTool({ name: 'find_products', arguments: { query: 'x'.repeat(101) } });
    assert.equal(invalid.isError, true);
    assert.equal(invalid._meta.businessError.code, 'INVALID_INPUT');
    const worker = await readFile('dist/examples/business/worker-app/workers/business.js', 'utf8');
    assert.match(worker, /quoteOrder: ModelContext.defineAction/);
    assert.match(worker, /checkStock: ModelContext.defineAction/);
    assert.match(worker, /findProducts: ModelContext.defineAction/);
    await assert.rejects(access('dist/examples/business/worker-app/mcp-server/handlers.ts'));
    const badCoupon = await client.callTool({ name: 'quote_order', arguments: { quantity: 2, coupon: 'invalid' } });
    assert.equal(badCoupon.isError, true);
    assert.equal(badCoupon._meta.businessError.code, 'INVALID_COUPON');
    const badSku = await client.callTool({ name: 'check_stock', arguments: { sku: 'invalid' } });
    assert.equal(badSku._meta.businessError.code, 'UNKNOWN_SKU');
    assert.deepEqual(badSku._meta.uiOnly, { knownSku: 'DEMO' });
  } finally { await client.close(); }
});

test('update:examples updates UI, server, Worker app and manifests for installed plugins', async () => {
  const cache = await mkdtemp(join(tmpdir(), 'mcpkit-example-cache-'));
  const files = ['view.html', 'dist/server.mjs', 'plugin.json', 'mcp.json', 'build.json'];
  try {
    for (const [id, name] of [['counter', 'ink-counter'], ['business', 'business-demo']]) {
      const source = join(root, 'dist/examples', id);
      const target = join(cache, name, 'local');
      await cp(source, target, { recursive: true });
      for (const file of ['view.html', 'dist/server.mjs', 'mcp.json']) await writeFile(join(target, file), 'stale');
      if (id === 'business') {
        await writeFile(join(target, 'worker-app/workers/business.js'), 'stale Worker');
        await writeFile(join(target, 'worker-app/obsolete.js'), 'stale file');
      }
    }
    const result = await exec(process.execPath, ['scripts/update-examples.mjs', '--plugin-dir', cache]);
    assert.match(result.stdout, /ink-counter/); assert.match(result.stdout, /business-demo/);
    for (const [id, name] of [['counter', 'ink-counter'], ['business', 'business-demo']]) {
      for (const file of files) assert.equal(await readFile(join(cache, name, 'local', file), 'utf8'), await readFile(join(root, 'dist/examples', id, file), 'utf8'));
    }
    assert.equal(await readFile(join(cache, 'business-demo/local/worker-app/workers/business.js'), 'utf8'), await readFile(join(root, 'dist/examples/business/worker-app/workers/business.js'), 'utf8'));
    await assert.rejects(access(join(cache, 'business-demo/local/worker-app/obsolete.js')));
    const { build } = JSON.parse(await readFile(join(root, 'dist/examples/counter/build.json'), 'utf8'));
    const diagnosed = await exec(process.execPath, ['scripts/diagnose-examples.mjs', '--example', 'counter',
      '--plugin-dir', join(cache, 'ink-counter/local'), '--server-build', build.id, '--view-build', build.id, '--new-card']);
    assert.deepEqual(JSON.parse(diagnosed.stdout).findings.map(finding => finding.code), ['CURRENT']);
    await writeFile(join(cache, 'business-demo/local/plugin.json'), JSON.stringify({ name: 'wrong-plugin' }));
    await writeFile(join(cache, 'ink-counter/local/view.html'), 'preserve on validation failure');
    await assert.rejects(exec(process.execPath, ['scripts/update-examples.mjs', '--plugin-dir', cache]), /Unexpected plugin/);
    assert.equal(await readFile(join(cache, 'ink-counter/local/view.html'), 'utf8'), 'preserve on validation failure');
  } finally { await rm(cache, { recursive: true, force: true }); }
});
