import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildPlugin, verifyPlugin, PreviewError } from '@yodaos-pkg/aiui-mcpkit';

const exec = promisify(execFile);
let root, pluginDir, html;
before(async () => {
  root = await mkdtemp(join(tmpdir(), 'mcpkit-preview-'));
  const source = join(root, 'agent');
  pluginDir = join(root, 'plugin');
  await mkdir(source);
  await writeFile(join(source, 'app.json'), JSON.stringify({ pages: ['home', 'other', 'blank'] }));
  await writeFile(join(source, 'home.ink'), `<script setup>
export default {
  data: { count: 0, label: 'Loading' },
  onLoad(query) {
    if (query.fail) throw new Error('Agent startup failed');
    setTimeout(() => {
      this.setData({ count: Number(query.count || 7), label: 'Ready' });
      this.postMessage({ type: 'preview-ready', state: { count: this.data.count, label: this.data.label } });
    }, Number(query.delay || 100));
  }
};
</script>
<page><view style="background-color:#000000;padding:20px"><text style="color:#40ff5e;font-size:32px">{{label}} {{count}}</text></view></page>`);
  await writeFile(join(source, 'other.ink'), `<script setup>export default { onLoad() { this.postMessage({ type: 'other-ready' }); } };</script><page><text style="color:#40ff5e">Other page</text></page>`);
  await writeFile(join(source, 'blank.ink'), '<script setup>export default {};</script><page></page>');
  await buildPlugin({ source, name: 'preview-fixture', outputDir: pluginDir });
  html = await readFile(join(pluginDir, 'view.html'), 'utf8');
});
after(async () => { await rm(root, { recursive: true, force: true }); });

const readyWhen = { message: { type: 'preview-ready', state: { count: 42 } } };
const codes = result => result.diagnostics.map(d => d.code);
async function altered(name, transform) {
  const dir = join(root, name);
  await mkdir(dir);
  await writeFile(join(dir, 'view.html'), transform(html));
  return dir;
}

test('ESM verifies a real async Agent state and captures inline and fullscreen at the requested size', async () => {
  for (const displayMode of ['inline', 'fullscreen']) {
    const screenshotPath = join(root, 'screenshots', `${displayMode}.png`);
    const result = await verifyPlugin({ pluginDir, displayMode, viewport: { width: 480, height: 352 },
      deviceScaleFactor: 2, input: { count: 42, delay: 250 }, readyWhen, screenshotPath });
    assert.equal(result.status, 'passed', JSON.stringify(result));
    assert.equal(result.usable, true);
    assert.deepEqual(result.checks, { runtime: 'passed', firstFrame: 'passed', business: 'passed' });
    assert.deepEqual(result.readyMessage, { type: 'preview-ready', state: { count: 42, label: 'Ready' } });
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.screenshot.width, 960);
    assert.equal(result.screenshot.height, displayMode === 'fullscreen' ? 704 : 440);
    const png = await readFile(screenshotPath);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
  }
  const changed = await verifyPlugin({ pluginDir, input: { count: 43 }, readyWhen: { message: { type: 'preview-ready', state: { count: 43 } } },
    viewport: { width: 480, height: 352 }, deviceScaleFactor: 2, screenshotPath: join(root, 'changed.png') });
  assert.equal(changed.usable, true, JSON.stringify(changed));
  assert.notDeepEqual(await readFile(join(root, 'changed.png')), await readFile(join(root, 'screenshots/inline.png')), 'the final canvas must reflect changed business state');
});

test('page routes select another real Agent page', async () => {
  const result = await verifyPlugin({ pluginDir, page: 'other', displayMode: 'fullscreen', readyWhen: { message: { type: 'other-ready' } } });
  assert.equal(result.usable, true, JSON.stringify(result));
  assert.deepEqual(result.readyMessage, { type: 'other-ready' });
});

test('a PNG and startup marker do not imply business readiness', async () => {
  const result = await verifyPlugin({ pluginDir, screenshotPath: join(root, 'unchecked.png') });
  assert.equal(result.status, 'incomplete', JSON.stringify(result));
  assert.equal(result.usable, false);
  assert.equal(result.checks.business, 'skipped');
  assert.ok(result.screenshot);
  const timeout = await verifyPlugin({ pluginDir, input: { count: 41 }, readyWhen, timeouts: { business: 150 }, screenshotPath: join(root, 'wrong-state.png') });
  assert.equal(timeout.status, 'failed');
  assert.equal(timeout.usable, false);
  assert.ok(codes(timeout).includes('BUSINESS_READY_TIMEOUT'), JSON.stringify(timeout));
  assert.ok(timeout.screenshot, 'failure screenshots are diagnostic evidence only');
});

test('runtime and blank first-frame waits have separate stable timeout codes', async () => {
  const inert = await altered('inert', html => html.replace(/<script type="module">[\s\S]*?<\/script>/, ''));
  const startup = await verifyPlugin({ pluginDir: inert, timeouts: { runtime: 1000 } });
  assert.equal(startup.checks.runtime, 'failed');
  assert.ok(codes(startup).includes('RUNTIME_READY_TIMEOUT'), JSON.stringify(startup));
  const blank = await verifyPlugin({ pluginDir, page: 'blank', timeouts: { firstFrame: 200 } });
  assert.equal(blank.checks.runtime, 'passed', JSON.stringify(blank));
  assert.equal(blank.checks.firstFrame, 'failed');
  assert.ok(codes(blank).includes('FIRST_FRAME_TIMEOUT'));
});

test('runtime errors, unhandled rejections and console errors fail by default and can be collected', async () => {
  const crashed = await verifyPlugin({ pluginDir, input: { fail: true }, readyWhen });
  assert.equal(crashed.status, 'failed', JSON.stringify(crashed));
  assert.ok(codes(crashed).includes('CONSOLE_ERROR'), JSON.stringify(crashed));
  const broken = await altered('broken', html => html + `<script>
    setTimeout(() => { throw new Error('preview runtime boom'); }, 0);
    Promise.reject(new Error('preview rejection boom'));
    console.error('preview console boom');
  </script>`);
  const failed = await verifyPlugin({ pluginDir: broken, readyWhen });
  assert.equal(failed.status, 'failed', JSON.stringify(failed));
  for (const code of ['RUNTIME_ERROR', 'UNHANDLED_REJECTION', 'CONSOLE_ERROR']) assert.ok(codes(failed).includes(code), JSON.stringify(failed));
  const collected = await verifyPlugin({ pluginDir: broken, input: { count: 42 }, readyWhen, errorGate: 'collect' });
  assert.equal(collected.status, 'passed', JSON.stringify(collected));
  for (const code of ['RUNTIME_ERROR', 'UNHANDLED_REJECTION', 'CONSOLE_ERROR']) assert.ok(codes(collected).includes(code));
});

test('a runtime error after business readiness still fails the screenshot error gate', async () => {
  const late = await altered('late-error', html => html + `<script>
    window.addEventListener('mcpkit:message', () => requestAnimationFrame(() => console.error('late error')));
  </script>`);
  const result = await verifyPlugin({ pluginDir: late, input: { count: 42 }, readyWhen, screenshotPath: join(root, 'late.png') });
  assert.equal(result.status, 'failed', JSON.stringify(result));
  assert.ok(codes(result).includes('CONSOLE_ERROR'));
});

test('operational failures are structured, and invalid options reject before launching a browser', async () => {
  const unavailable = await verifyPlugin({ pluginDir, executablePath: join(root, 'missing-chromium') });
  assert.equal(unavailable.status, 'failed');
  assert.ok(codes(unavailable).includes('BROWSER_UNAVAILABLE'));
  for (const invalid of [{ viewport: { width: 0, height: 1 } }, { displayMode: 'pip' }, { timeouts: { runtime: 0 } },
    { readyWhen: { message: {} } }, { input: { bad: NaN } }, { page: '../home' }, { screenshotPath: 'image.jpg' }]) {
    await assert.rejects(verifyPlugin({ pluginDir, ...invalid }), error => error instanceof PreviewError && error.code === 'INVALID_OPTIONS');
  }
  const unwritable = await verifyPlugin({ pluginDir, input: { count: 42 }, readyWhen, screenshotPath: join(pluginDir, 'view.html', 'bad.png') });
  assert.equal(unwritable.status, 'failed');
  assert.ok(codes(unwritable).includes('SCREENSHOT_FAILED'));
});

test('repository CLI delegates to ESM and uses verification status for its exit code', async () => {
  const cli = resolve('scripts/verify-plugin.mjs');
  const args = [cli, pluginDir, '--input', '{"count":42}', '--ready-message', JSON.stringify(readyWhen.message), '--mode', 'fullscreen', '--width', '480', '--height', '352', '--screenshot', join(root, 'cli.png')];
  const { stdout } = await exec(process.execPath, args, { cwd: tmpdir() });
  assert.equal(JSON.parse(stdout).usable, true);
  await assert.rejects(exec(process.execPath, [cli, pluginDir]), error => {
    assert.equal(error.code, 1);
    assert.equal(JSON.parse(error.stdout).status, 'incomplete');
    return true;
  });
  await assert.rejects(exec(process.execPath, [cli, pluginDir, '--width', 'wrong']), error => {
    assert.equal(JSON.parse(error.stdout).diagnostics[0].code, 'INVALID_OPTIONS');
    return true;
  });
});
