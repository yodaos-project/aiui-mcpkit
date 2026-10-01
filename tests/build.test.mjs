import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

const exec = promisify(execFile);

const cli = resolve('scripts/build-plugin.mjs');

test('ESM API packages an agent outside the package checkout', async () => {
  const project = await mkdtemp(join(tmpdir(), 'mcpkit-developer-'));
  const ink = join(project, 'ink');
  const output = join(project, 'dist', 'my-dashboard');
  const client = new Client({ name: 'builder-test', version: '1' });
  try {
    await mkdir(join(ink, 'pages'), { recursive: true });
    await writeFile(join(ink, 'app.json'), JSON.stringify({ name: 'My Dashboard', pages: ['pages/home'] }));
    await writeFile(join(ink, 'pages/home.ink'), '<page><text>Developer dashboard</text></page>');
    const buildResult = await buildPlugin({ source: ink, outputDir: output, name: 'my-dashboard', tool: 'show_dashboard', version: '1.2.3' });
    assert.equal(buildResult.outputDir, output);
    assert.equal(buildResult.requestPolicy.requestTimeoutMs, 60000);
    assert.equal(buildResult.marketplaceName, 'my-dashboard-local');
    assert.equal(buildResult.page, 'pages/home');
    assert.equal(buildResult.files.view, join(output, 'view.html'));
    const manifest = JSON.parse(await readFile(join(output, 'plugin.json'), 'utf8'));
    assert.equal(manifest.name, 'my-dashboard');
    assert.equal(manifest.version, '1.2.3');
    assert.equal(manifest.description, 'Open My Dashboard, an interactive AIUI Agent.');
    assert.equal(manifest.extensions['com.openai'].interface.displayName, 'My Dashboard');
    const mcp = JSON.parse(await readFile(join(output, 'mcp.json'), 'utf8'));
    assert.deepEqual(mcp.mcpServers['my-dashboard'].args, ['${PLUGIN_ROOT}/dist/server.mjs']);
    const marketplace = JSON.parse(await readFile(join(output, '.agents/plugins/marketplace.json'), 'utf8'));
    assert.equal(marketplace.name, 'my-dashboard-local');
    assert.deepEqual(marketplace.plugins, [{
      name: 'my-dashboard',
      source: { source: 'local', path: './' },
      policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
      category: 'Developer Tools',
    }]);
    assert.equal(resolve(output, marketplace.plugins[0].source.path), output);
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

    // Invalid inputs must fail before creating output or overwriting agent source.
    await assert.rejects(buildPlugin({ source: ink, name: 'my-dashboard', outputDir: ink }), /must not contain each other/);
    const invalidOutput = join(project, 'invalid');
    await assert.rejects(buildPlugin({ source: ink, name: 'my-dashboard', outputDir: invalidOutput, requestPolicy: { totalTimeoutMs: 0 } }), /totalTimeoutMs/);
    await assert.rejects(access(invalidOutput));
    await assert.rejects(buildPlugin({ source: ink, name: 'my-dashboard', page: 'missing', outputDir: invalidOutput }), /Initial page not found/);
    await assert.rejects(access(invalidOutput));
    assert.equal(await readFile(join(ink, 'pages/home.ink'), 'utf8'), '<page><text>Developer dashboard</text></page>');
  } finally {
    await client.close();
    await rm(project, { recursive: true, force: true });
  }
});


test('local CLI accepts positional source and delegates to the ESM API', async () => {
  const project = await mkdtemp(join(tmpdir(), 'mcpkit-cli-'));
  try {
    const source = join(project, 'agent');
    await mkdir(join(source, 'pages'), { recursive: true });
    await writeFile(join(source, 'app.json'), JSON.stringify({ name: 'CLI Agent', pages: ['pages/home'] }));
    await writeFile(join(source, 'pages/home.ink'), '<page><text>CLI agent</text></page>');
    const output = join(project, 'dist/cli-agent');
    await exec(process.execPath, [cli, './agent', '--name', 'cli-agent'], { cwd: project });
    assert.equal(JSON.parse(await readFile(join(output, 'plugin.json'), 'utf8')).name, 'cli-agent');
    // Omitted source defaults to the caller's working directory.
    const defaultOutput = join(project, 'default-source');
    await exec(process.execPath, [cli, '--name', 'cli-agent', '--out', defaultOutput], { cwd: source });
    assert.equal(JSON.parse(await readFile(join(defaultOutput, 'plugin.json'), 'utf8')).name, 'cli-agent');
    await assert.rejects(exec(process.execPath, [cli, '--ink', source, '--name', 'cli-agent']), /Unknown option/);
    await assert.rejects(exec(process.execPath, [cli, source, source, '--name', 'cli-agent']), /at most one source/);
    await assert.rejects(exec(process.execPath, [cli, source]), /--name is required/);
  } finally { await rm(project, { recursive: true, force: true }); }
});
