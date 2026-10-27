import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import {
  access,
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { build } from 'esbuild';
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

test(
  'real Ink host API delivers conversation, tool and resource calls through MCP Apps',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'mcpkit-host-services-'));
    let browser, server;
    try {
      const source = join(root, 'agent');
      await mkdir(source);
      await writeFile(
        join(source, 'app.json'),
        JSON.stringify({ pages: ['home'] }),
      );
      await writeFile(join(source, 'app.js'), `export default {
        selectedSku: 'LIVE',
        getSelection: ModelContext.defineAction({name:'get_selection',description:'Read live selection',inputSchema:{type:'object',properties:{}},execute(){return {selectedSku:this.selectedSku};}}),
        holdSelection: ModelContext.defineAction({name:'hold_selection',description:'Wait for cancellation',execute(_,{signal}){return new Promise(resolve=>signal.addEventListener('abort',()=>{this.postMessage({type:'app-tool-aborted'});resolve(null);}));}})
      };`);
      await writeFile(
        join(source, 'home.ink'),
        `<script setup>
export default {
 data: {selectedSku:'PAGE'},
 getSelection: ModelContext.defineAction({name:'get_page_selection',description:'Read the current page selection',annotations:{readOnlyHint:true},execute(){return {selectedSku:this.data.selectedSku};}}),
 async onLoad() {
  const host = getApp().getAgent();
  this.partial = event => this.postMessage({type:'incoming-partial',detail:event.detail});
  host.addEventListener('toolinputpartial',this.partial);
  try {
   this.selection = await host.provideContext({key:'selection',description:'Selected SKU',value:{selectedSku:'DEMO'}});
   this.registration = new AbortController();
   await getApp().modelContext.registerTool({name:'get_dynamic_selection',description:'Read selection while registered',execute:()=>({selectedSku:this.data.selectedSku})},{signal:this.registration.signal});
   const tool = await host.callTool('check_stock',{sku:'DEMO'});
   const list = await host.listResources({cursor:'first'});
   const resource = await host.readResource('demo:stock');
   let refusal;
   try { await host.conversation.sendMessage({role:'user',content:[{type:'text',text:'Use selection'}]}); } catch(error) {refusal=error.name;}
   this.postMessage({type:'direct-host-results',tool,list,resource,refusal});
  } catch(error) {this.postMessage({type:'direct-host-error',name:error.name,message:error.message});}
 },
 async sendSelection() {
  try {
   this.setData({selectedSku:'CLICKED'});
   await this.selection.update({selectedSku:this.data.selectedSku});
   await getApp().getAgent().conversation.sendMessage({role:'user',content:[{type:'text',text:'Describe product '+this.data.selectedSku+'.'}]});
   this.registration.abort();
   this.postMessage({type:'message-sent'});
  } catch(error) {this.postMessage({type:'direct-host-error',name:error.name,message:error.message});}
 },
 onUnload(){this.registration?.abort();getApp().getAgent().removeEventListener('toolinputpartial',this.partial);}
};
</script><page><button style="width:200px;height:44px;" bindtap="sendSelection">Send selection</button></page>`,
      );
      const result = await buildPlugin({
        source,
        name: 'host-services-test',
        outputDir: join(root, 'out'),
      });
      const html = await readFile(result.files.view, 'utf8');
      const harness = (
        await build({
          stdin: {
            resolveDir: process.cwd(),
            contents: `
import {AppBridge,PostMessageTransport} from '@modelcontextprotocol/ext-apps/app-bridge';
const frame=document.querySelector('iframe');window.contexts=[];window.messages=[];window.tools=[];window.toolChanges=0;
const bridge=new AppBridge(null,{name:'host',version:'1'},{serverTools:{},serverResources:{},updateModelContext:{text:{},structuredContent:{}},message:{text:{}}});
bridge.onupdatemodelcontext=async params=>{window.contexts.push(params);return {};};
bridge.onmessage=async params=>{window.messages.push(params);return {isError:params.content[0].text==='Use selection'};};
bridge.setNotificationHandler('notifications/tools/list_changed',()=>{window.toolChanges++;});
bridge.oncalltool=async params=>{window.tools.push(params);return {content:[{type:'text',text:'Stock'}],structuredContent:{available:100},_meta:{uiOnly:{privateView:true},privateTransport:'must-not-expose'}};};
bridge.onlistresources=async params=>({resources:[{uri:'demo:stock',name:'Stock'}],nextCursor:params.cursor});
bridge.onreadresource=async params=>({contents:[{uri:params.uri,text:'stock'},{uri:'demo:binary',blob:'AAEC'}]});
window.bridge=bridge;await bridge.connect(new PostMessageTransport(frame.contentWindow,frame.contentWindow));frame.src='/view';
`,
          },
          bundle: true,
          write: false,
          platform: 'browser',
          format: 'esm',
        })
      ).outputFiles[0].text;
      server = createServer((req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(
          req.url === '/view'
            ? html
            : `<iframe style="width:420px;height:280px"></iframe><script type="module">${harness}</script>`,
        );
      });
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const executable =
        process.env.CHROMIUM_PATH ||
        (await access(
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        ).then(
          () => '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          () => undefined,
        ));
      browser = await chromium.launch({
        ...(executable ? { executablePath: executable } : {}),
        headless: true,
        args: ['--no-sandbox'],
      });
      const page = await browser.newPage();
      const observed = [],
        errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.text().startsWith('Ink message: '))
          observed.push(
            JSON.parse(message.text().slice('Ink message: '.length)),
          );
      });
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await expect
        .poll(
          () =>
            observed.find((value) => value.type === 'direct-host-results') ||
            observed.find((value) => value.type === 'direct-host-error'),
          { timeout: 15000 },
        )
        .toBeTruthy();
      const received = observed.find(
        (value) => value.type === 'direct-host-results',
      );
      assert.ok(received, JSON.stringify(observed));
      assert.deepEqual(await page.evaluate(() => window.contexts), [
        { structuredContent: { contexts: { selection: { description: 'Selected SKU', value: { selectedSku: 'DEMO' } } } } },
      ]);
      assert.equal((await page.evaluate(() => window.messages)).length, 1);
      assert.equal(received.refusal, 'NotAllowedError');
      assert.equal(received.tool.structuredContent.available, 100);
      assert.deepEqual(received.tool.uiMetadata, { privateView: true });
      assert.ok(!JSON.stringify(received).includes('must-not-expose'));
      assert.equal(received.list.nextCursor, 'first');
      assert.equal(received.resource[1].blob, 'AAEC');
      const exposed = await page.evaluate(() => window.bridge.listTools({}));
      assert.ok(exposed.tools.some(tool => tool.name === 'get_selection'));
      assert.equal(
        exposed.tools.find(tool => tool.name === 'get_page_selection').annotations.readOnlyHint,
        true,
      );
      const pageResult = await page.evaluate(() =>
        window.bridge.callTool({ name: 'get_page_selection', arguments: {} }),
      );
      assert.deepEqual(pageResult.structuredContent, { selectedSku: 'PAGE' });
      const dynamicResult = await page.evaluate(() =>
        window.bridge.callTool({ name: 'get_dynamic_selection', arguments: {} }),
      );
      assert.deepEqual(dynamicResult.structuredContent, { selectedSku: 'PAGE' });
      const liveResult = await page.evaluate(() => window.bridge.callTool({name:'get_selection',arguments:{}}));
      assert.deepEqual(liveResult.structuredContent, {selectedSku:'LIVE'});
      const changesBeforeClick = await page.evaluate(() => window.toolChanges);
      await page.frameLocator('iframe').locator('canvas').click({ position: { x: 100, y: 22 } });
      await expect.poll(() => observed.some(value => value.type === 'message-sent'), { timeout: 5000 }).toBe(true);
      assert.deepEqual((await page.evaluate(() => window.messages)).at(-1), {
        role: 'user', content: [{ type: 'text', text: 'Describe product CLICKED.' }],
      });
      assert.deepEqual((await page.evaluate(() => window.contexts)).at(-1), {
        structuredContent: {
          contexts: { selection: { description: 'Selected SKU', value: { selectedSku: 'CLICKED' } } },
        },
      });
      const updatedPageResult = await page.evaluate(() =>
        window.bridge.callTool({ name: 'get_page_selection', arguments: {} }),
      );
      assert.deepEqual(updatedPageResult.structuredContent, { selectedSku: 'CLICKED' });
      await expect.poll(() => page.evaluate(() => window.toolChanges)).toBeGreaterThan(changesBeforeClick);
      const updatedTools = await page.evaluate(() => window.bridge.listTools({}));
      assert.ok(!updatedTools.tools.some(tool => tool.name === 'get_dynamic_selection'));
      await page.evaluate(async () => {
        const controller = new AbortController();
        const pending = window.bridge.callTool({name:'hold_selection',arguments:{}}, {signal:controller.signal}).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 100));
        controller.abort();
        await pending;
      });
      await expect.poll(() => observed.some(value => value.type === 'app-tool-aborted'), {timeout:5000}).toBe(true);

      await page.evaluate(() =>
        window.bridge.sendToolInputPartial({ arguments: { sku: 'D' } }),
      );
      await expect
        .poll(
          () => observed.some((value) => value.type === 'incoming-partial'),
          {
            timeout: 5000,
          },
        )
        .toBe(true);
      await page.evaluate(() => window.bridge.teardownResource({}));
      await expect
        .poll(() => page.evaluate(() => window.contexts.at(-1)), {
          timeout: 5000,
        })
        .toEqual({ content: [], structuredContent: {} });
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await new Promise((resolve) =>
        server ? server.close(resolve) : resolve(),
      );
      await rm(root, { recursive: true, force: true });
    }
  },
);
