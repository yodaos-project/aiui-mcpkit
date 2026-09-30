import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const exec = promisify(execFile);
const cli = resolve('dist/cli.mjs');

test('package a developer app outside the framework checkout', async () => {
  const project = await mkdtemp(join(tmpdir(), 'mcpkit-developer-'));
  const ink = join(project, 'ink');
  const output = join(project, 'dist', 'my-dashboard');
  const client = new Client({ name: 'builder-test', version: '1' });
  try {
    await mkdir(join(ink, 'pages'), { recursive: true });
    await writeFile(join(ink, 'app.json'), JSON.stringify({ name: 'My Dashboard', pages: ['pages/home'] }));
    await writeFile(join(ink, 'pages/home.ink'), '<page><text>Developer dashboard</text></page>');
    await exec(process.execPath, [cli, '--ink', './ink', '--name', 'my-dashboard', '--tool', 'show_dashboard'], { cwd: project });
    const manifest = JSON.parse(await readFile(join(output, 'plugin.json'), 'utf8'));
    assert.equal(manifest.name, 'my-dashboard');
    assert.equal(manifest.extensions['com.openai'].interface.displayName, 'My Dashboard');
    const mcp = JSON.parse(await readFile(join(output, 'mcp.json'), 'utf8'));
    assert.deepEqual(mcp.mcpServers['my-dashboard'].args, ['${PLUGIN_ROOT}/dist/server.mjs']);
    const html = await readFile(join(output, 'view.html'), 'utf8');
    assert.match(html, /Developer dashboard/);
    assert.match(html, /pages\/home/);
    assert.doesNotMatch(html, /pages\/counter|counter-change|open_counter/);
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(output, 'dist/server.mjs')], cwd: tmpdir() }));
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map(tool => tool.name), ['show_dashboard']);
    assert.equal(tools.tools[0]._meta.ui.resourceUri, 'ui://my-dashboard/app.html');
    const result = await client.callTool({ name: 'show_dashboard', arguments: {} });
    assert.equal(result.content[0].text, 'My Dashboard opened.');
    const resource = await client.readResource({ uri: 'ui://my-dashboard/app.html' });
    assert.equal(resource.contents[0].text, html);

    // Invalid inputs must fail before creating output or overwriting Ink source.
    await assert.rejects(exec(process.execPath, [cli, '--ink', ink, '--name', 'my-dashboard', '--out', ink]), /must not contain each other/);
    const invalidOutput = join(project, 'invalid');
    await assert.rejects(exec(process.execPath, [cli, '--ink', ink, '--name', 'my-dashboard', '--page', 'missing', '--out', invalidOutput]), /Initial page not found/);
    await assert.rejects(access(invalidOutput));
    assert.equal(await readFile(join(ink, 'pages/home.ink'), 'utf8'), '<page><text>Developer dashboard</text></page>');
  } finally {
    await client.close();
    await rm(project, { recursive: true, force: true });
  }
});
