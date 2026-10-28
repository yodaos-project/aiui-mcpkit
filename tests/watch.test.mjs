import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, rm, rename, readdir, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, expect } from '@playwright/test';
import { watchPlugin, inspectBuild } from '@yodaos-pkg/aiui-mcpkit';

const exec = promisify(execFile);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate) {
  const end = Date.now() + 30000;
  while (Date.now() < end) { const result = await predicate(); if (result) return result; await pause(30); }
  throw new Error('Timed out waiting for watcher state');
}
const pageSource = version => `<script def>{"tool":"open_watch","description":"Watch fixture","schema":{"data":{"type":"object","properties":{"initialCount":{"type":"integer"}}}}}</script>
<script setup>export default {
  data: { count: 0 },
  onLoad(input) { this.setData({ count: Number(input.initialCount || 0) }); this.postMessage({ type: 'watch-ready', version: '${version}', count: this.data.count }); },
  increment() { this.setData({ count: this.data.count + 1 }); this.postMessage({ type: 'watch-count', count: this.data.count }); }
};</script><page><view style="padding:16px;background-color:#000000"><text style="color:#40ff5e;font-size:24px">${version} {{count}}</text><button bindtap="increment">Increment</button></view></page>`;
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'mcpkit-watch-'));
  const source = join(root, 'agent'), outputDir = join(source, 'generated');
  await mkdir(source);
  await writeFile(join(source, 'app.json'), JSON.stringify({ pages: ['home'] }));
  await writeFile(join(source, 'home.ink'), pageSource('A'));
  return { root, source, outputDir, name: 'watch-fixture' };
}

test('content watch rebuilds atomic saves, additions/deletions, rejects failures, and recovers without output loops', async () => {
  const project = await fixture();
  const events = [];
  let watcher;
  try {
    watcher = await watchPlugin({ ...project, preview: false, pollInterval: 30, debounce: 20, onEvent: event => events.push(event) });
    assert.equal(watcher.state.phase, 'ready', JSON.stringify(watcher.state));
    const first = watcher.state.build.id;
    const before = await readFile(join(project.outputDir, 'view.html'));
    await writeFile(join(project.source, 'app.json'), '{ broken');
    await until(() => watcher.state.phase === 'failed');
    assert.equal(watcher.state.build.id, first);
    assert.deepEqual(await readFile(join(project.outputDir, 'view.html')), before);
    assert.equal(watcher.state.action, 'none');
    assert.match(watcher.state.diagnostics[0].message, /JSON|property|position/i);
    assert.equal((await inspectBuild(project.outputDir)).integrity, 'ok');
    await writeFile(join(project.source, 'app.json'), JSON.stringify({ pages: ['home'], name: 'Recovered' }));
    await until(() => watcher.state.phase === 'ready' && watcher.state.build.id !== first);
    assert.equal(watcher.state.recovered, true);
    assert.equal(watcher.state.action, 'refresh-manifest');
    assert.ok(watcher.state.changes.some(change => change.kind === 'manifest'));
    assert.match(watcher.state.hostSteps.join(' '), /cache/);
    const recovered = watcher.state.build.id;
    await writeFile(join(project.source, 'home.ink.tmp'), pageSource('B'));
    await rename(join(project.source, 'home.ink.tmp'), join(project.source, 'home.ink'));
    await until(() => watcher.state.phase === 'ready' && watcher.state.build.id !== recovered);
    assert.equal(watcher.state.action, 'reload-view');
    assert.equal((await inspectBuild(project.outputDir, true)).source, 'current');
    let previous = watcher.state.build.id;
    await writeFile(join(project.source, 'new.css'), 'text { color: red }');
    await until(() => watcher.state.phase === 'ready' && watcher.state.build.id !== previous);
    previous = watcher.state.build.id;
    await rm(join(project.source, 'new.css'));
    await until(() => watcher.state.phase === 'ready' && watcher.state.build.id !== previous);
    const count = events.length;
    await pause(350);
    assert.equal(events.length, count, 'generated files and staging directories must not retrigger builds');
    assert.deepEqual(await readdir(join(project.source, '.mcpkit')), []);
    const snapshot = watcher.state;
    snapshot.build.id = 'mutated';
    assert.notEqual(watcher.state.build.id, 'mutated');
  } finally { await watcher?.close(); await rm(project.root, { recursive: true, force: true }); }
});

test('edits during a build supersede its result and only the latest generation is published', async () => {
  const project = await fixture();
  const events = [];
  let watcher;
  try {
    watcher = await watchPlugin({ ...project, preview: false, pollInterval: 30, onEvent: event => events.push(event) });
    const initial = watcher.state.build.id;
    const oldHtml = await readFile(join(project.outputDir, 'view.html'));
    let editing;
    const rebuilding = watcher.rebuild();
    await until(() => watcher.state.phase === 'building');
    editing = writeFile(join(project.source, 'home.ink'), pageSource('Intermediate')).then(async () => {
      assert.deepEqual(await readFile(join(project.outputDir, 'view.html')), oldHtml);
      await writeFile(join(project.source, 'home.ink'), pageSource('Latest'));
    });
    await editing;
    await rebuilding;
    assert.ok(events.some(event => event.phase === 'superseded'), JSON.stringify(events));
    assert.equal(watcher.state.phase, 'ready');
    assert.notEqual(watcher.state.build.id, initial);
    assert.match(await readFile(join(project.outputDir, 'view.html'), 'utf8'), /Latest/);
    assert.equal((await inspectBuild(project.outputDir, true)).source, 'current');
    assert.equal(events.filter(event => event.phase === 'ready').length, 2, 'intermediate build was never published');
    const closingBuild = watcher.rebuild();
    await watcher.close();
    await closingBuild;
    assert.equal(watcher.state.phase, 'closed');
    await assert.rejects(watcher.rebuild(), /closed/);
    const afterClose = await readFile(join(project.outputDir, 'view.html'));
    await writeFile(join(project.source, 'home.ink'), pageSource('Closed'));
    await pause(150);
    assert.deepEqual(await readFile(join(project.outputDir, 'view.html')), afterClose);
  } finally { await watcher?.close(); await rm(project.root, { recursive: true, force: true }); }
});

test('server imports and tool contracts select restart/rediscovery, with source locations on build failure', async () => {
  const project = await fixture();
  const handlers = join(project.root, 'handlers.ts');
  const dependency = join(project.root, 'price.ts');
  let watcher;
  try {
    const definition = '<script def>{"tool":"quote","description":"Quote","schema":{"data":{"type":"object"},"output":{"type":"object"}}}</script><page><text>Quote</text></page>';
    await writeFile(join(project.source, 'home.ink'), definition);
    await writeFile(handlers, "import { price } from './price.js'; export const handlers = { quote: () => ({ structuredContent: { price } }) };");
    await writeFile(dependency, 'export const price = 10;');
    watcher = await watchPlugin({ ...project, handlers, preview: false, pollInterval: 30, debounce: 10 });
    assert.equal(watcher.state.phase, 'ready', JSON.stringify(watcher.state));
    const before = watcher.state.build.id;
    await writeFile(dependency, 'export const price = 20;');
    await until(() => watcher.state.phase === 'ready' && watcher.state.build.id !== before);
    assert.equal(watcher.state.action, 'restart-server');
    const dependencyPath = await realpath(dependency);
    assert.ok(watcher.state.changes.some(change => change.path === dependencyPath && change.kind === 'server'), JSON.stringify(watcher.state));
    const server = await readFile(join(project.outputDir, 'dist/server.mjs'));
    await writeFile(handlers, 'export const handlers = { quote: ; };');
    await until(() => watcher.state.phase === 'failed');
    const errors = watcher.state.diagnostics;
    assert.ok(errors.some(error => error.line === 1 && error.column > 0), JSON.stringify(watcher.state));
    assert.equal(await realpath(errors[0].path), await realpath(handlers));
    assert.deepEqual(await readFile(join(project.outputDir, 'dist/server.mjs')), server);
    await writeFile(handlers, 'export const handlers = { quote: () => ({ structuredContent: {} }) };');
    await until(() => watcher.state.phase === 'ready');
    const id = watcher.state.build.id;
    await writeFile(join(project.source, 'home.ink'), definition.replace('"description":"Quote"', '"description":"New quote"'));
    await until(() => watcher.state.phase === 'ready' && watcher.state.build.id !== id);
    assert.equal(watcher.state.action, 'refresh-manifest');
  } finally { await watcher?.close(); await rm(project.root, { recursive: true, force: true }); }
});

test('loopback development preview loads real Ink, keeps failed builds visible, and resets App state on reload', async () => {
  const project = await fixture();
  let watcher, browser;
  try {
    watcher = await watchPlugin({ ...project, pollInterval: 30, debounce: 10, preview: { input: { initialCount: 5 } } });
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.messages = [];
      window.addEventListener('mcpkit:message', event => window.messages.push(event.detail));
    });
    await page.goto(watcher.previewUrl);
    const frame = page.frameLocator('iframe');
    await expect(frame.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
    const first = watcher.state.build.id;
    await expect(frame.locator('meta[name=mcpkit-build-id]')).toHaveAttribute('content', first);
    await until(() => page.frames()[1].evaluate(() => window.messages.some(message => message.type === 'watch-ready' && message.version === 'A' && message.count === 5)));
    // The visible button changes live Page state before a source-driven reload.
    await frame.locator('#ink').click({ position: { x: 190, y: 65 } });
    await until(() => page.frames()[1].evaluate(() => window.messages.some(message => message.type === 'watch-count' && message.count === 6)));
    await page.frames()[1].evaluate(() => localStorage.setItem('watch-storage', 'kept'));
    const response = await fetch(new URL('__mcpkit/status', watcher.previewUrl));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    await writeFile(join(project.source, 'app.json'), '{broken');
    await until(() => watcher.state.phase === 'failed');
    await expect(page.locator('#status')).toContainText('failed');
    await expect(frame.locator('meta[name=mcpkit-build-id]')).toHaveAttribute('content', first);
    await writeFile(join(project.source, 'home.ink'), pageSource('B'));
    await writeFile(join(project.source, 'app.json'), JSON.stringify({ pages: ['home'] }));
    await until(() => watcher.state.phase === 'ready' && watcher.state.build.id !== first);
    await expect(frame.locator('meta[name=mcpkit-build-id]')).toHaveAttribute('content', watcher.state.build.id, { timeout: 15000 });
    await expect(frame.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
    await until(() => page.frames()[1].evaluate(() => window.messages.some(message => message.type === 'watch-ready' && message.version === 'B' && message.count === 5)));
    assert.equal(await page.frames()[1].evaluate(() => localStorage.getItem('watch-storage')), 'kept');
    assert.equal(await page.frames()[1].evaluate(() => window.messages.some(message => message.type === 'watch-count')), false);
    await expect(page.locator('#status')).toContainText('resets App/Page memory');
  } finally { await browser?.close(); await watcher?.close(); await rm(project.root, { recursive: true, force: true }); }
});

test('CLI uses the ESM watcher, reports versions/failures, and shuts down on SIGTERM', async () => {
  const project = await fixture();
  let child;
  try {
    const events = [];
    let output = '', stderr = '';
    child = spawn(process.execPath, [resolve('scripts/build-plugin.mjs'), project.source, '--name', project.name, '--out', project.outputDir, '--watch', '--no-preview'], { cwd: tmpdir() });
    child.stdout.on('data', data => {
      output += data;
      let index;
      while ((index = output.indexOf('\n')) !== -1) { events.push(JSON.parse(output.slice(0, index))); output = output.slice(index + 1); }
    });
    child.stderr.on('data', data => { stderr += data; });
    await until(() => events.some(event => event.phase === 'ready'));
    await writeFile(join(project.source, 'app.json'), '{broken');
    await until(() => events.some(event => event.phase === 'failed'));
    assert.equal(events.find(event => event.phase === 'failed').build.id, events.find(event => event.phase === 'ready').build.id, stderr);
    const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
    child.kill('SIGTERM');
    assert.deepEqual(await exited, { code: 0, signal: null });
    assert.ok(events.some(event => event.phase === 'closed'));
    assert.match((await exec(process.execPath, [resolve('scripts/watch-examples.mjs'), '--help'])).stdout, /counter\|business/);
  } finally { if (child?.exitCode === null) child.kill('SIGKILL'); await rm(project.root, { recursive: true, force: true }); }
});

test('watch validates transactional output, timers and preview options before building', async () => {
  const project = await fixture();
  try {
    for (const invalid of [{ typesFile: join(project.root, 'tools.d.ts') }, { pollInterval: 0 }, { debounce: -1 },
      { preview: { port: -1 } }, { preview: { displayMode: 'bad' } }, { preview: { input: [] } }]) {
      await assert.rejects(watchPlugin({ ...project, ...invalid }));
    }
    await mkdir(project.outputDir);
    await writeFile(join(project.outputDir, 'unrelated.txt'), 'preserve');
    await assert.rejects(watchPlugin({ ...project, preview: false }), /empty outputDir/);
    assert.equal(await readFile(join(project.outputDir, 'unrelated.txt'), 'utf8'), 'preserve');
  } finally { await rm(project.root, { recursive: true, force: true }); }
});

test('a failed first build recovers when a watched external directory gains a missing import', async () => {
  const project = await fixture();
  const shared = join(project.root, 'shared');
  let watcher;
  try {
    await mkdir(shared);
    const handlers = join(shared, 'handlers.ts');
    await writeFile(handlers, "import { value } from './missing.js'; export const handlers = { quote: () => ({ structuredContent: { value } }) };");
    await writeFile(join(project.source, 'home.ink'), '<script def>{"tool":"quote","description":"Quote","schema":{"data":{"type":"object"},"output":{"type":"object"}}}</script><page><text>Quote</text></page>');
    watcher = await watchPlugin({ ...project, handlers, watchPaths: [shared], preview: false, pollInterval: 30, debounce: 10 });
    assert.equal(watcher.state.phase, 'failed');
    assert.equal(watcher.state.build, undefined);
    await assert.rejects(readFile(join(project.outputDir, 'view.html')));
    await writeFile(join(shared, 'missing.js'), 'export const value = 1;');
    await until(() => watcher.state.phase === 'ready');
    assert.equal(watcher.state.recovered, true);
    assert.equal((await inspectBuild(project.outputDir)).integrity, 'ok');
  } finally { await watcher?.close(); await rm(project.root, { recursive: true, force: true }); }
});

test('Worker changes require a server restart and publication removes stale Worker files', async () => {
  const project = await fixture();
  let watcher;
  try {
    await mkdir(join(project.source, 'services'));
    await writeFile(join(project.source, 'services/main.js'), 'export default {}; // first');
    await writeFile(join(project.source, 'shared.js'), 'export const value = 1;');
    await writeFile(join(project.source, 'services/old.js'), 'old');
    await writeFile(join(project.source, 'app.json'), JSON.stringify({ pages: ['home'], agentWorkers: [{ name: 'main', script: 'services/main.js' }] }));
    watcher = await watchPlugin({ ...project, worker: { name: 'main' }, preview: false, pollInterval: 30, debounce: 10 });
    const first = watcher.state.build.id;
    await writeFile(join(project.source, 'services/main.js'), 'export default {}; // second');
    await rm(join(project.source, 'services/old.js'));
    await until(() => watcher.state.phase === 'ready' && watcher.state.build.id !== first);
    assert.equal(watcher.state.action, 'restart-server');
    assert.match(await readFile(join(project.outputDir, 'worker-app/services/main.js'), 'utf8'), /second/);
    await assert.rejects(readFile(join(project.outputDir, 'worker-app/services/old.js')));
    assert.equal((await inspectBuild(project.outputDir)).integrity, 'ok');
    const second = watcher.state.build.id;
    await writeFile(join(project.source, 'shared.js'), 'export const value = 2;');
    await until(() => watcher.state.phase === 'ready' && watcher.state.build.id !== second);
    assert.equal(watcher.state.action, 'restart-server');
  } finally { await watcher?.close(); await rm(project.root, { recursive: true, force: true }); }
});
