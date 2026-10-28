import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const output = await build({entryPoints:['src/runtime/webmcp.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {mirrorWebTools,browserWebRegistry} = await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));

test('browser registry prefers document API and releases legacy registrations, including late registration', async () => {
  const modern={registerTool(){}};
  assert.equal(browserWebRegistry(modern),modern);
  const removed=[];let finish;
  const registry=browserWebRegistry(undefined,{registerTool(){return new Promise(resolve=>{finish=resolve;});},unregisterTool(name){removed.push(name);}});
  const controller=new AbortController();
  const registration=registry.registerTool({name:'late'},{signal:controller.signal});
  controller.abort();finish();await registration;
  assert.deepEqual(removed,['late']);assert.equal(browserWebRegistry(),undefined);
});

test('WebMCP registry changes retain stable App calls, revoke removed Page tools and close pending executions', async () => {
  let list = [{name:'app_action',description:'App'}, {name:'page_action',description:'Page'}];
  const registered=new Map();let registrations=0, signal;
  const mirror=mirrorWebTools({registerTool(tool,{signal}) {
    registrations++;registered.set(tool.name,tool);
    signal.addEventListener('abort',()=>registered.delete(tool.name),{once:true});
  }},async()=>list,async(name,input,s)=>{signal=s;return {name,input};});
  await mirror.sync();
  const app=registered.get('app_action'), page=registered.get('page_action');
  const caller=new AbortController();
  assert.deepEqual(await app.execute({value:1},{signal:caller.signal}),{name:'app_action',input:{value:1}});
  const appSignal=signal;
  list=[list[0]];await mirror.sync();
  assert.equal(registered.get('app_action'),app);
  assert.equal(registrations,2);assert.equal(appSignal.aborted,false);
  assert.throws(()=>page.execute({}, {signal:caller.signal}), /aborted/i);
  caller.abort();assert.equal(appSignal.aborted,true);
  await app.execute({}, {signal:new AbortController().signal});
  mirror.close();assert.equal(signal.aborted,true);assert.equal(registered.size,0);
  await mirror.sync();assert.equal(registered.size,0);
});

test('WebMCP is optional, stale discovery cannot register tools and failed registrations can retry', async () => {
  await mirrorWebTools(undefined,async()=>{throw Error('must not list');},async()=>{}).sync();
  let finish, calls=0;const registrations=[];
  const mirror=mirrorWebTools({registerTool(tool){if(++calls===1) throw Error('temporary failure');registrations.push(tool.name);}},()=>new Promise(resolve=>{finish=resolve;}),async()=>{});
  const old=mirror.sync(), older=finish;
  const recent=mirror.sync();finish([{name:'new'}]);
  await assert.rejects(recent,/temporary failure/);
  older([{name:'old'}]);await old;assert.deepEqual(registrations,[]);
  const retry=mirror.sync();finish([{name:'new'}]);await retry;
  assert.deepEqual(registrations,['new']);mirror.close();
});
