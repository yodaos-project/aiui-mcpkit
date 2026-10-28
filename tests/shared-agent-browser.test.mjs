import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { build } from 'esbuild';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('multiple business tools share one resource and preserve live App navigation, selection and isolation', async () => {
  const client = new Client({name:'shared-agent',version:'1'}, {capabilities:{extensions:{'io.modelcontextprotocol/ui':{mimeTypes:['text/html;profile=mcp-app']}}}});
  let browser, server;
  try {
    await client.connect(new StdioClientTransport({command:process.execPath,args:['dist/examples/business/dist/server.mjs'],env:{INK_WORKER_BIN:process.env.INK_WORKER_BIN || 'ink-worker'}}));
    const names = ['search_catalog','inspect_catalog_product','select_catalog_product'];
    const tools = (await client.listTools()).tools.filter(t=>names.includes(t.name));
    assert.equal(tools.length,3);
    const uri = 'ui://business-demo/applications/catalog.html';
    assert.deepEqual(tools.map(t=>t._meta.ui.resourceUri), [uri,uri,uri]);
    assert.equal((await client.listResources()).resources.filter(r=>r.uri===uri).length,1);
    const initial = await client.callTool({name:'search_catalog',arguments:{query:'travel'}});
    const html = (await client.readResource({uri})).contents[0].text.replace('<head>', `<head><script>
window.webTools={};
Object.defineProperty(document,'modelContext',{value:{registerTool(tool,{signal}){
 window.webTools[tool.name]=tool;
 signal.addEventListener('abort',()=>{delete window.webTools[tool.name];},{once:true});
}}});
</script>`);
    const harness = (await build({stdin:{resolveDir:process.cwd(),contents:`
import {AppBridge,PostMessageTransport} from '@modelcontextprotocol/ext-apps/app-bridge';
window.bridges=[];window.toolChanges=0;
for(const frame of document.querySelectorAll('iframe')) {
 const bridge=new AppBridge(null,{name:'shared-host',version:'1'},{serverTools:{}});
 bridge.setNotificationHandler('notifications/tools/list_changed',()=>{window.toolChanges++;});
 bridge.oncalltool=async params=>{
   if(window.holdSearch && params.name==='search_catalog' && params.arguments.query==='travel') await new Promise(resolve=>window.releaseSearch=resolve);
   return (await fetch('/tool',{method:'POST',body:JSON.stringify(params)})).json();
 };
 bridge.oninitialized=()=>{void bridge.sendToolInput({arguments:{query:'travel'}});void bridge.sendToolResult(${JSON.stringify(initial)});};
 window.bridges.push(bridge);
 await bridge.connect(new PostMessageTransport(frame.contentWindow,frame.contentWindow));frame.src='/view';
}
`},bundle:true,write:false,platform:'browser',format:'esm'})).outputFiles[0].text;
    server=createServer(async(req,res)=>{
      if(req.url==='/tool') {
        const chunks=[];for await(const c of req) chunks.push(c);
        res.setHeader('Content-Type','application/json');
        try {res.end(JSON.stringify(await client.callTool(JSON.parse(Buffer.concat(chunks).toString()))));}
        catch {res.end(JSON.stringify({isError:true,content:[]}));}
      } else {res.setHeader('Content-Type','text/html');res.end(req.url==='/view'?html:`<iframe style="width:420px;height:280px"></iframe><iframe style="width:420px;height:280px"></iframe><script type="module">${harness}</script>`);}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const executablePath=process.env.CHROMIUM_PATH || await access('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome').then(()=>'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',()=>undefined);
    browser=await chromium.launch({...(executablePath?{executablePath}:{}),headless:true});
    const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const call=(index,name,args={})=>page.evaluate(async({index,name,args})=>(await window.bridges[index].callTool({name,arguments:args})).structuredContent,{index,name,args});
    await expect.poll(async()=>{try{return (await call(0,'catalog_state')).candidates.length;}catch{return -1;}}).toBe(2);
    await expect.poll(async()=>{try{return (await call(1,'catalog_state')).candidates.length;}catch{return -1;}}).toBe(2);
    assert.ok(await page.evaluate(()=>window.toolChanges>0), 'Initial App tools must notify the host');
    async function captureLayouts(route) {
      const before=await call(0,'catalog_state');
      for(const [width,height,label] of [[900,1034,'desktop'],[1280,800,'wide'],[360,700,'narrow'],[480,352,'short']]) {
        await page.evaluate(({width,height})=>{
          const frame=document.querySelector('iframe');frame.style.width=width+'px';frame.style.height=height+'px';
          window.bridges[0].setHostContext({displayMode:'fullscreen',availableDisplayModes:['inline','fullscreen']});
        },{width,height});
        await page.frameLocator('iframe').first().locator('body[data-mode="fullscreen"]').waitFor();
        const canvas=page.frameLocator('iframe').first().locator('canvas');
        await expect.poll(()=>canvas.evaluate(c=>Math.round(c.getBoundingClientRect().width))).toBe(width);
        await expect.poll(()=>canvas.evaluate(c=>Math.round(c.getBoundingClientRect().height))).toBe(height);
        assert.deepEqual(await call(0,'catalog_state'),before,'Display changes must retain the shared App state');
        if(process.env.INK_SCREENSHOTS) await canvas.screenshot({path:`${process.env.INK_SCREENSHOTS}/shared-agent-${route}-${label}.png`});
      }
      await page.evaluate(()=>{
        const frame=document.querySelector('iframe');frame.style.width='420px';frame.style.height='280px';
        window.bridges[0].setHostContext({displayMode:'inline',availableDisplayModes:['inline','fullscreen']});
      });
      await page.frameLocator('iframe').first().locator('body[data-mode="inline"]').waitFor();
      assert.deepEqual(await call(0,'catalog_state'),before);
    }
    const first=await call(0,'catalog_state'), second=await call(1,'catalog_state');
    assert.notEqual(first.instanceId,second.instanceId);
    const body=page.frameLocator('iframe').first().locator('body');
    await expect.poll(()=>body.evaluate(body=>Object.keys(body.ownerDocument.defaultView.webTools))).toContain('catalog_inspect');
    // Browser-facing tools execute the same live Ink Action as the Apps route.
    await body.evaluate(body=>body.ownerDocument.defaultView.webTools.catalog_inspect.execute({sku:'TRAVEL-BAG'},{signal:new AbortController().signal}));
    await expect.poll(async()=>(await call(0,'catalog_state')).route).toBe('detail');
    await call(0,'catalog_select',{sku:'TRAVEL-BAG'});
    const selected=await call(0,'catalog_state');
    assert.equal(selected.selected.sku,'TRAVEL-BAG');
    assert.equal(selected.detail.sku,'TRAVEL-BAG');
    // New server results delivered to this View must update data without reopening.
    const update=await client.callTool({name:'search_catalog',arguments:{query:'desk'}});
    await page.evaluate(async update=>{await window.bridges[0].sendToolInput({arguments:{query:'desk'}});await window.bridges[0].sendToolResult(update);},update);
    await expect.poll(async()=>(await call(0,'catalog_state')).query).toBe('desk');
    const updated=await call(0,'catalog_state');
    assert.equal(updated.instanceId,first.instanceId);
    assert.equal(updated.route,'detail');assert.equal(updated.selected.sku,'TRAVEL-BAG');
    assert.equal(updated.candidates[0].sku,'DESK-LAMP');
    if(process.env.INK_SCREENSHOTS) await page.frameLocator('iframe').first().locator('canvas').screenshot({path:`${process.env.INK_SCREENSHOTS}/shared-agent-detail.png`});
    assert.deepEqual(await call(1,'catalog_state'),second);
    // A result for another app is never applied to this shared instance.
    await page.evaluate(()=>window.bridges[0].sendToolResult({content:[],structuredContent:{selected:{sku:'WRONG'}},_meta:{aiui:{page:'pages/stock/index',tool:'select_catalog_product',query:{query:'desk'}}}}));
    assert.deepEqual(await call(0,'catalog_state'),updated);
    // Slow prior searches cannot overwrite a more recent search in the same App.
    await page.evaluate(()=>{window.holdSearch=true;window.oldSearch=window.bridges[0].callTool({name:'catalog_search',arguments:{query:'travel'}});});
    await expect.poll(()=>page.evaluate(()=>typeof window.releaseSearch)).toBe('function');
    await call(0,'catalog_search',{query:'lamp'});
    await page.evaluate(async()=>{window.releaseSearch();await window.oldSearch;window.holdSearch=false;});
    assert.equal((await call(0,'catalog_state')).query,'lamp');
    const failed=await page.evaluate(()=>window.bridges[0].callTool({name:'catalog_select',arguments:{sku:'UNKNOWN'}}).catch(()=>({isError:true})));
    assert.equal(failed.isError,true);
    assert.equal((await call(0,'catalog_state')).selected.sku,'TRAVEL-BAG');
    // Back navigation shows refreshed search data; it does not return to a new App.
    await captureLayouts('detail');
    await page.frameLocator('iframe').first().locator('canvas').click({position:{x:310,y:182}});
    await expect.poll(async()=>(await call(0,'catalog_state')).route).toBe('search');
    const returned=await call(0,'catalog_state');
    assert.equal(returned.instanceId,first.instanceId);assert.equal(returned.query,'lamp');
    if(process.env.INK_SCREENSHOTS) await page.frameLocator('iframe').first().locator('canvas').screenshot({path:`${process.env.INK_SCREENSHOTS}/shared-agent-search.png`});
    await captureLayouts('search');
    await call(0,'catalog_search',{query:''});
    assert.equal((await call(0,'catalog_state')).candidates.length,3);
    if(process.env.INK_SCREENSHOTS) await page.frameLocator('iframe').first().locator('canvas').screenshot({path:`${process.env.INK_SCREENSHOTS}/shared-agent-all-inline.png`});
    await captureLayouts('all');
    await page.evaluate(()=>window.bridges[0].teardownResource({}));
    assert.deepEqual(await body.evaluate(body=>Object.keys(body.ownerDocument.defaultView.webTools)),[]);
    assert.deepEqual(await call(1,'catalog_state'),second);
    // A fresh conversation/page has fresh state even when using the same server.
    const another=await browser.newPage();await another.goto(`http://127.0.0.1:${server.address().port}`);
    await expect.poll(async()=>{try{return (await another.evaluate(async()=>(await window.bridges[0].callTool({name:'catalog_state',arguments:{}})).structuredContent)).candidates.length;}catch{return -1;}}).toBe(2);
    const fresh=await another.evaluate(async()=>(await window.bridges[0].callTool({name:'catalog_state',arguments:{}})).structuredContent);
    assert.equal(fresh.selected,null);assert.equal(fresh.route,'search');assert.notEqual(fresh.instanceId,first.instanceId);
    assert.deepEqual(errors,[]);
  } finally {await browser?.close();if(server) await new Promise(resolve=>server.close(resolve));await client.close();}
});
