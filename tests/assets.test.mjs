import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

const runtime = (await build({ entryPoints: ['src/runtime/bundle.ts'], bundle: true, write: false, format: 'esm' })).outputFiles[0].text;
const { decodeBundle } = await import(`data:text/javascript;base64,${Buffer.from(runtime).toString('base64')}`);

test('binary files preserve every byte, relative path, and UTF-8 BOM with useful size reports', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcpkit-assets-'));
  try {
    const source = join(root, 'agent'); await mkdir(source);
    await writeFile(join(source, 'app.json'), '{"pages":["home"]}');
    await writeFile(join(source, 'home.ink'), '<page><text>Binary</text></page>');
    const bytes = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
    await writeFile(join(source, 'unknown.bin'), bytes);
    const text = '\ufeff你好';
    await writeFile(join(source, 'hello.txt'), text);
    await writeFile(join(source, 'network.js'), 'fetch("https://api.example.com/data?token=DO_NOT_REPORT");');
    const result = await buildPlugin({ source, name: 'assets-test', outputDir: join(root, 'plugin') });
    const html = await readFile(result.files.view, 'utf8');
    assert.ok(html.includes(bytes.toString('base64')));
    const decoded = decodeBundle({ 'unknown.bin': { encoding: 'base64', data: bytes.toString('base64') },
      'hello.txt': { encoding: 'utf8', data: text } });
    assert.deepEqual(Buffer.from(decoded['unknown.bin']), bytes);
    assert.equal(decoded['hello.txt'], text);
    assert.equal(result.assets.files.find(file => file.path === 'unknown.bin').bytes, 256);
    assert.equal(result.assets.files.find(file => file.path === 'hello.txt').bytes, Buffer.byteLength(text));
    assert.equal(result.assets.totalBytes, result.assets.files.reduce((total, file) => total + file.bytes, 0));
    assert.equal(result.assets.viewBytes, Buffer.byteLength(html));
    assert.ok(result.assets.diagnostics.some(d => d.code === 'UNSUPPORTED_FORMAT' && d.path === 'unknown.bin'));
    assert.ok(result.assets.diagnostics.some(d => d.code === 'EXTERNAL_REFERENCE' && d.message.includes('https://api.example.com')));
    assert.ok(!JSON.stringify(result.assets).includes('DO_NOT_REPORT'));
    assert.deepEqual(result.inspectProtocol().resources[0]._meta.ui.csp, { connectDomains: [], resourceDomains: [] });
    // Failed rebuilds preserve existing output.
    await assert.rejects(buildPlugin({ source, name: 'assets-test', outputDir: result.outputDir, assetLimits: { maxAssetBytes: 100 } }), /unknown.bin.*256.*maxAssetBytes/);
    await assert.rejects(buildPlugin({ source, name: 'assets-test', outputDir: result.outputDir, assetLimits: { maxViewBytes: 100 } }), /View HTML.*maxViewBytes/);
    assert.equal(await readFile(result.files.view, 'utf8'), html);
    const invalidOutput = join(root, 'invalid');
    for (const assetLimits of [null, { maxViewBytes: 0 }, { maxAssetBytes: 1.2 }, { unexpected: 10 }]) {
      await assert.rejects(buildPlugin({ source, name: 'assets-test', outputDir: invalidOutput, assetLimits }), /assetLimits/);
      await assert.rejects(access(invalidOutput));
    }
    await writeFile(join(source, 'bad.json'), Buffer.from([0xff, 0x00]));
    await assert.rejects(buildPlugin({ source, name: 'assets-test', outputDir: invalidOutput }), /bad.json.*invalid UTF-8/);
    await assert.rejects(access(invalidOutput));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('fonts and images are embedded unchanged; generated font CSP does not change custom Views', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcpkit-fonts-'));
  try {
    const result = await buildPlugin({ source: resolve('tests/fixtures/assets'), name: 'font-assets', outputDir: root,
      uiCsp: { connectDomains: ['https://api.example.com'], resourceDomains: ['https://cdn.example.com'] },
      uiResources: [{ uri: 'ui://custom/view', name: 'Custom', html: '<html>Custom</html>', _meta: { ui: { csp: { resourceDomains: [] } } } }],
    });
    const html = await readFile(result.files.view, 'utf8');
    for (const path of ['assets/sample.png', 'assets/fixture.ttf']) {
      const bytes = await readFile(join('tests/fixtures/assets', path));
      assert.ok(html.includes(bytes.toString('base64')));
      assert.equal(result.assets.files.find(file => file.path === path).encoding, 'base64');
    }
    const resources = result.inspectProtocol().resources;
    assert.deepEqual(resources[0]._meta.ui.csp, { connectDomains: ['https://api.example.com'], resourceDomains: ['https://cdn.example.com', 'blob:'] });
    assert.deepEqual(resources[1]._meta.ui.csp.resourceDomains, []);
    assert.ok(result.assets.diagnostics.some(d => d.message.includes('font-src blob:')));
  } finally { await rm(root, { recursive: true, force: true }); }
});
