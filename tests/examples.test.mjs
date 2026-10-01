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
    for (const [index, expected] of [['open_counter', 'open_countdown'], ['quote_order', 'check_stock']].entries()) {
      const directory = resolve(project, marketplace.plugins[index].source.path);
      const client = new Client({ name: 'examples-test', version: '1' });
      try {
        await assert.rejects(access(join(directory, '.agents/plugins/marketplace.json')));
        await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(directory, 'dist/server.mjs')], cwd: tmpdir() }));
        assert.deepEqual((await client.listTools()).tools.map(tool => tool.name), expected);
      } finally { await client.close(); }
    }
  } finally { await rm(project, { recursive: true, force: true }); }
});

test('start:examples selects a stdio server and preserves the default Counter', async () => {
  for (const [selector, names] of [[undefined, ['open_counter', 'open_countdown']], ['business', ['quote_order', 'check_stock']]]) {
    const client = new Client({ name: 'start-examples', version: '1' });
    try {
      await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(root, 'scripts/start-examples.mjs'), ...(selector ? [selector] : [])], cwd: tmpdir() }));
      assert.deepEqual((await client.listTools()).tools.map(tool => tool.name), names);
    } finally { await client.close(); }
  }
  await assert.rejects(exec(process.execPath, ['scripts/start-examples.mjs', 'missing']), /Unknown example/);
});

test('update:examples updates UI, handlers and manifests for both installed plugins', async () => {
  const cache = await mkdtemp(join(tmpdir(), 'mcpkit-example-cache-'));
  const files = ['view.html', 'dist/server.mjs', 'plugin.json', 'mcp.json'];
  try {
    for (const [id, name] of [['counter', 'ink-counter'], ['business', 'business-demo']]) {
      const source = join(root, 'dist/examples', id);
      const target = join(cache, name, 'local');
      await cp(source, target, { recursive: true });
      for (const file of ['view.html', 'dist/server.mjs', 'mcp.json']) await writeFile(join(target, file), 'stale');
    }
    const result = await exec(process.execPath, ['scripts/update-examples.mjs', '--plugin-dir', cache]);
    assert.match(result.stdout, /ink-counter/); assert.match(result.stdout, /business-demo/);
    for (const [id, name] of [['counter', 'ink-counter'], ['business', 'business-demo']]) {
      for (const file of files) assert.equal(await readFile(join(cache, name, 'local', file), 'utf8'), await readFile(join(root, 'dist/examples', id, file), 'utf8'));
    }
    await writeFile(join(cache, 'business-demo/local/plugin.json'), JSON.stringify({ name: 'wrong-plugin' }));
    await writeFile(join(cache, 'ink-counter/local/view.html'), 'preserve on validation failure');
    await assert.rejects(exec(process.execPath, ['scripts/update-examples.mjs', '--plugin-dir', cache]), /Unexpected plugin/);
    assert.equal(await readFile(join(cache, 'ink-counter/local/view.html'), 'utf8'), 'preserve on validation failure');
  } finally { await rm(cache, { recursive: true, force: true }); }
});
