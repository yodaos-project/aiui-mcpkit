import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {buildPlugin} from '@yodaos-pkg/aiui-mcpkit';

test('real Ink rebuild restores scoped selection, private draft and navigation without publishing the snapshot', async()=>{
  const root=await mkdtemp(join(tmpdir(),'mcpkit-restoration-'));
  const client=new Client({name:'state-browser',version:'1'},{capabilities:{extensions:{'io.modelcontextprotocol/ui':{mimeTypes:['text/html;profile=mcp-app']}}}});
  let browser,server,html,harness;
  try {
    server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(req.url.startsWith('/view')?html:`<script type="module">${harness}</script>`);});
    await new Promise(resolve=>server.listen(0,resolve));
    const hostOrigin=`http://127.0.0.1:${server.address().port}`, appOrigin=`http://localhost:${server.address().port}`;
    const adapter=join(root,'adapter.js');
    await writeFile(adapter,`import {portAdapter} from ${JSON.stringify(resolve('tests/fixtures/state/port-adapter.js'))};import {catalogStateContract} from ${JSON.stringify(resolve('examples/business/state-contract.js'))};export const createRestoration=portAdapter(${JSON.stringify(hostOrigin)},catalogStateContract);`);
    const built=await buildPlugin({source:'examples/business',name:'business-demo',outputDir:join(root,'plugin'),worker:{name:'business'},applications:{catalog:{page:'pages/catalog/index'}},restoration:{adapter}});
    await client.connect(new StdioClientTransport({command:process.execPath,args:[built.files.server],env:{INK_WORKER_BIN:process.env.INK_WORKER_BIN||'ink-worker'}}));
    const initial=await client.callTool({name:'search_catalog',arguments:{query:'travel'}});
    html=(await client.readResource({uri:'ui://business-demo/applications/catalog.html'})).contents[0].text;
    harness=(await build({stdin:{resolveDir:process.cwd(),contents:`
import {AppBridge,PostMessageTransport} from '@modelcontextprotocol/ext-apps/app-bridge';
import {createMemorySnapshotStore} from ${JSON.stringify(resolve('dist/state.mjs'))};
const memory=createMemorySnapshotStore();const frames=new Map();const stores=new Map();
const scopes={a:{userId:'alice',conversationId:'one',applicationId:'business-demo',instanceId:'card-a'},b:{userId:'bob',conversationId:'one',applicationId:'business-demo',instanceId:'card-a'},c:{userId:'alice',conversationId:'two',applicationId:'business-demo',instanceId:'card-a'},d:{userId:'alice',conversationId:'one',applicationId:'business-demo',instanceId:'card-b'},e:{userId:'alice',conversationId:'one',applicationId:'other-app',instanceId:'card-a'}};
window.contexts=[];window.messages=[];window.writeGates=[];
window.addEventListener('message',event=>{
 if(event.origin!==${JSON.stringify(appOrigin)}||event.data?.type!=='snapshot-bind')return;
 const item=[...frames.values()].find(item=>item.frame.contentWindow===event.source);if(!item)return;
 if(item.unsupported){event.source.postMessage({type:'snapshot-bound',supported:false},event.origin);return;}
 const store=memory.bind(scopes[item.key]);stores.set(item.key,store);const channel=new MessageChannel();const active=new Map();
 channel.port1.onmessage=async({data})=>{
  if(data.type==='cancel'){active.get(data.id)?.abort();return;}
  const controller=new AbortController();active.set(data.id,controller);
  try{
   let value;
   if(data.method==='read')value=await store.read({signal:controller.signal});
   else if(data.method==='write'){
    if(window.holdWrites)await new Promise(resolve=>window.writeGates.push(resolve));
    value=await store.write(data.args.snapshot,{expectedRevision:data.args.expectedRevision,signal:controller.signal});
   }
   else if(data.method==='remove')value=await store.remove({expectedRevision:data.args.expectedRevision,signal:controller.signal});
   else throw Error('Invalid operation');
   channel.port1.postMessage({id:data.id,value});
  }catch{channel.port1.postMessage({id:data.id,error:true});}finally{active.delete(data.id);}
 };
 event.source.postMessage({type:'snapshot-bound',supported:true,scope:store.scope},event.origin,[channel.port2]);
});
window.mount=async(key,unsupported=false,query='travel')=>{
 const launch=query==='travel'?${JSON.stringify(initial)}:await(await fetch('/tool',{method:'POST',body:JSON.stringify({name:'search_catalog',arguments:{query}})})).json();
 const frame=document.createElement('iframe');frame.id=key;frame.style='width:900px;height:700px;border:0';document.body.append(frame);
 const bridge=new AppBridge(null,{name:'scoped-host',version:'1'},{serverTools:{},updateModelContext:{structuredContent:{}},message:{text:{}}},{hostContext:{displayMode:'fullscreen',availableDisplayModes:['inline','fullscreen']}});
 bridge.oncalltool=async params=>{
  const data=await fetch('/tool',{method:'POST',body:JSON.stringify(params)});return data.json();
 };
 bridge.onupdatemodelcontext=async params=>{window.contexts.push(params);return {};};
 bridge.onmessage=async params=>{window.messages.push(params);return {};};
 bridge.oninitialized=()=>{void bridge.sendToolInput({arguments:{query}});void bridge.sendToolResult(launch);};
 frames.set(key,{frame,bridge,key,unsupported});
 await bridge.connect(new PostMessageTransport(frame.contentWindow,frame.contentWindow));frame.src=${JSON.stringify(appOrigin)}+'/view';
};
window.call=async(key,name,args={})=>(await frames.get(key).bridge.callTool({name,arguments:args})).structuredContent;
window.mode=(key,mode)=>frames.get(key).bridge.setHostContext({displayMode:mode,availableDisplayModes:['inline','fullscreen']});
window.unmount=async key=>{const item=frames.get(key);await item.bridge.teardownResource({});item.frame.remove();frames.delete(key);};
window.saved=async key=>{const store=stores.get(key);return store?await store.read({signal:new AbortController().signal}):undefined;};
await window.mount('a');
`},bundle:true,write:false,platform:'browser',format:'esm'})).outputFiles[0].text;
    // Real server calls remain outside the browser; the host owns the backend.
    server.removeAllListeners('request');server.on('request',async(req,res)=>{
      if(req.url==='/tool') {
        const chunks=[];for await(const chunk of req)chunks.push(chunk);
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await client.callTool(JSON.parse(Buffer.concat(chunks).toString()))));
      } else {res.setHeader('Content-Type','text/html');res.end(req.url.startsWith('/view')?html:`<script type="module">${harness}</script>`);}
    });
    const executablePath=process.env.CHROMIUM_PATH||await access('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome').then(()=>'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',()=>undefined);
    browser=await chromium.launch({...(executablePath?{executablePath}:{}),headless:true});
    const page=await browser.newPage({viewport:{width:1000,height:850}});const errors=[],logs=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>logs.push(e.text()));
    await page.goto(hostOrigin);
    const ready=async key=>{await page.locator('#'+key).scrollIntoViewIfNeeded();await page.frameLocator('#'+key).locator('body[data-restoration="saved"]').waitFor({timeout:15000});};
    await ready('a');
    const call=(key,name,args={})=>page.evaluate(({key,name,args})=>window.call(key,name,args),{key,name,args});
    await expect.poll(async()=>{try{return(await call('a','catalog_state')).candidates.length;}catch{return -1;}}).toBe(2);
    await call('a','catalog_inspect',{sku:'TRAVEL-BAG'});await call('a','catalog_select',{sku:'TRAVEL-BAG'});
    await expect.poll(()=>page.evaluate(async()=> (await window.saved('a'))?.snapshot.payload.page)).toBe('pages/catalog/detail');
    // Type a real private draft into the Ink-rendered input, not a model tool.
    const canvas=page.frameLocator('#a').locator('canvas');
    if(process.env.INK_SCREENSHOTS)await canvas.screenshot({path:process.env.INK_SCREENSHOTS+'/restoration-input.png'});
    await canvas.click({position:{x:720,y:405}});
    const draft='pack a charger';
    // An older acknowledgment must not show Saved while a newer edit is pending.
    await page.evaluate(()=>{window.holdWrites=true;});
    await page.keyboard.type('p');
    await expect.poll(()=>page.evaluate(()=>window.writeGates.length)).toBe(1);
    await page.keyboard.type('a');
    // Wait for Ink to project the second edit before releasing the first write.
    await page.frameLocator('#a').locator('body').evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.evaluate(()=>window.writeGates.shift()());
    await expect.poll(()=>page.evaluate(()=>window.writeGates.length)).toBe(1);
    assert.equal(await page.frameLocator('#a').locator('body').getAttribute('data-restoration'),'saving');
    await page.evaluate(()=>{window.holdWrites=false;window.writeGates.shift()();});
    await expect.poll(()=>page.evaluate(async()=> (await window.saved('a'))?.snapshot.payload.data.draft)).toBe('pa');
    for(let index=2;index<draft.length;index++) {
      await page.keyboard.type(draft[index]);
      // A completed checkpoint, rather than unload timing, is the durability boundary.
      await expect.poll(()=>page.evaluate(async()=> (await window.saved('a'))?.snapshot.payload.data.draft)).toBe(draft.slice(0,index+1));
    }
    const spoof=await page.frameLocator('#a').locator('body').evaluate((body,origin)=>new Promise(resolve=>{
      const win=body.ownerDocument.defaultView;
      const receive=event=>{if(event.source===win.parent&&event.origin===origin&&event.data?.type==='snapshot-bound'){win.removeEventListener('message',receive);event.ports[0].close();resolve(event.data.scope);}};
      win.addEventListener('message',receive);win.parent.postMessage({type:'snapshot-bind',scope:{userId:'bob',instanceId:'other-card'}},origin);
    }),hostOrigin);
    assert.equal(spoof.userId,'alice');assert.equal(spoof.instanceId,'card-a');
    const before=await call('a','catalog_state');
    assert.ok(!JSON.stringify(before).includes('pack a charger'));
    for(const mode of ['inline','fullscreen']) {
      await page.evaluate(mode=>window.mode('a',mode),mode);
      await page.frameLocator('#a').locator('body[data-mode="'+mode+'"]').waitFor();
      assert.deepEqual(await call('a','catalog_state'),before);
    }
    await page.evaluate(()=>window.unmount('a'));await page.evaluate(()=>window.mount('a',false,'lamp'));await ready('a');
    await expect.poll(async()=>{try{return(await call('a','catalog_state')).selected?.sku;}catch{return undefined;}}).toBe('TRAVEL-BAG');
    const after=await call('a','catalog_state');
    assert.equal(after.instanceId,before.instanceId);assert.equal(after.route,'detail');assert.equal(after.detail.sku,'TRAVEL-BAG');
    await expect.poll(async()=>(await call('a','catalog_state')).query).toBe('lamp');
    assert.equal((await call('a','catalog_state')).candidates[0].sku,'DESK-LAMP');
    await expect.poll(()=>page.evaluate(async()=> (await window.saved('a'))?.snapshot.payload.data.draft)).toBe('pack a charger');
    if(process.env.INK_SCREENSHOTS)await page.frameLocator('#a').locator('canvas').screenshot({path:process.env.INK_SCREENSHOTS+'/restored-catalog.png'});
    // Restoring a detail route must not leave Back stranded on a one-page stack.
    await page.frameLocator('#a').locator('canvas').click({position:{x:440,y:464}});
    await expect.poll(async()=>(await call('a','catalog_state')).route).toBe('search');
    assert.equal((await call('a','catalog_state')).selected.sku,'TRAVEL-BAG');
    await expect.poll(()=>page.evaluate(async()=> (await window.saved('a'))?.snapshot.payload.page)).toBe('pages/catalog/index');
    assert.equal((await page.evaluate(()=>window.saved('a'))).snapshot.payload.data.draft,'pack a charger');
    for(const key of ['b','c','d']) {
      await page.evaluate(key=>window.mount(key),key);await ready(key);
      await expect.poll(async()=>{try{return(await call(key,'catalog_state')).candidates.length;}catch{return -1;}}).toBe(2);
      const isolated=await call(key,'catalog_state');assert.equal(isolated.selected,null);assert.equal(isolated.route,'search');assert.notEqual(isolated.instanceId,after.instanceId);
      assert.equal((await page.evaluate(key=>window.saved(key),key)).snapshot.payload.data.draft,'');
    }
    assert.deepEqual(await page.evaluate(()=>window.contexts),[]);assert.deepEqual(await page.evaluate(()=>window.messages),[]);
    assert.ok(logs.every(line=>!line.includes('pack a charger')));
    const priorUnsupported=await page.evaluate(()=>window.saved('d'));
    await page.evaluate(()=>window.unmount('d'));await page.evaluate(()=>window.mount('d',true));
    await page.locator('#d').scrollIntoViewIfNeeded();
    await page.frameLocator('#d').locator('body[data-ready="true"]').waitFor({timeout:15000});
    await expect.poll(async()=>{try{return(await call('d','catalog_state')).candidates.length;}catch{return -1;}}).toBe(2);
    assert.equal(await page.frameLocator('#d').locator('body').getAttribute('data-restoration'),'unavailable');
    await call('d','catalog_select',{sku:'TRAVEL-MUG'});
    assert.deepEqual(await page.evaluate(()=>window.saved('d')),priorUnsupported,'Unsupported restoration must not write snapshots');
    await page.evaluate(()=>window.mount('e'));await page.locator('#e').scrollIntoViewIfNeeded();
    await page.frameLocator('#e').locator('body[data-ready="true"]').waitFor({timeout:15000});
    assert.equal(await page.frameLocator('#e').locator('body').getAttribute('data-restoration'),'rejected');
    assert.equal(await page.frameLocator('#e').locator('body').getAttribute('data-restoration-error'),'SCOPE_MISMATCH');
    assert.equal(await page.evaluate(()=>window.saved('e')),undefined);
    assert.deepEqual(errors,[]);
  } finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await client.close();await rm(root,{recursive:true,force:true});}
});
