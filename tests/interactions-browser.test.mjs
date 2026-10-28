import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { build } from 'esbuild';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildPlugin, verifyPlugin, validateInteractionRecord } from '@yodaos-pkg/aiui-mcpkit';

let root, pluginDir, browser, server, base, record, originalScreenshot;
const artifacts = process.env.INK_SCREENSHOTS;
before(async () => {
  root = await mkdtemp(join(tmpdir(), 'mcpkit-interactions-'));
  const source = join(root, 'agent'); await mkdir(source);
  await writeFile(join(source, 'app.json'), JSON.stringify({ pages: ['home'] }));
  await writeFile(join(source, 'home.ink'), `<script setup>
export default {
  data:{count:0,selected:'None',expanded:false},
  snapshot(){return {count:this.data.count,selected:this.data.selected,expanded:this.data.expanded};},
  report(){this.postMessage({type:'mcpkit:inspect',kind:'binding',name:'selection',visibility:'public',value:this.snapshot()});},
  async onLoad(query){
    this.legacy=query.legacy;
    this.privateNote='PRIVATE_PAGE_NOTE'; this.setData({count:Number(query.count||0)}); this.report();
    this.context=await getApp().getAgent().provideContext({key:'selection',description:'Selection',value:this.snapshot()});
  },
  async select(){
    if(this.legacy){this.postMessage({type:'mcpkit:call-tool',requestId:'selection-1',name:'reserve_product',arguments:{sku:'DEMO'}});return;}
    const result=await getApp().getAgent().callTool('reserve_product',{sku:'DEMO'});
    this.setData({selected:result.structuredContent.sku}); this.report(); await this.context.update(this.snapshot());
  },
  async expand(){this.setData({expanded:!this.data.expanded}); this.report(); await this.context.update(this.snapshot());},
  async onMessage(event){
    if(event.data.type==='mcpkit:tool-state'&&event.data.state==='ready'){
      this.setData({selected:event.data.result.structuredContent.sku});this.report();await this.context.update(this.snapshot());return;
    }
    if(event.data.type!=='mcpkit:tool-result')return;
    this.setData({count:event.data.structuredContent.count});this.report();await this.context.update(this.snapshot());
  },
  onUnload(){this.context?.dispose();}
};
</script><page><view style="position:absolute;left:0;top:0;width:300px">
<button style="width:200px;height:44px" bindtap="select">Select product</button>
<button style="width:200px;height:44px;margin-top:12px" bindtap="expand">Expand</button>
<text style="color:#40ff5e;font-size:24px">{{count}} {{selected}} {{expanded}}</text>
</view></page>`);
  const built = await buildPlugin({ source, name: 'recording-fixture', outputDir: join(root, 'plugin'), inspector: { recording: {
    allow: { input: ['/count', '/legacy'], state: ['/count', '/selected', '/expanded'], context: ['/structuredContent'],
      result: ['/content', '/structuredContent', '/invocation'], toolInput: ['/sku'], toolResult: ['/content', '/structuredContent'] },
  } } });
  pluginDir = built.outputDir;
  const html = await readFile(built.files.view, 'utf8');
  const harness = (await build({ stdin: { resolveDir: process.cwd(), contents: `
import {AppBridge,PostMessageTransport} from '@modelcontextprotocol/ext-apps/app-bridge';
const frame=document.querySelector('iframe');window.contexts=[];window.calls=[];
const bridge=new AppBridge(null,{name:'recording-host',version:'1'},{serverTools:{},updateModelContext:{text:{},structuredContent:{}}},{hostContext:{displayMode:'inline',availableDisplayModes:['inline','fullscreen']}});
bridge.oninitialized=()=>bridge.sendToolInput({arguments:{count:2,...(location.search?{legacy:true}:{})}});
bridge.onupdatemodelcontext=async value=>{window.contexts.push(value);return {};};
bridge.oncalltool=async params=>{window.calls.push(params);return {content:[],structuredContent:{sku:params.arguments.sku},_meta:{uiOnly:{private:'PRIVATE_BUSINESS'}}};};
window.bridge=bridge;await bridge.connect(new PostMessageTransport(frame.contentWindow,frame.contentWindow));frame.src='/view';
` }, bundle: true, write: false, platform: 'browser', format: 'esm' })).outputFiles[0].text;
  server = createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(req.url === '/view' ? html : `<style>html,body{margin:0}iframe{border:0;width:100vw;height:100vh}</style><iframe></iframe><script type="module">${harness}</script>`); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  const executablePath = process.env.CHROMIUM_PATH;
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true, force: true }); });

test('record selection, expansion, host results and modes; replay exact state, tool requests, context and canvas', async () => {
  const page = await browser.newPage({ viewport: { width: 420, height: 280 }, acceptDownloads: true });
  try {
    await page.goto(base);
    const frame = page.frameLocator('iframe');
    await frame.locator('body[data-ready=true]').waitFor({ timeout: 20000 });
    await expect.poll(() => page.evaluate(() => window.contexts.length)).toBe(1);
    await frame.locator('#ink').click({ position: { x: 80, y: 22 } });
    await expect.poll(() => page.evaluate(() => window.contexts.length)).toBe(2);
    await frame.locator('#ink').click({ position: { x: 80, y: 78 } });
    await expect.poll(() => page.evaluate(() => window.contexts.length)).toBe(3);
    await page.evaluate(() => window.bridge.setHostContext({ displayMode: 'fullscreen' }));
    await expect(frame.locator('body')).toHaveAttribute('data-mode', 'fullscreen');
    await page.evaluate(() => window.bridge.sendToolResult({ content: [], structuredContent: { count: 9 },
      _meta: { aiui: { page: 'home', query: { count: 2 }, tool: 'update_count' }, uiOnly: { note: 'PRIVATE_LAUNCH_RESULT' } } }));
    await expect.poll(() => page.evaluate(() => window.contexts.length)).toBe(4);
    record = await frame.locator('body').evaluate(() => window.__mcpkitInteractions.snapshot());
    validateInteractionRecord(record);
    assert.equal(record.mocks[0].name, 'reserve_product');
    assert.equal(record.steps.find(step => step.type === 'tool-result').result.invocation.tool, 'update_count');
    assert.ok(record.steps.some(step => step.type === 'display-mode'));
    assert.equal(record.steps.filter(step => step.type === 'click').length, 2);
    assert.ok(!JSON.stringify(record).includes('PRIVATE_BUSINESS'));
    assert.ok(!JSON.stringify(record).includes('PRIVATE_PAGE_NOTE'));
    assert.ok(!JSON.stringify(record).includes('PRIVATE_LAUNCH_RESULT'));
    await page.waitForTimeout(100);
    originalScreenshot = await frame.locator('#ink').screenshot(artifacts ? { path: join(artifacts, 'interactions-recorded.png') } : {});
    await frame.getByRole('button', { name: 'Inspector', exact: true }).click();
    const download = page.waitForEvent('download');
    await frame.getByRole('button', { name: 'Export interaction recording' }).click();
    assert.deepEqual(JSON.parse(await readFile(await (await download).path(), 'utf8')), record);
  } finally { await page.close(); }
  for (let run = 0; run < 2; run++) {
    const screenshotPath = artifacts ? join(artifacts, `interactions-replay-${run}.png`) : join(root, `replay-${run}.png`);
    const result = await verifyPlugin({ pluginDir, replay: record, screenshotPath, timeouts: { business: 2000 } });
    assert.equal(result.status, 'passed', JSON.stringify(result));
    assert.equal(result.usable, true);
    assert.deepEqual(result.replay.checks, { state: 4, toolRequests: 1, modelContext: 4 });
    assert.equal(result.replay.completedSteps, record.steps.length);
    assert.ok((await readFile(screenshotPath)).equals(originalScreenshot), 'replayed canvas must match the recorded canvas in the same browser');
  }
});

test('semantic regressions fail with step diagnostics even when screenshots render', async () => {
  assert.ok(record, 'round-trip fixture must be recorded first');
  for (const channel of ['state', 'context', 'mock-input', 'mock-result', 'extra-mock', 'missing-mock']) {
    const changed = structuredClone(record);
    if (channel === 'state') changed.steps.find(step => step.type === 'assert-state').value.count = 999;
    if (channel === 'context') changed.steps.find(step => step.type === 'assert-context').value = {};
    if (channel === 'mock-input') changed.mocks[0].input.sku = 'WRONG';
    if (channel === 'mock-result') changed.mocks[0].result.structuredContent.sku = 'WRONG';
    if (channel === 'extra-mock') changed.mocks.push(structuredClone(changed.mocks[0]));
    if (channel === 'missing-mock') changed.mocks = [];
    const result = await verifyPlugin({ pluginDir, replay: changed, timeouts: { business: 300 }, screenshotPath: join(root, `failed-${channel}.png`) });
    assert.equal(result.usable, false, channel);
    assert.equal(result.status, 'failed', channel);
    assert.ok(result.diagnostics.some(d => d.code === 'REPLAY_FAILED'), JSON.stringify(result));
    assert.ok(result.screenshot);
  }
});

test('legacy Agent message requests and repeated host inputs use the same safe replay path', async () => {
  const page = await browser.newPage({ viewport: { width: 420, height: 280 } });
  let legacy;
  try {
    await page.goto(`${base}/?legacy`);
    const frame = page.frameLocator('iframe');
    await frame.locator('body[data-ready=true]').waitFor({ timeout: 20000 });
    await expect.poll(() => page.evaluate(() => window.contexts.length)).toBe(1);
    await frame.locator('#ink').click({ position: { x: 80, y: 22 } });
    await expect.poll(() => page.evaluate(() => window.contexts.length)).toBe(2);
    await page.evaluate(() => window.bridge.sendToolInput({ arguments: { count: 5, legacy: true } }));
    await expect.poll(() => page.evaluate(() => window.contexts.length)).toBeGreaterThanOrEqual(3);
    await expect.poll(() => frame.locator('body').evaluate(() => window.__mcpkitInteractions.snapshot().complete)).toBe(true);
    legacy = await frame.locator('body').evaluate(() => window.__mcpkitInteractions.snapshot());
  } finally { await page.close(); }
  assert.equal(legacy.steps.filter(step => step.type === 'tool-input').length, 2);
  const result = await verifyPlugin({ pluginDir, replay: legacy, timeouts: { business: 2000 } });
  assert.equal(result.usable, true, JSON.stringify(result));
  assert.equal(result.replay.checks.toolRequests, 1);
});

test('CLI replay delegates to semantic verification and an optional readiness gate remains required', async () => {
  const fixture = join(root, 'recording.json'); await writeFile(fixture, JSON.stringify(record));
  const { stdout } = await promisify(execFile)(process.execPath, ['scripts/verify-plugin.mjs', pluginDir, '--replay', fixture]);
  assert.equal(JSON.parse(stdout).replay.status, 'passed');
  const result = await verifyPlugin({ pluginDir, replay: record, readyWhen: { message: { type: 'never-ready' } }, timeouts: { business: 300 } });
  assert.equal(result.usable, false);
  assert.equal(result.checks.business, 'failed');
  assert.ok(result.diagnostics.some(d => d.code === 'BUSINESS_READY_TIMEOUT'));
});

test('replay blocks network writes before reaching an external endpoint', async () => {
  let writes = 0;
  const target = createServer((req, res) => { writes++; res.end('unexpected'); });
  await new Promise(resolve => target.listen(0, '127.0.0.1', resolve));
  try {
    const unsafeDir = join(root, 'unsafe'); await mkdir(unsafeDir);
    const html = await readFile(join(pluginDir, 'view.html'), 'utf8');
    await writeFile(join(unsafeDir, 'view.html'), html + `<script>fetch('http://127.0.0.1:${target.address().port}/write',{method:'POST',body:'unsafe'}).catch(()=>{});</script>`);
    const result = await verifyPlugin({ pluginDir: unsafeDir, replay: record, timeouts: { business: 500 } });
    assert.equal(result.usable, false);
    assert.ok(result.diagnostics.some(d => d.code === 'REPLAY_FAILED'));
    assert.equal(writes, 0);
  } finally { await new Promise(resolve => target.close(resolve)); }
});
