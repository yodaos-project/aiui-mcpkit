import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemorySnapshotStore, createSnapshotSession, SnapshotError } from '@yodaos-pkg/aiui-mcpkit/state';

const scope = {userId:'alice',conversationId:'chat-a',applicationId:'catalog',instanceId:'card-a'};
const payload = {page:'detail',data:{selection:'bag',draft:'private note'}};
const options = {applicationId:'catalog',pages:['search','detail']};
const contract = {dataVersion:1, validate:data=>typeof data.selection==='string' && typeof data.draft==='string'};
const signal = () => new AbortController().signal;
const envelope = (payload, dataVersion=1, owner=scope) => ({formatVersion:1,dataVersion,scope:owner,payload});
const fails = code => error => error instanceof SnapshotError && error.code===code;

test('host-bound stores isolate every scope dimension, reject foreign writes and return detached data', async () => {
  const memory=createMemorySnapshotStore(), a=memory.bind(scope);
  await a.write(envelope(payload),{expectedRevision:null,signal:signal()});
  for(const key of Object.keys(scope)) {
    const b=memory.bind({...scope,[key]:'another'});
    assert.equal(await b.read({signal:signal()}),undefined,key);
    await assert.rejects(b.write(envelope(payload),{expectedRevision:null,signal:signal()}),fails('SCOPE_MISMATCH'));
  }
  const separator=memory.bind({...scope,userId:'a/b',conversationId:'c'});
  await separator.write(envelope(payload,1,separator.scope),{expectedRevision:null,signal:signal()});
  assert.equal(await memory.bind({...scope,userId:'a',conversationId:'b/c'}).read({signal:signal()}),undefined);
  assert.throws(()=>{a.scope.userId='bob';});
  const first=await a.read({signal:signal()});first.snapshot.payload.data.draft='changed';
  assert.equal((await a.read({signal:signal()})).snapshot.payload.data.draft,'private note');
});

test('snapshot sessions reject foreign envelopes and wrong application bindings without leaking data', async () => {
  const store=createMemorySnapshotStore().bind(scope);
  assert.throws(()=>createSnapshotSession({...contract,store},{...options,applicationId:'other'}),fails('SCOPE_MISMATCH'));
  const hostile={...store,read:async()=>({revision:'1',snapshot:envelope(payload,1,{...scope,userId:'bob'})})};
  const session=createSnapshotSession({...contract,store:hostile},options);
  await assert.rejects(session.restore(),error=>fails('SCOPE_MISMATCH')(error) && !error.message.includes('private note'));
  await assert.rejects(session.save(payload),fails('SCOPE_MISMATCH'));
  assert.equal(await store.read({signal:signal()}),undefined);
});

test('queued writes capture independent projections, close flushes them and old Views cannot overwrite new state', async () => {
  const store=createMemorySnapshotStore().bind(scope);
  const a=createSnapshotSession({...contract,store},options), b=createSnapshotSession({...contract,store},options);
  await Promise.all([a.restore(),b.restore()]);
  const mutable=structuredClone(payload);
  const write=a.save(mutable);mutable.data.draft='late mutation';
  await a.close();await write;
  assert.equal((await store.read({signal:signal()})).snapshot.payload.data.draft,'private note');
  await assert.rejects(a.save(payload),fails('CLOSED'));
  await assert.rejects(a.restore(),fails('CLOSED'));
  await assert.rejects(b.save({page:'search',data:{selection:'mug',draft:''}}),fails('CONFLICT'));
  await assert.rejects(b.save(payload),fails('NOT_WRITABLE'));
  const c=createSnapshotSession({...contract,store},options);
  await c.save({page:'search',data:{selection:'lamp',draft:'new'}});
  assert.deepEqual(await createSnapshotSession({...contract,store},options).restore(),{page:'search',data:{selection:'lamp',draft:'new'}});
});

test('invalid or lossy state and unregistered navigation are rejected before writing', async () => {
  const store=createMemorySnapshotStore().bind(scope), s=createSnapshotSession({...contract,store},options);
  const cycle={};cycle.self=cycle;
  for(const invalid of [undefined,NaN,()=>{},cycle,new Date(),new Array(2),{[Symbol('private')]:1},'x'.repeat(256*1024+1)]) {
    await assert.rejects(s.save({page:'detail',data:{selection:'bag',draft:'ok',extra:invalid}}));
  }
  await assert.rejects(s.save({page:'../escape',data:payload.data}),fails('INVALID_DATA'));
  await assert.rejects(s.save({page:'detail',data:{selection:42,draft:''}}),fails('INVALID_DATA'));
  assert.equal(await store.read({signal:signal()}),undefined);
  await s.save(payload);assert.ok(await store.read({signal:signal()}));
});

test('old snapshots migrate under the same scope and revision, unsupported versions remain untouched', async () => {
  const store=createMemorySnapshotStore().bind(scope);
  await store.write(envelope(payload),{expectedRevision:null,signal:signal()});
  const newer={...contract,dataVersion:2};
  await assert.rejects(createSnapshotSession({...newer,store},options).restore(),fails('VERSION_UNSUPPORTED'));
  assert.equal((await store.read({signal:signal()})).snapshot.dataVersion,1);
  const migrated=createSnapshotSession({...newer,store,migrate:(saved,from,to)=>{
    assert.equal(from,1);assert.equal(to,2);return {...saved,data:{...saved.data,draft:saved.data.draft+' migrated'}};
  }},options);
  assert.equal((await migrated.restore()).data.draft,'private note migrated');
  const record=await store.read({signal:signal()});assert.equal(record.snapshot.dataVersion,2);assert.deepEqual(record.snapshot.scope,scope);
  await assert.rejects(createSnapshotSession({...contract,store,migrate:()=>{throw Error('must not downgrade');}},options).restore(),fails('VERSION_UNSUPPORTED'));
});

test('failed migrations and corrupt snapshots cannot replace stored data', async () => {
  const store=createMemorySnapshotStore().bind(scope);
  await store.write(envelope(payload),{expectedRevision:null,signal:signal()});
  const s=createSnapshotSession({...contract,dataVersion:2,store,migrate:()=>({page:'private',data:payload.data})},options);
  await assert.rejects(s.restore(),fails('INVALID_DATA'));
  assert.equal((await store.read({signal:signal()})).snapshot.dataVersion,1);
  const corrupt=createSnapshotSession({...contract,store:{...store,read:async()=>({revision:'1',snapshot:{formatVersion:9,scope,payload}})}},options);
  await assert.rejects(corrupt.restore(),fails('INVALID_SNAPSHOT'));
});

test('storage errors are redacted and a hanging operation times out with an aborted signal', async t => {
  const store=createMemorySnapshotStore().bind(scope);
  await assert.rejects(createSnapshotSession({...contract,store:{...store,read:async()=>{throw Error('secret token');}}},options).restore(),error=>fails('STORAGE_ERROR')(error) && !error.message.includes('secret'));
  await assert.rejects(createSnapshotSession({...contract,store:{...store,read:async()=>{throw new SnapshotError('CONFLICT','secret token');}}},options).restore(),error=>fails('CONFLICT')(error) && !error.message.includes('secret'));
  await assert.rejects(createSnapshotSession({...contract,store:{...store,read:async()=>{throw new SnapshotError('secret token','private backend detail');}}},options).restore(),fails('STORAGE_ERROR'));
  t.mock.timers.enable({apis:['setTimeout']});let observed;
  const session=createSnapshotSession({...contract,store:{...store,read:async({signal})=>{observed=signal;return new Promise(()=>{});}}},{...options,timeoutMs:10});
  const read=session.restore();const error=assert.rejects(read,fails('TIMEOUT'));
  await Promise.resolve();t.mock.timers.tick(11);await error;assert.equal(observed.aborted,true);
});
