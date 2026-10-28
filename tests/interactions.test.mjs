import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Inspector, InteractionRecorder, validateInteractionRecord, equalInteractionValue, verifyPlugin } from '@yodaos-pkg/aiui-mcpkit';

const environment = { viewport: { width: 420, height: 280 }, deviceScaleFactor: 1, displayMode: 'inline', page: 'home' };
function fixture(options = {}) {
  const inspector = new Inspector({ maxEvents: 1 });
  const recorder = new InteractionRecorder(inspector, options, environment);
  return { inspector, recorder };
}
const event = (inspector, kind, data, requestId = null) => inspector.record(kind, data, requestId);

test('interaction retention requires explicit authorization and still redacts credentials and UI metadata', () => {
  const f = fixture({ allow: { input: ['/count', '/nested'], state: ['/selected'] } });
  const input = { count: 2, customer: 'PRIVATE_CUSTOMER', nested: { password: 'SECRET_PASSWORD', text: 'Bearer SECRET_BEARER' } };
  event(f.inspector, 'host.input', { input });
  event(f.inspector, 'agent.binding', { name: 'selection', visibility: 'public', value: { selected: 'DEMO', note: 'PRIVATE_NOTE', uiOnly: { value: 'PRIVATE_UI' } } });
  const exported = f.recorder.export();
  for (const secret of ['PRIVATE_CUSTOMER', 'SECRET_PASSWORD', 'SECRET_BEARER', 'PRIVATE_NOTE', 'PRIVATE_UI']) assert.ok(!exported.includes(secret), secret);
  assert.equal(input.customer, 'PRIVATE_CUSTOMER');
  const saved = f.recorder.snapshot();
  assert.equal(saved.steps[0].input.count, 2);
  assert.equal(saved.steps[1].value.selected, 'DEMO');
  saved.steps[0].input.count = 99;
  assert.equal(f.recorder.snapshot().steps[0].input.count, 2);
  assert.throws(() => validateInteractionRecord(JSON.parse(exported)), /synthetic replacements/);
  const defaults = fixture(); event(defaults.inspector, 'host.input', { input: { text: 'UNLABELLED_PRIVATE_BUSINESS' } });
  assert.ok(!defaults.recorder.export().includes('UNLABELLED_PRIVATE_BUSINESS'));
});

test('recording preserves invocation order across out-of-order mock completion and never silently truncates', () => {
  const f = fixture({ allow: { input: ['/count'], state: ['/count'], toolInput: ['/sku'], toolResult: ['/content', '/structuredContent'] } });
  event(f.inspector, 'host.input', { input: { count: 2 } });
  event(f.inspector, 'tool.input', { name: 'first', arguments: { sku: 'A' } }, 'one');
  event(f.inspector, 'host.request', { operation: 'tools.call', payload: { name: 'second', input: { sku: 'B' } } }, 'two');
  assert.equal(f.recorder.snapshot().complete, false);
  event(f.inspector, 'host.result', { state: 'ready', result: { content: [], structuredContent: { total: 2 }, uiMetadata: { secret: 'PRIVATE' } } }, 'two');
  event(f.inspector, 'tool.state', { state: 'ready', result: { content: [], structuredContent: { total: 1 } } }, 'one');
  event(f.inspector, 'agent.binding', { name: 'count', visibility: 'public', value: { count: 2 } });
  const record = f.recorder.snapshot(); validateInteractionRecord(record);
  assert.deepEqual(record.mocks.map(mock => [mock.name, mock.result.structuredContent.total]), [['first', 1], ['second', 2]]);
  assert.ok(!f.recorder.export().includes('PRIVATE'));
  const bounded = fixture({ maxSteps: 1 });
  event(bounded.inspector, 'host.input', { input: {} });
  event(bounded.inspector, 'view.mode', { mode: 'fullscreen' });
  assert.equal(bounded.recorder.snapshot().complete, false);
  assert.equal(bounded.recorder.snapshot().steps[0].type, 'tool-input');
  f.recorder.dispose(); event(f.inspector, 'host.input', { input: { count: 3 } });
  assert.deepEqual(f.recorder.snapshot(), record);
});

test('unsupported actions, live tools, partial launches and unsuccessful mocks are explicitly incomplete', () => {
  for (const [kind, data] of [
    ['agent.user-event', { type: 'keydown', target: 'canvas' }], ['view-tool.input', { name: 'write' }],
    ['host.partialInput', { input: {} }], ['host.cancelled', {}],
    ['host.request', { operation: 'conversation.sendMessage' }],
  ]) {
    const f = fixture(); event(f.inspector, kind, data);
    assert.equal(f.recorder.snapshot().complete, false, kind);
  }
  const f = fixture(); event(f.inspector, 'tool.input', { name: 'write' }, 'one');
  event(f.inspector, 'tool.state', { state: 'error' }, 'one');
  assert.equal(f.recorder.snapshot().complete, false);
});

test('import validation rejects malformed, unsupported and redacted records before browser launch', async () => {
  const valid = { format: 'mcpkit-interactions', version: 1, ...environment, complete: true, steps: [
    { type: 'tool-input', input: {} }, { type: 'assert-state', name: 'test', value: 1 },
  ], mocks: [] };
  validateInteractionRecord(valid);
  for (const changed of [
    { version: 2 }, { complete: false }, { viewport: { width: 0, height: 2 } },
    { steps: [] }, { steps: [{ type: 'eval', code: 'run()' }] }, { mocks: [{ name: 'write', input: {} }] },
    { steps: [valid.steps[0], { type: 'click', x: -1, y: 0 }] },
    { steps: [valid.steps[0], { type: 'assert-state', name: 'test', value: '[REDACTED]' }] },
  ]) await assert.rejects(verifyPlugin({ pluginDir: 'unused', executablePath: 'missing', replay: { ...valid, ...changed } }), /Invalid interaction record/);
  for (const options of [{ allow: { input: ['count'] } }, { allow: { input: ['/__proto__/polluted'] } }, { allow: { unknown: ['/x'] } }, { maxSteps: 0 }]) assert.throws(() => fixture(options));
  assert.equal(equalInteractionValue({ a: 1, b: [2] }, { b: [2], a: 1 }), true);
  assert.equal(equalInteractionValue({ a: 1 }, { a: 1, b: 2 }), false);
});

test('explicit root authorization supports scalar public bindings and context acknowledgements gate completeness', () => {
  const f = fixture({ allow: { state: [''], context: ['/structuredContent'] } });
  event(f.inspector, 'host.input', { input: {} });
  event(f.inspector, 'agent.binding', { name: 'total', value: 40, visibility: 'public' });
  event(f.inspector, 'model-context.sent', { payload: { structuredContent: { total: 40 } } }, 'ctx');
  assert.equal(f.recorder.snapshot().complete, false);
  event(f.inspector, 'model-context.acknowledged', {}, 'ctx');
  validateInteractionRecord(f.recorder.snapshot());
  assert.equal(f.recorder.snapshot().steps[1].value, 40);
  event(f.inspector, 'model-context.failed', {}, 'failed');
  assert.equal(f.recorder.snapshot().complete, false);
});

test('diagnostic size limits leave explicit markers that cannot silently change replay fixtures', () => {
  for (const input of [{ text: 'x'.repeat(5000) }, { items: Array.from({ length: 110 }, () => 1) }, Object.fromEntries(Array.from({ length: 110 }, (_, i) => [`field${i}`, 1]))]) {
    const f = fixture({ allow: { input: [''], state: [''] } });
    event(f.inspector, 'host.input', { input });
    event(f.inspector, 'agent.binding', { name: 'total', visibility: 'public', value: 40 });
    assert.throws(() => validateInteractionRecord(f.recorder.snapshot()), /synthetic replacements/);
  }
});

test('initial host mode is preserved even if tool input precedes runtime initialization', () => {
  const f = fixture({ allow: { state: [''] } });
  event(f.inspector, 'host.input', { input: {} });
  event(f.inspector, 'view.mode', { mode: 'fullscreen', initial: true });
  event(f.inspector, 'agent.binding', { name: 'ready', visibility: 'public', value: true });
  const record = f.recorder.snapshot(); validateInteractionRecord(record);
  assert.equal(record.displayMode, 'fullscreen');
  assert.equal(record.steps.filter(step => step.type === 'display-mode').length, 0);
});
