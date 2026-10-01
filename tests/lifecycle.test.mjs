import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RequestLifecycle, AgentToolBridge, resolveRequestPolicy, DEFAULT_REQUEST_POLICY } from '@yodaos-pkg/aiui-mcpkit';

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const clock = t => t.mock.timers.enable({ apis: ['setTimeout'] });
const failure = handle => handle.result.catch(error => error);

test('policy defaults and validation are inspectable', () => {
  assert.deepEqual(resolveRequestPolicy(), DEFAULT_REQUEST_POLICY);
  for (const policy of [{ totalTimeoutMs: 0 }, { requestTimeoutMs: Infinity }, { maxRetries: -1 }, { retryDelayMs: NaN }, { resetTimeoutOnProgress: 'true' }]) {
    assert.throws(() => resolveRequestPolicy(policy));
  }
  const manager = new RequestLifecycle();
  assert.ok(Object.isFrozen(manager.policy));
});

test('cancel settles immediately, aborts unfinished work, and ignores late progress/results', async t => {
  clock(t);
  const work = deferred(); const changes = []; let context;
  const manager = new RequestLifecycle();
  const handle = manager.start(ctx => { context = ctx; return work.promise; }, { requestId: 'a', onChange: state => changes.push(state) });
  const error = failure(handle);
  await flush(); handle.cancel('User stopped');
  assert.equal((await error).code, 'cancelled');
  assert.equal(context.signal.aborted, true);
  context.progress('late'); work.resolve('late'); await flush();
  assert.deepEqual(changes.map(state => state.state), ['pending', 'cancelled']);
  assert.equal(handle.snapshot().result, undefined);
  assert.deepEqual(manager.inspect(), []);
});

test('external abort and an already-aborted signal never leave pending work', async () => {
  for (const before of [true, false]) {
    const controller = new AbortController(); let calls = 0;
    if (before) controller.abort();
    const handle = new RequestLifecycle().start(async () => { calls++; return new Promise(() => {}); }, { signal: controller.signal });
    const error = failure(handle); await flush(); controller.abort();
    assert.equal((await error).code, 'cancelled');
    assert.equal(calls, before ? 0 : 1);
  }
});

test('per-attempt timeout aborts work even when the operation ignores the signal', async t => {
  clock(t); let context;
  const handle = new RequestLifecycle({ requestTimeoutMs: 10, totalTimeoutMs: 100 }).start(async ctx => { context = ctx; return new Promise(() => {}); });
  const error = failure(handle); await flush(); t.mock.timers.tick(10);
  assert.equal((await error).code, 'request_timeout');
  assert.equal(handle.snapshot().state, 'error'); assert.equal(context.signal.aborted, true);
});

test('progress resets only the attempt budget; total timeout never resets', async t => {
  clock(t); let context;
  const handle = new RequestLifecycle({ requestTimeoutMs: 10, totalTimeoutMs: 25, resetTimeoutOnProgress: true }).start(async ctx => { context = ctx; return new Promise(() => {}); });
  const error = failure(handle); await flush();
  t.mock.timers.tick(8); context.progress({ progress: 1 });
  t.mock.timers.tick(8); assert.equal(handle.snapshot().state, 'pending'); context.progress({ progress: 2 });
  t.mock.timers.tick(8); assert.equal(handle.snapshot().state, 'pending'); context.progress({ progress: 3 });
  t.mock.timers.tick(1); assert.equal((await error).code, 'total_timeout');
});

test('progress does not reset timeouts by default', async t => {
  clock(t); let context;
  const handle = new RequestLifecycle({ requestTimeoutMs: 10, totalTimeoutMs: 100 }).start(async ctx => { context = ctx; return new Promise(() => {}); });
  const error = failure(handle); await flush(); t.mock.timers.tick(8); context.progress(1); t.mock.timers.tick(2);
  assert.equal((await error).code, 'request_timeout');
});

test('concurrent results are isolated and duplicate active IDs cannot replace work', async () => {
  const manager = new RequestLifecycle(); const a = deferred(); const b = deferred();
  const first = manager.start(() => a.promise, { requestId: 'a' });
  const second = manager.start(() => b.promise, { requestId: 'b' });
  assert.throws(() => manager.start(async () => 'replacement', { requestId: 'a' }), /active/);
  await flush(); b.resolve('B'); assert.equal(await second.result, 'B');
  assert.equal(first.snapshot().state, 'pending'); a.resolve('A'); assert.equal(await first.result, 'A');
  assert.equal(second.snapshot().result, 'B');
});

test('retries require explicit safety and an error classifier', async t => {
  clock(t);
  for (const options of [{}, { retrySafe: true }, { shouldRetry: () => true }, { retrySafe: true, shouldRetry: () => false }]) {
    let calls = 0;
    const handle = new RequestLifecycle({ maxRetries: 2 }).start(async () => { calls++; throw new Error('business failed'); }, options);
    await assert.rejects(handle.result, /business failed/); t.mock.timers.tick(100); await flush(); assert.equal(calls, 1);
    if (!options.retrySafe || !options.shouldRetry) assert.equal(handle.snapshot().policy.maxRetries, 0);
  }
});

test('safe retry uses a new signal; late first-attempt result cannot win', async t => {
  clock(t); const old = deferred(); const contexts = [];
  const handle = new RequestLifecycle({ requestTimeoutMs: 10, totalTimeoutMs: 100, retryDelayMs: 5, maxRetries: 1 }).start(ctx => {
    contexts.push(ctx); return ctx.attempt === 1 ? old.promise : Promise.resolve('new');
  }, { retrySafe: true, shouldRetry: error => error.code === 'request_timeout' });
  await flush(); t.mock.timers.tick(10); assert.equal(contexts[0].signal.aborted, true);
  old.resolve('old'); contexts[0].progress('late'); await flush();
  t.mock.timers.tick(5); await flush(); assert.equal(await handle.result, 'new');
  assert.equal(contexts[1].signal.aborted, false); assert.equal(handle.snapshot().attempt, 2);
});

test('retry delay counts toward total budget and can be cancelled', async t => {
  clock(t);
  for (const cancel of [false, true]) {
    let calls = 0;
    const handle = new RequestLifecycle({ totalTimeoutMs: 20, retryDelayMs: 30, maxRetries: 2 }).start(async () => { calls++; throw new Error('transient'); }, { retrySafe: true, shouldRetry: () => true });
    const error = failure(handle); await flush(); if (cancel) handle.cancel();
    t.mock.timers.tick(50); await flush(); assert.equal((await error).code, cancel ? 'cancelled' : 'total_timeout'); assert.equal(calls, 1);
  }
});

test('observer cancellation and observer errors cannot start or strand work', async () => {
  let calls = 0;
  const controller = new AbortController();
  const handle = new RequestLifecycle().start(async () => { calls++; return 'unused'; }, { signal: controller.signal, onChange: snapshot => { if (snapshot.state === 'pending') controller.abort(); throw new Error('observer'); } });
  await assert.rejects(handle.result); assert.equal(calls, 0);
});

test('Agent bridge scopes cancellation, ignores reused IDs, and reports tool errors without retrying', async t => {
  clock(t); const states = []; const work = new Map(); let calls = 0;
  const bridge = new AgentToolBridge({ policy: { maxRetries: 2 }, retrySafeTools: ['safe'], send: state => states.push(state), callTool: async (params, context) => {
    calls++; const item = deferred(); work.set(context.requestId, { ...item, context }); return item.promise;
  } });
  bridge.receive({ type: 'mcpkit:call-tool', requestId: 'a', name: 'safe' });
  bridge.receive({ type: 'mcpkit:call-tool', requestId: 'b', name: 'business' }); await flush();
  bridge.receive({ type: 'mcpkit:cancel-tool', requestId: 'a' });
  work.get('a').resolve({ content: ['late'] }); work.get('b').resolve({ isError: true, content: ['failed'] }); await flush();
  bridge.receive({ type: 'mcpkit:call-tool', requestId: 'a', name: 'business' });
  t.mock.timers.tick(100); await flush(); assert.equal(calls, 2);
  assert.deepEqual(states.filter(state => state.state !== 'pending').map(state => [state.requestId, state.state]), [['a', 'cancelled'], ['b', 'error']]);
  assert.equal(work.get('a').context.signal.aborted, true);
  assert.deepEqual(bridge.lifecycle.inspect(), []);
});


test('Agent can synchronously cancel from the first pending notification', async () => {
  const states = []; let calls = 0; let bridge;
  bridge = new AgentToolBridge({ callTool: async () => { calls++; return {}; }, send: state => {
    states.push(state);
    if (state.state === 'pending') bridge.receive({ type: 'mcpkit:cancel-tool', requestId: state.requestId });
  } });
  bridge.receive({ type: 'mcpkit:call-tool', requestId: 'a', name: 'business' });
  await flush(); assert.equal(calls, 0);
  assert.deepEqual(states.map(state => state.state), ['pending', 'cancelled']);
});

test('retry limits and late rejection cannot change terminal state', async t => {
  clock(t); let calls = 0;
  const handle = new RequestLifecycle({ maxRetries: 1 }).start(async () => { calls++; throw new Error('retry'); }, { retrySafe: true, shouldRetry: () => true });
  const error = failure(handle); await flush(); t.mock.timers.tick(1); await flush();
  assert.equal((await error).message, 'retry'); assert.equal(calls, 2); assert.equal(handle.snapshot().state, 'error');
  const work = deferred(); const cancelled = new RequestLifecycle().start(() => work.promise);
  const cancelledError = failure(cancelled); await flush(); cancelled.cancel(); work.reject(new Error('late'));
  await cancelledError; await flush(); assert.equal(cancelled.snapshot().error.code, 'cancelled');
});
