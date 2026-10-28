import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access, mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { build } from 'esbuild';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

async function fixture(inspector = true) {
  const root = await mkdtemp(join(tmpdir(), 'mcpkit-inspector-browser-'));
  const client = new Client({ name: 'inspector-browser', version: '1' });
  let browser, http;
  try {
    const source = join(root, 'agent'); await mkdir(join(source, 'mcp-server'), { recursive: true });
    await writeFile(join(source, 'app.json'), JSON.stringify({ pages: ['home'] }));
    await writeFile(join(source, 'home.ink'), `<script type="application/json" def>${JSON.stringify({ tool: 'quote', description: 'Calculate a test quote', schema: {
      data: { type: 'object', properties: { quantity: { type: 'number' }, delay: { type: 'number' }, accountNumber: { type: 'string' } }, required: ['quantity'], additionalProperties: false },
      output: { type: 'object', properties: { total: { type: 'number' } }, required: ['total'], additionalProperties: false },
    } })}</script><script setup>
export default {
  data: {total:0,privateNote:'PRIVATE_PAGE_NOTE'},
  getTotal:ModelContext.defineAction({name:'get_total',description:'Read bound total',execute(){return {total:this.data.total};}}),
  async onLoad(){
    this.postMessage({type:'mcpkit:inspect',kind:'binding',name:'private note',requestId:'private',value:this.data.privateNote});
    this.context=await getApp().getAgent().provideContext({key:'selection',description:'Selected SKU',value:{sku:'DEMO'}});
  },
  quote(){
    this.sequence=(this.sequence||0)+1; const requestId='page-'+this.sequence;
    this.postMessage({type:'mcpkit:inspect',kind:'user-event',name:'calculate',requestId});
    this.postMessage({type:'mcpkit:call-tool',requestId,name:'quote',arguments:{quantity:3}});
  },
  onMessage(event){
    const state=event.data;
    if(state.type!=='mcpkit:tool-state'||state.state!=='ready')return;
    this.setData({total:state.result.structuredContent.total});
    this.postMessage({type:'mcpkit:inspect',kind:'binding',name:'total',requestId:state.requestId,visibility:'public',value:this.data.total});
  },
  onUnload(){this.context?.dispose();}
};
</script><page><button style="width:200px;height:44px" bindtap="quote">Calculate quote</button><text>Total {{total}}</text></page>`);
    await writeFile(join(source, 'mcp-server/handlers.ts'), `export const handlers={quote:async(input,context)=>{
      if(input.delay)await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,input.delay);context.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('Stopped'));},{once:true});});
      context.progress({progress:1,total:1});
      return {content:[{type:'text',text:JSON.stringify({total:input.quantity*20,api_key:'ENCODED_SECRET'})}],structuredContent:{total:input.quantity*20},uiOnly:{supplier:'PRIVATE_SUPPLIER'}};
    }};`);
    const result = await buildPlugin({ source, name: 'inspector-test', outputDir: join(root, 'out'), inspector,
      requestPolicy: { requestTimeoutMs: 600, totalTimeoutMs: 2000, maxRetries: 2 } });
    const html = await readFile(result.files.view, 'utf8');
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [result.files.server] }));
    const harness = (await build({ stdin: { resolveDir: process.cwd(), contents: `
import {AppBridge,PostMessageTransport} from '@modelcontextprotocol/ext-apps/app-bridge';
const frame=document.querySelector('iframe');window.contexts=[];window.calls=[];window.aborted=0;
const bridge=new AppBridge(null,{name:'inspector-host',version:'1'},{serverTools:{},updateModelContext:{structuredContent:{}}});
bridge.oninitialized=()=>{void bridge.sendToolInput({arguments:{}});};
bridge.onupdatemodelcontext=async params=>{window.contexts.push(params);return {};};
bridge.oncalltool=async(params,extra)=>{
 window.calls.push(params);const controller=new AbortController();
 extra.mcpReq.signal.addEventListener('abort',()=>{window.aborted++;controller.abort();});
 return (await fetch('/tool',{method:'POST',body:JSON.stringify(params),signal:controller.signal})).json();
};
window.bridge=bridge;await bridge.connect(new PostMessageTransport(frame.contentWindow,frame.contentWindow));frame.src='/view';
` }, bundle: true, write: false, platform: 'browser', format: 'esm' })).outputFiles[0].text;
    http = createServer(async (req, res) => {
      if (req.url === '/tool') {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const controller = new AbortController(); res.on('close', () => { if (!res.writableEnded) controller.abort(); });
        try { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(await client.callTool(JSON.parse(Buffer.concat(chunks).toString()), undefined, { signal: controller.signal }))); }
        catch { if (!res.destroyed) res.end(JSON.stringify({ isError: true, content: [] })); }
      } else if (req.url?.startsWith('/missing')) { res.writeHead(404); res.end(); }
      else {
        res.setHeader('Content-Type', 'text/html');
        if (req.url === '/view') res.setHeader('Content-Security-Policy', "img-src 'none'");
        res.end(req.url === '/view' ? html : `<iframe style="width:800px;height:700px;border:0"></iframe><script type="module">${harness}</script>`);
      }
    });
    await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
    const executablePath = process.env.CHROMIUM_PATH || await access('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome').then(() => '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', () => undefined);
    browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true });
    const page = await browser.newPage({ viewport: { width: 1000, height: 850 }, acceptDownloads: true });
    return { root, page, url: `http://127.0.0.1:${http.address().port}`, close: async () => { await browser.close(); await new Promise(resolve => http.close(resolve)); await client.close(); await rm(root, { recursive: true, force: true }); } };
  } catch (error) { await browser?.close(); if (http) await new Promise(resolve => http.close(resolve)); await client.close(); await rm(root, { recursive: true, force: true }); throw error; }
}

async function exportTrace(page, frame) {
  const download = page.waitForEvent('download');
  await frame.getByRole('button', { name: 'Export redacted JSON' }).click();
  const file = await download;
  return JSON.parse(await readFile(await file.path(), 'utf8'));
}

test('Inspector calls real business/live tools and follows bindings, policy, cancellation and private boundaries', async () => {
  const f = await fixture({ maxEvents: 200, redactKeys: ['accountNumber'] });
  try {
    await f.page.goto(f.url);
    const frame = f.page.frameLocator('iframe');
    await frame.locator('body[data-ready="true"]').waitFor({ timeout: 20000 });
    await expect.poll(() => f.page.evaluate(() => window.contexts.length)).toBe(1);
    await frame.getByRole('button', { name: 'Inspector', exact: true }).click();
    await expect(frame.getByRole('option', { name: 'server:quote' })).toBeAttached();
    await frame.getByLabel('Tool', { exact: true }).selectOption('server:quote');
    await frame.getByLabel('JSON input').fill('{"quantity":2,"accountNumber":"ACCOUNT_SECRET"}');
    await frame.getByRole('button', { name: 'Call tool', exact: true }).click();
    await expect(frame.locator('#events')).toContainText('agent.binding');
    let exported = await exportTrace(f.page, frame);
    const flow = exported.events.filter(event => event.requestId === 'inspector-1');
    for (const kind of ['tool.input', 'tool.state', 'tool.server-link', 'agent.delivery', 'agent.binding']) assert.ok(flow.some(event => event.kind === kind), kind);
    const ready = flow.find(event => event.kind === 'tool.state' && event.data.state === 'ready');
    assert.equal(ready.data.result.structuredContent.total, 40);
    assert.equal(ready.data.policy.requestTimeoutMs, 600);
    assert.equal(ready.data.policy.maxRetries, 0);
    assert.equal(flow.find(event => event.kind === 'agent.binding').data.value, 40);
    assert.equal((await f.page.evaluate(() => window.calls))[0].arguments.accountNumber, 'ACCOUNT_SECRET');
    const actualContext = (await f.page.evaluate(() => window.contexts))[0];
    assert.deepEqual(exported.events.find(event => event.kind === 'model-context.sent').data.payload, actualContext);
    assert.ok(exported.events.some(event => event.kind === 'model-context.acknowledged' && event.data.modelConsumptionVerified === false));
    for (const secret of ['ACCOUNT_SECRET', 'PRIVATE_PAGE_NOTE', 'PRIVATE_SUPPLIER', 'ENCODED_SECRET']) assert.ok(!JSON.stringify(exported).includes(secret), secret);

    // The live action reads the same Page instance that received the real tool result.
    await frame.getByLabel('Tool', { exact: true }).selectOption('view:get_total');
    await frame.getByLabel('JSON input').fill('{}');
    await frame.getByRole('button', { name: 'Call tool', exact: true }).click();
    await expect(frame.locator('#events')).toContainText('ready');
    exported = await exportTrace(f.page, frame);
    assert.equal(JSON.parse(exported.events.find(event => event.requestId === 'inspector-2' && event.data.state === 'ready').data.result).total, 40);

    await frame.getByLabel('Tool', { exact: true }).selectOption('server:quote');
    await frame.getByLabel('JSON input').fill('{"quantity":2,"delay":1500}');
    await frame.getByRole('button', { name: 'Call tool', exact: true }).click();
    await expect.poll(() => f.page.evaluate(() => window.calls.length)).toBe(2);
    await frame.getByRole('button', { name: 'Cancel request', exact: true }).click();
    await expect(frame.locator('#events')).toContainText('cancelled');
    await expect.poll(() => f.page.evaluate(() => window.aborted)).toBe(1);
    await frame.getByRole('button', { name: 'Call tool', exact: true }).click();
    await expect(frame.locator('#events')).toContainText('error', { timeout: 5000 });
    exported = await exportTrace(f.page, frame);
    const timedOut = exported.events.find(event => event.requestId === 'inspector-4' && event.kind === 'tool.state' && event.data.state === 'error');
    assert.equal(timedOut.data.error.code, 'request_timeout');
    assert.equal(timedOut.data.policy.maxRetries, 0);

    await frame.getByRole('button', { name: 'Inspector', exact: true }).click();
    await frame.locator('canvas').click({ position: { x: 100, y: 22 } });
    await expect.poll(() => f.page.evaluate(() => window.calls.length)).toBe(4);
    await frame.getByRole('button', { name: 'Inspector', exact: true }).click();
    await frame.getByLabel('Request ID', { exact: true }).fill('page-1');
    await expect(frame.locator('#events')).toContainText('agent.binding');
    exported = await exportTrace(f.page, frame);
    assert.ok(exported.events.some(event => event.requestId === 'page-1' && event.kind === 'agent.user-event' && event.data.name === 'calculate'));
    assert.equal(exported.events.find(event => event.requestId === 'page-1' && event.kind === 'agent.binding').data.value, 60);

    // Actual browser events: runtime exception, resource error and CSP violation.
    await frame.locator('body').evaluate(() => {
      setTimeout(() => { throw new Error('token=ERROR_SECRET'); }, 0);
      const script = document.createElement('script'); script.src = '/missing.js?token=URL_SECRET'; document.body.append(script);
      const image = document.createElement('img'); image.src = '/blocked.png'; document.body.append(image);
      void Promise.reject(new Error('Bearer REJECTION_SECRET'));
    });
    await frame.getByLabel('Request ID', { exact: true }).fill('');
    for (const kind of ['diagnostic.browser', 'diagnostic.resource', 'diagnostic.csp', 'diagnostic.promise']) await expect(frame.locator('#events')).toContainText(kind);
    exported = await exportTrace(f.page, frame);
    for (const secret of ['ERROR_SECRET', 'URL_SECRET', 'REJECTION_SECRET']) assert.ok(!JSON.stringify(exported).includes(secret), secret);
    assert.ok(exported.events.filter(event => event.kind.startsWith('diagnostic.')).every(event => event.data.action));
    if (process.env.INK_SCREENSHOTS) {
      await frame.getByLabel('Request ID', { exact: true }).fill('page-1');
      await frame.locator('#tool-controls > summary').click();
      await frame.locator('#events details').filter({ hasText: 'agent.binding' }).locator('summary').click();
      await frame.locator('#panel').evaluate(panel => { panel.scrollTop = 0; });
      await frame.locator('#panel').screenshot({ path: join(process.env.INK_SCREENSHOTS, 'inspector.png') });
    }
    await frame.getByRole('button', { name: 'Clear trace', exact: true }).click();
    await expect(frame.locator('#count')).toContainText('0 events');
  } finally { await f.close(); }
});

test('Inspector survives WASM initialization failure and remains absent from ordinary Views', async () => {
  for (const enabled of [true, false]) {
    const f = await fixture(enabled);
    try {
      if (enabled) await f.page.addInitScript(() => {
        WebAssembly.instantiate = async () => { throw new Error('WASM denied by test policy'); };
      });
      await f.page.goto(f.url);
      const frame = f.page.frameLocator('iframe');
      if (enabled) {
        await frame.getByRole('button', { name: 'Inspector', exact: true }).click();
        await expect(frame.locator('#events')).toContainText('diagnostic.wasm', { timeout: 20000 });
        const exported = await exportTrace(f.page, frame);
        assert.match(exported.events.find(event => event.kind === 'diagnostic.wasm').data.action, /CSP/);
      } else {
        await frame.locator('body[data-ready="true"]').waitFor({ timeout: 20000 });
        assert.equal(await frame.locator('mcpkit-inspector').count(), 0);
      }
    } finally { await f.close(); }
  }
});
