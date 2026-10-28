import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { buildPlugin, inspectBuild, diagnosePlugin } from '@yodaos-pkg/aiui-mcpkit';

const capabilities = { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } };
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'mcpkit-diagnostics-'));
  const source = join(root, 'agent');
  await mkdir(source);
  await writeFile(join(source, 'app.json'), JSON.stringify({ pages: ['home'] }));
  await writeFile(join(source, 'home.ink'), '<page><text>Build A</text></page>');
  return { root, source, name: 'diagnostics-test', outputDir: join(root, 'build') };
}
const codes = result => result.findings.map(finding => finding.code);

test('build identity is deterministic, tracks source/options, and keeps stable resource references across upgrades', async () => {
  const f = await fixture();
  try {
    const first = await buildPlugin(f);
    const same = await buildPlugin({ ...f, outputDir: join(f.root, 'other-output') });
    assert.deepEqual(same.build, first.build);
    assert.equal((await inspectBuild(f.outputDir, true)).source, 'current');
    const html = await readFile(first.files.view, 'utf8');
    assert.ok(html.includes(`<meta name="mcpkit-build-id" content="${first.build.id}">`));
    assert.ok(!html.includes(f.source), 'local provenance must not leak into UI');
    const manifest = JSON.parse(await readFile(first.files.build, 'utf8'));
    assert.deepEqual(manifest.build, first.build);
    assert.equal(manifest.resources[0], 'ui://diagnostics-test/app.html');
    assert.equal(first.inspectProtocol().tools[0]._meta.mcpkit.build.id, first.build.id);
    // Secrets and generated/ignored files are not source freshness signals.
    await writeFile(join(f.source, '.env'), 'PRIVATE_VALUE');
    assert.equal((await inspectBuild(f.outputDir, true)).source, 'current');
    await writeFile(join(f.source, 'added.js'), 'export const added = true;');
    assert.equal((await inspectBuild(f.outputDir, true)).source, 'changed');
    assert.ok(codes(await diagnosePlugin({ buildDir: f.outputDir })).includes('REBUILD_REQUIRED'));
    await rm(join(f.source, 'added.js'));
    const upgrade = await buildPlugin({ ...f, version: '2.0.0' });
    assert.notEqual(upgrade.build.id, first.build.id);
    assert.deepEqual(upgrade.tools.map(t => t.resourceUri), first.tools.map(t => t.resourceUri));
    await writeFile(join(f.source, 'home.ink'), '<page><text>Build B</text></page>');
    const changed = await buildPlugin({ ...f, version: '2.0.0' });
    assert.notEqual(changed.build.id, upgrade.build.id);
    assert.equal((await inspectBuild(f.outputDir, true)).source, 'current');
    await rm(join(f.source, 'home.ink'));
    assert.equal((await inspectBuild(f.outputDir, true)).source, 'changed');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('live server identifies both its own build and replaced resource bytes without changing old URIs', async () => {
  const f = await fixture();
  const client = new Client({ name: 'build-test', version: '1' }, { capabilities });
  try {
    const first = await buildPlugin(f);
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [first.files.server] }));
    const tool = (await client.listTools()).tools[0];
    const uri = tool._meta.ui.resourceUri;
    assert.deepEqual(tool._meta.mcpkit.build, first.build);
    assert.deepEqual((await client.listResources()).resources[0]._meta.mcpkit.build, first.build);
    assert.deepEqual((await client.callTool({ name: tool.name, arguments: {} }))._meta.mcpkit.build, first.build);
    assert.equal((await client.readResource({ uri })).contents[0]._meta.mcpkit.viewBuildId, first.build.id);
    await writeFile(join(f.source, 'home.ink'), '<page><text>Build B</text></page>');
    const second = await buildPlugin({ ...f, outputDir: join(f.root, 'second') });
    // Simulates updating view.html without restarting the already running server.
    await cp(second.files.view, first.files.view);
    const mixed = (await client.readResource({ uri })).contents[0];
    assert.equal(mixed._meta.mcpkit.build.id, first.build.id);
    assert.equal(mixed._meta.mcpkit.viewBuildId, second.build.id);
    assert.ok(mixed.text.includes(second.build.id));
    assert.deepEqual((await inspectBuild(f.outputDir)).changedArtifacts, ['view.html']);
  } finally { await client.close(); await rm(f.root, { recursive: true, force: true }); }
});

test('diagnostics separate source, install, running server, existing card and possible host caching', async () => {
  const f = await fixture();
  try {
    const built = await buildPlugin(f);
    const installedDir = join(f.root, 'installed');
    await cp(f.outputDir, installedDir, { recursive: true });
    const options = { buildDir: f.outputDir, installedDir, serverBuildId: built.build.id, viewBuildId: built.build.id };
    assert.deepEqual(codes(await diagnosePlugin(options)), ['CURRENT']);
    assert.deepEqual(codes(await diagnosePlugin({ ...options, serverBuildId: 'old' })), ['SERVER_RELOAD_REQUIRED']);
    assert.deepEqual(codes(await diagnosePlugin({ ...options, viewBuildId: 'old', newCard: false })), ['EXISTING_CARD']);
    assert.deepEqual(codes(await diagnosePlugin({ ...options, viewBuildId: 'old', newCard: true })), ['HOST_CACHE_SUSPECTED']);
    assert.deepEqual(codes(await diagnosePlugin({ ...options, viewBuildId: 'old' })), ['VIEW_STALE']);
    assert.deepEqual(codes(await diagnosePlugin({ ...options, serverBuildId: undefined, viewBuildId: undefined })), ['SERVER_NOT_OBSERVED', 'VIEW_NOT_OBSERVED']);
    await writeFile(join(installedDir, 'view.html'), 'partial update');
    assert.deepEqual(codes(await diagnosePlugin(options)), ['INSTALL_UPDATE_REQUIRED']);
    await rm(join(installedDir, 'build.json'));
    assert.equal((await inspectBuild(installedDir)).integrity, 'legacy');
    assert.deepEqual(codes(await diagnosePlugin(options)), ['INSTALL_UPDATE_REQUIRED', 'SERVER_RELOAD_REQUIRED', 'VIEW_REFRESH_REQUIRED']);
    await writeFile(join(f.source, 'home.ink'), 'changed');
    assert.ok(codes(await diagnosePlugin(options)).includes('REBUILD_REQUIRED'));
    await rm(f.source, { recursive: true });
    assert.equal((await inspectBuild(f.outputDir, true)).source, 'unavailable');
    const invalid = JSON.parse(await readFile(join(f.outputDir, 'build.json'), 'utf8'));
    delete invalid.artifacts['view.html'];
    await writeFile(join(f.outputDir, 'build.json'), JSON.stringify(invalid));
    await assert.rejects(inspectBuild(f.outputDir), /invalid build.json/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
