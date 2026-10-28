import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inspector, AgentToolBridge, redactDiagnostics, resolveInspectorOptions, buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test('diagnostics redact before retaining, bound events, isolate snapshots and tolerate observers', () => {
  const inspector = new Inspector({ maxEvents: 2, redactKeys: ['accountNumber'] });
  inspector.subscribe(() => { throw new Error('observer'); });
  const input = { sku: 'DEMO', nested: { authorization: 'credential-one', accountNumber: 'credential-two' },
    _meta: { arbitraryField: 'private-metadata' }, uiOnly: { arbitraryField: 'private-ui' },
    text: JSON.stringify({ api_key: 'encoded-credential', value: 'public' }),
    error: new Error('GET https://user:credential@host/path?signature=credential-fragment Bearer credential-bearer'),
  };
  inspector.record('tool.input', input, 'one');
  const saved = inspector.snapshot();
  input.sku = 'MUTATED';
  assert.equal(saved[0].data.sku, 'DEMO');
  assert.equal(input.nested.authorization, 'credential-one');
  const exported = inspector.export();
  for (const secret of ['credential-one', 'credential-two', 'private-metadata', 'private-ui', 'encoded-credential', 'credential-fragment', 'credential-bearer', 'user:credential']) assert.ok(!exported.includes(secret), secret);
  assert.match(exported, /REDACTED/);
  saved[0].data.sku = 'SNAPSHOT MUTATION';
  assert.equal(inspector.snapshot()[0].data.sku, 'DEMO');
  inspector.record('host.input', {}, null); inspector.record('tool.state', { state: 'ready' }, 'two');
  assert.deepEqual(inspector.snapshot().map(event => event.sequence), [2, 3]);
  assert.equal(inspector.snapshot('two').length, 1);
  assert.equal(inspector.snapshot()[0].requestId, null);
  inspector.clear(); assert.deepEqual(inspector.snapshot(), []);
  const cycle = {}; cycle.value = cycle;
  assert.deepEqual(redactDiagnostics(cycle), { value: '[CIRCULAR]' });
  const getter = { get value() { throw new Error('getter'); } };
  assert.equal(redactDiagnostics(getter), '[UNAVAILABLE]');
});

test('Inspector observes the actual bridge policy, timeout retry, cancellation and server ID', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const inspector = new Inspector();
  const delivered = [], contexts = [];
  const bridge = new AgentToolBridge({ inspector, policy: { requestTimeoutMs: 10, totalTimeoutMs: 100, maxRetries: 1 }, retrySafeTools: ['safe'],
    send: value => delivered.push(value), callTool: async (params, context) => {
      contexts.push(context);
      if (params.name === 'safe' && context.attempt === 2) return { content: [], structuredContent: { total: 40 }, _meta: { request: { requestId: 'number:7' }, uiOnly: { supplier: 'PRIVATE_SUPPLIER' } } };
      return new Promise(() => {});
    },
  });
  bridge.receive({ type: 'mcpkit:call-tool', requestId: 'safe-id', name: 'safe', arguments: { token: 'SECRET_INPUT' } });
  bridge.receive({ type: 'mcpkit:call-tool', requestId: 'cancel-id', name: 'write' });
  await flush();
  bridge.receive({ type: 'mcpkit:cancel-tool', requestId: 'cancel-id' });
  t.mock.timers.tick(10); await flush(); t.mock.timers.tick(1); await flush();
  const safe = inspector.snapshot('safe-id');
  assert.deepEqual(safe.filter(event => event.kind === 'tool.state').map(event => [event.data.attempt, event.data.state]), [[1, 'pending'], [2, 'pending'], [2, 'ready']]);
  assert.equal(safe.find(event => event.kind === 'tool.server-link').data.serverRequestId, 'number:7');
  const cancelled = inspector.snapshot('cancel-id').find(event => event.kind === 'tool.state' && event.data.state === 'cancelled');
  assert.equal(cancelled.data.policy.maxRetries, 0);
  assert.equal(cancelled.data.policy.requestTimeoutMs, bridge.lifecycle.policy.requestTimeoutMs);
  assert.equal(contexts.find(context => context.requestId === 'cancel-id').signal.aborted, true);
  assert.equal(delivered.find(event => event.state === 'ready').result._meta.uiOnly.supplier, 'PRIVATE_SUPPLIER');
  assert.ok(!inspector.export().includes('PRIVATE_SUPPLIER'));
  assert.ok(!inspector.export().includes('SECRET_INPUT'));
});

test('Inspector configuration is opt-in and invalid configuration rejects before writing output', async () => {
  assert.equal(resolveInspectorOptions(), undefined);
  assert.deepEqual(resolveInspectorOptions(true), { maxEvents: 500, redactKeys: [] });
  for (const value of [null, [], 'yes', { maxEvents: 0 }, { maxEvents: 5001 }, { redactKeys: [null] }]) assert.throws(() => resolveInspectorOptions(value));
  const root = await mkdtemp(join(tmpdir(), 'mcpkit-inspector-options-'));
  try {
    const source = join(root, 'agent'), outputDir = join(root, 'out'); await mkdir(source);
    await writeFile(join(source, 'app.json'), JSON.stringify({ pages: ['home'] }));
    await writeFile(join(source, 'home.ink'), '<page><text>Home</text></page>');
    await assert.rejects(buildPlugin({ source, outputDir, name: 'inspect', inspector: { maxEvents: -1 } }), /inspector.maxEvents/);
    await assert.rejects(access(outputDir));
  } finally { await rm(root, { recursive: true, force: true }); }
});
