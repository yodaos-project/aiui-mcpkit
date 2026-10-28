import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Inspector } from '@yodaos-pkg/aiui-mcpkit';
const code = (
  await build({
    entryPoints: ['src/runtime/host-provider.ts'],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'esm',
  })
).outputFiles[0].text;
const { createMcpHostProvider, hostToolResult } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);
function fixture(
  capabilities = {
    serverTools: {},
    serverResources: {},
    updateModelContext: { text: {}, structuredContent: {} },
    message: { text: {} },
  },
  inspector,
) {
  const calls = [],
    notifications = [];
  const app = {
    getHostCapabilities: () => capabilities,
    getHostContext: () => ({
      theme: 'dark',
      locale: 'zh-CN',
      privateToken: 'hidden',
    }),
    updateModelContext: async (value) => {
      calls.push(['context', value]);
      return {};
    },
    sendMessage: async (value) => {
      calls.push(['message', value]);
      return {};
    },
    callServerTool: async (value, options) => {
      calls.push(['tool', value]);
      options.onprogress({ progress: 1, total: 2 });
      return {
        content: [{ type: 'text', text: 'business failure' }],
        isError: true,
        _meta: { uiOnly: { color: 'red' }, privateToken: 'hidden' },
      };
    },
    listServerResources: async (value) => ({
      resources: [{ uri: 'demo:one', name: 'one', privateToken: 'hidden' }],
      nextCursor: value.cursor,
    }),
    readServerResource: async (value) => ({
      contents: [
        { uri: value.uri, text: 'one', _meta: { secret: 'hidden' } },
        { uri: 'demo:two', blob: 'AAEC' },
      ],
    }),
  };
  const provider = createMcpHostProvider(app, inspector);
  let snapshot;
  provider.input({ partial: 'D' }, true);
  provider.input({ sku: 'DEMO' });
  provider.connect({
    update: (value) => (snapshot = value),
    patchContext: (value) => notifications.push(value),
    notify: (value) => notifications.push(value),
    disconnect() {},
  });
  let id = 0;
  const request = (operation, payload = {}, context = {}) =>
    provider.request(
      {
        session: 'session',
        realm: 'realm',
        id: String(++id),
        revision: id,
        operation,
        payload,
      },
      { signal: new AbortController().signal, onProgress() {}, ...context },
    );
  return { provider, app, calls, notifications, request, snapshot };
}
test('MCP adapter negotiates precise operations and buffers only public invocation/context data', () => {
  const f = fixture();
  assert.deepEqual(f.snapshot.context, { theme: 'dark', locale: 'zh-CN' });
  assert.equal(f.snapshot.capabilities.toolListChanged, false);
  assert.equal(f.snapshot.capabilities.resourceListChanged, false);
  assert.ok(
    !f.snapshot.capabilities.operations.some((value) =>
      ['conversation.sendCard', 'conversation.updateCard'].includes(value),
    ),
  );
  assert.deepEqual(
    f.notifications.map((value) => value.type),
    ['partialInput', 'input'],
  );
  assert.deepEqual(
    f.notifications.map((value) => value.revision),
    [1, 2],
  );
  assert.ok(f.notifications.every((value) => value.invocationId === null));
  f.provider.contextChanged({ locale: 'en-US', privateToken: 'hidden' });
  assert.deepEqual(f.notifications.at(-1), { locale: 'en-US' });
});

test('Inspector records only actual context writes, acknowledgement, refusal and release', async () => {
  const inspector = new Inspector();
  const f = fixture(undefined, inspector);
  let acknowledge;
  f.app.updateModelContext = value => {
    f.calls.push(['context', value]);
    return new Promise(resolve => { acknowledge = resolve; });
  };
  const a = f.request('conversation.updateContext', { structuredContent: { sku: 'A' } });
  await new Promise(resolve => setImmediate(resolve));
  const b = f.request('conversation.updateContext', { structuredContent: { sku: 'B' } });
  const c = f.request('conversation.updateContext', { structuredContent: { sku: 'C' } });
  assert.equal(inspector.snapshot().filter(event => event.kind === 'model-context.sent').length, 1);
  acknowledge({}); await a; await b;
  await new Promise(resolve => setImmediate(resolve));
  const writes = inspector.snapshot().filter(event => event.kind === 'model-context.sent');
  assert.deepEqual(writes.map(event => event.data.payload.structuredContent.sku), ['A', 'C']);
  assert.ok(inspector.snapshot().some(event => event.kind === 'model-context.skipped'));
  acknowledge({}); await c;
  assert.ok(inspector.snapshot().filter(event => event.kind === 'model-context.acknowledged').every(event => event.data.modelConsumptionVerified === false));
  f.app.updateModelContext = async () => ({ isError: true });
  await assert.rejects(f.request('conversation.updateContext', { structuredContent: { sku: 'refused' } }), { name: 'NotAllowedError' });
  assert.ok(inspector.snapshot().some(event => event.kind === 'model-context.failed'));
  f.app.updateModelContext = async () => ({});
  await f.provider.release({ session: 'session', realm: 'realm' });
  assert.deepEqual(inspector.snapshot().filter(event => event.kind === 'model-context.sent').at(-1).data.payload, { content: [], structuredContent: {} });
  assert.ok(inspector.snapshot().filter(event => event.kind.startsWith('host.') && ['input', 'partialInput'].includes(event.kind.split('.')[1])).every(event => event.requestId === null));
});
test('publication, clear and explicit messages have distinct effects and host refusal rejects', async () => {
  const f = fixture();
  await f.request('conversation.updateContext', {
    structuredContent: { selectedSku: 'DEMO' },
  });
  assert.deepEqual(f.calls, [
    ['context', { structuredContent: { selectedSku: 'DEMO' } }],
  ]);
  await f.request('conversation.updateContext', {});
  assert.deepEqual(f.calls.at(-1), [
    'context',
    { content: [], structuredContent: {} },
  ]);
  await f.request('conversation.sendMessage', {
    role: 'user',
    content: [{ type: 'text', text: 'Use selection' }],
  });
  assert.equal(f.calls.at(-1)[0], 'message');
  f.app.sendMessage = async () => ({ isError: true });
  await assert.rejects(
    f.request('conversation.sendMessage', { role: 'user', content: [] }),
    { name: 'NotAllowedError' },
  );
  const unsupported = fixture({});
  await assert.rejects(
    unsupported.request('tools.call', { name: 'no', input: {} }),
    { name: 'NotSupportedError' },
  );
  const modalities = fixture({ updateModelContext: { text: {} } });
  await assert.rejects(
    modalities.request('conversation.updateContext', {
      structuredContent: { sku: 'DEMO' },
    }),
    { name: 'NotSupportedError' },
  );
});
test('business failures resolve with safe UI metadata, progress and paginated text/binary resources', async () => {
  const f = fixture();
  const progress = [];
  const result = await f.request(
    'tools.call',
    { name: 'stock', input: { sku: 'DEMO' } },
    { onProgress: (value) => progress.push(value) },
  );
  assert.equal(result.isError, true);
  assert.deepEqual(result.uiMetadata, { color: 'red' });
  assert.ok(!JSON.stringify(result).includes('hidden'));
  assert.deepEqual(progress, [{ value: 1, total: 2 }]);
  assert.deepEqual(await f.request('resources.list', { cursor: 'next' }), {
    resources: [{ uri: 'demo:one', name: 'one' }],
    nextCursor: 'next',
  });
  assert.deepEqual(await f.request('resources.read', { uri: 'demo:one' }), [
    { uri: 'demo:one', text: 'one' },
    { uri: 'demo:two', blob: 'AAEC' },
  ]);
  assert.throws(
    () => hostToolResult({ content: [{ type: 'image', data: 'x' }] }),
    { name: 'NotSupportedError' },
  );
  assert.equal(
    f.calls.some((value) => value[0] === 'context'),
    false,
  );
});
test('context provider waits for in-flight acknowledgement before a later revision and clears on release', async () => {
  const f = fixture();
  let acknowledge;
  f.app.updateModelContext = (value) => {
    f.calls.push(['context', value]);
    return new Promise((resolve) => (acknowledge = resolve));
  };
  const first = f.request('conversation.updateContext', {
    structuredContent: { selectedSku: 'A' },
  });
  await new Promise((resolve) => setImmediate(resolve));
  const second = f.request('conversation.updateContext', {
    structuredContent: { selectedSku: 'B' },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.calls.length, 1);
  acknowledge({});
  await first;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.calls.length, 2);
  acknowledge({});
  await second;
  f.app.updateModelContext = async (value) => {
    f.calls.push(['context', value]);
    return {};
  };
  await f.provider.release({ session: 'session', realm: 'realm' });
  assert.deepEqual(f.calls.at(-1), [
    'context',
    { content: [], structuredContent: {} },
  ]);
});
