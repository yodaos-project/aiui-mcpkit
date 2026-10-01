# Tool request lifecycle

English | [简体中文](tool-lifecycle.zh-CN.md) · [Documentation index](../README.md)

**Goal:** show loading/progress, handle errors and stop unfinished work. Read [business tools](business-tools.md) and [message formats](../reference/messages.md) first. The following page-method snippets are integration fragments; the [business page](../../examples/business/pages/order/index.ink) is a complete runnable implementation.

A good UI records an ID before dispatch, disables conflicting controls during `pending`, updates progress only for that ID, and clears loading on every terminal state. Generate IDs with a per-view increasing sequence, for example `quote-${++this.sequence}`, rather than reusing a fixed name. Check the host's active callable tools and `serverTools` capability before assuming a page can invoke an external operation.

Agent pages can call tools exposed by their MCP Apps host through Ink messages. This requires the host's `serverTools` capability and tool access; MCPKit does not register external business tools itself. Each call must use a unique `requestId` for the lifetime of the view:

```js
// Inside an Ink page:
this.postMessage({
  type: 'mcpkit:call-tool', requestId: 'weather-1',
  name: 'get_weather', arguments: { city: 'Hangzhou' },
});
// To stop that request:
this.postMessage({ type: 'mcpkit:cancel-tool', requestId: 'weather-1' });

// Add this method to the page definition:
onMessage(event) {
  const request = event.data;
  if (request.type !== 'mcpkit:tool-state') return;
  // Track each ID separately; pending shows loading, all other states stop it.
  this.setData({ weatherRequest: request });
}
```

Responses have `type: 'mcpkit:tool-state'`, `requestId`, `state`, `attempt` (starting at 1), and the effective `policy`. `pending` may include `progress`; `ready` includes the MCP tool `result`; `error` and `cancelled` include `{ code, message }` in `error`. Timeout codes are `request_timeout` and `total_timeout`; business and transport failures use `tool_error`. Invalid tool names/arguments produce `invalid_request` without executing work. Empty or missing IDs are ignored. Reusing an ID is ignored, including after completion, so delayed messages cannot start or replace a different invocation. Keep state keyed by ID when several calls run concurrently. Host cancellation, page replacement and view closure cancel all outstanding calls; a per-ID cancellation affects only that call.

Configure generated server and view budgets through the ESM API:

```js
await buildPlugin({
  source: './weather-agent', name: 'weather-agent',
  requestPolicy: {
    totalTimeoutMs: 60000, requestTimeoutMs: 15000,
    resetTimeoutOnProgress: true, maxRetries: 1, retryDelayMs: 250,
  },
  retrySafeTools: ['get_weather'],
});
```

| Setting | Default | Rule |
| --- | --- | --- |
| `totalTimeoutMs` | `60000` | Wall-clock budget from start through every attempt and retry delay; progress never resets it. |
| `requestTimeoutMs` | `60000` | Budget for one attempt, starting when dispatched. |
| `resetTimeoutOnProgress` | `false` | When enabled, progress from the active attempt restarts only its request budget. |
| `maxRetries` | `0` | Number of extra attempts; disabled unless the operation is explicitly safe and its failure is eligible. |
| `retryDelayMs` | `0` | Delay before each retry; cancellation and the total deadline still apply. |

Timeouts must be positive integer milliseconds; retries/delay must be nonnegative integers, all at most `2147483647`. Cancellation and either timeout immediately exit pending and abort the current attempt's `AbortSignal`, even if unfinished work ignores it. Abort propagates through `callServerTool` as MCP cancellation; server handlers receive the SDK cancellation signal. Cancellation cannot undo an already committed business operation. Late results, failures and progress are ignored. Retry attempts receive fresh signals and retain the same request ID. The Agent bridge retries only request timeouts for build-time `retrySafeTools`; tool errors, host cancellation and total timeouts never retry. Agent messages cannot enable retries. Generated page openers never retry.

For future server handlers or developer tools, the package exports `RequestLifecycle`, `RequestLifecycleError`, `AgentToolBridge`, `resolveRequestPolicy` and their TypeScript types. Use the same lifecycle around unfinished work:

```js
const requests = new RequestLifecycle({ requestTimeoutMs: 15000 });
const handle = requests.start(async ({ signal, progress }) => {
  progress({ stage: 'fetching' });
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}, { signal: callerSignal });
const result = await handle.result; // rejects on failure, cancellation or timeout
```

In this API, retries require both `retrySafe: true` and a `shouldRetry(error)` predicate as well as a positive `maxRetries`. Observer callbacks cannot change settlement by throwing. Inspect defaults/configuration in `buildPlugin().requestPolicy`, the generated tools/list `_meta.requestPolicy`, or `requests.policy`; inspect active requests with `requests.inspect()` and terminal state with `handle.snapshot()`. Generated tool responses include `_meta.request` with the request ID, terminal state and effective policy. Per-request snapshots report `maxRetries: 0` when safety conditions disable retries. Deterministic tests cover budgets and races; a real Ink WASM browser test covers Agent messages, progress, retries, cancellation propagation and ignored late responses.

## Runtime API lookup

The low-level API is useful when integrating MCPKit into another tool. Most page developers use `postMessage` instead.

| API | Behavior |
| --- | --- |
| `new RequestLifecycle(policy?)` | Owns active requests; resolves and freezes its default policy. |
| `start(operation, options?)` | Returns a `RequestHandle`; operation receives `requestId`, `attempt`, `signal` and `progress(value)`. |
| `options.requestId`, `options.signal`, `options.policy` | Supply a unique active ID, external cancellation and per-request policy overrides. |
| `options.retrySafe`, `options.shouldRetry`, `options.onChange` | Explicit retry safety, eligibility predicate and snapshot observer. |
| `handle.result` | Promise of the operation's result; rejects on failure, cancellation or timeout. |
| `handle.snapshot()` | Current or terminal `RequestSnapshot`, including resolved effective policy. |
| `handle.cancel(reason?)` | Cancels this handle. |
| `requests.inspect()` | Snapshots of currently active requests only. Keep handles to inspect terminal requests. |
| `requests.cancel(id, reason?)` | Cancels an active request; returns false when the ID is absent. |
| `requests.cancelAll(reason?)` | Cancels every active request. |
| `new AgentToolBridge({ policy?, retrySafeTools?, callTool, send })` | Connects page messages to a supplied host call implementation and lifecycle-message sink. |
| `bridge.receive(message)` | Handles call/cancel messages; returns whether it recognized the message. |
| `bridge.cancelAll(reason?)`, `bridge.lifecycle` | Cancel outstanding work or inspect its lifecycle. |

The page bridge disallows ID reuse for the whole View lifetime; a bare `RequestLifecycle` rejects IDs that are empty or currently active. Exported types include `RequestPolicy`, `RequestState`, `RequestSnapshot`, `RequestContext`, `RequestOptions`, `RequestHandle`, `AgentToolRequest` and `ToolBridgeOptions`.

---

[Documentation index](../README.md) · Previous: [Typed business tools](business-tools.md) · Next: [Public metadata](metadata.md)
