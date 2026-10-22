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
import { InkView } from '@yodaos-pkg/ink';

test(
  'real Ink host API delivers conversation, tool and resource calls through MCP Apps',
  { skip: typeof InkView.prototype.setHostProvider !== 'function' },
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
      await writeFile(
        join(source, 'home.ink'),
        `<script setup>
export default {
 async onLoad() {
  const host = getApp().host;
  this.partial = event => this.postMessage({type:'incoming-partial',detail:event.detail});
  host.addEventListener('toolinputpartial',this.partial);
  try {
   await host.whenReady();
   await host.conversation.updateContext({structuredContent:{selectedSku:'DEMO'}});
   const tool = await host.tools.call('check_stock',{sku:'DEMO'});
   const list = await host.resources.list({cursor:'first'});
   const resource = await host.resources.read('demo:stock');
   let refusal;
   try { await host.conversation.sendMessage({role:'user',content:[{type:'text',text:'Use selection'}]}); } catch(error) {refusal=error.name;}
   this.postMessage({type:'direct-host-results',tool,list,resource,refusal});
  } catch(error) {this.postMessage({type:'direct-host-error',name:error.name,message:error.message});}
 },
 onUnload(){getApp().host.removeEventListener('toolinputpartial',this.partial);}
};
</script><page><text>Direct host services</text></page>`,
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
const frame=document.querySelector('iframe');window.contexts=[];window.messages=[];window.tools=[];
const bridge=new AppBridge(null,{name:'host',version:'1'},{serverTools:{},serverResources:{},updateModelContext:{text:{},structuredContent:{}},message:{text:{}}});
bridge.onupdatemodelcontext=async params=>{window.contexts.push(params);return {};};
bridge.onmessage=async params=>{window.messages.push(params);return {isError:true};};
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
        { structuredContent: { selectedSku: 'DEMO' } },
      ]);
      assert.equal((await page.evaluate(() => window.messages)).length, 1);
      assert.equal(received.refusal, 'NotAllowedError');
      assert.equal(received.tool.structuredContent.available, 100);
      assert.deepEqual(received.tool.uiMetadata, { privateView: true });
      assert.ok(!JSON.stringify(received).includes('must-not-expose'));
      assert.equal(received.list.nextCursor, 'first');
      assert.equal(received.resource[1].blob, 'AAEC');
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
