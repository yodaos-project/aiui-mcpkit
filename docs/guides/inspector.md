# Inspect requests and Agent data flow

English | [简体中文](inspector.zh-CN.md) · [Learning path](../README.md)

**Use this when:** You can run the app, but need to see which tool was called, what it returned or what context was published.

**Before you start:** Follow [development workflow](development.md) to build and open your app. The Inspector is a development panel; enable it for debugging and rebuild without it for release.

Enable the local developer panel when building a plugin, then open its View in an MCP Apps host. Click **Inspector** in the bottom-right corner. Rebuild without this option for production.

```js
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

await buildPlugin({
  source: './agent', name: 'my-agent',
  inspector: { maxEvents: 500, redactKeys: ['customerId', 'accountNumber'] },
  requestPolicy: { requestTimeoutMs: 15000, totalTimeoutMs: 60000 },
});
```

`inspector: true` uses defaults. The repository helper also supports `node scripts/build-plugin.mjs ./agent --name my-agent --inspector`. The default is disabled. `maxEvents` must be an integer from 1 to 5000, default 500; `redactKeys` adds case-insensitive field names to the built-in redaction rules. Invalid configuration fails before writing artifacts. Custom `uiResources` HTML does not receive the generated panel.

## Call and follow a request

The selector shows generated server tools when the host advertises `serverTools`, plus tools registered in the current live App/Page. Refresh after navigation or dynamic registration. Inspect the selected input schema, enter a JSON object and click **Call tool**. This executes the real operation and can change application/business state.

Server calls use the same `AgentToolBridge` and `RequestLifecycle` as Page calls. Live tools execute in the existing App using the same lifecycle wrapper for host, WebMCP and Inspector invocations. The panel does not simulate results or start a separate App. **Cancel request** aborts the selected pending request; other requests continue. Each request's `tool.state` or `view-tool.state` includes its effective timeout, progress-reset and retry settings. Live tools do not automatically retry. Server-call retries require a timeout and a build-time `retrySafeTools` entry, exactly as described in [request lifecycle](tool-lifecycle.md). Cancellation cannot undo a committed operation.

Filter events by the exact **Request ID**. For a Page request such as `quote-1`, the trace includes `tool.input`, pending/progress/terminal `tool.state`, and `agent.delivery`. `tool.server-link` retains the actual generated server ID separately, because browser and server transports have different identifiers. `agent.tool-result` records an incoming host result by its server `_meta.request.requestId` when present. Input/partial-input/cancel notifications from MCP Apps have no invocation ID and remain explicitly **uncorrelated**. The Inspector never infers causality from timing or reuses an unrelated ID.

Direct `getApp().getAgent()` operations use `host:[session,realm,id]` identifiers. Their trace shows the actual adapter timeout (120 seconds), no adapter retry, and Ink's cancellation signal. Context writes are serialized: cancellation can prevent dispatch, but an in-flight write retains its place until acknowledgement. The panel displays the adapter settings separately from the configurable Page/live-tool lifecycle; it does not claim the Ink runtime's internal timeout is the adapter timeout.

## Correlate application events and bindings

The runtime records canvas interaction types without typed text, keys or private Page state. To name a user action and trace an applied binding under the same request ID, send optional diagnostic messages:

```js
// Inside a Page action, before the real mcpkit:call-tool message:
this.postMessage({
  type: 'mcpkit:inspect', kind: 'user-event', name: 'calculate',
  requestId: this.requestId,
});

// After applying that request's result with setData():
this.postMessage({
  type: 'mcpkit:inspect', kind: 'binding', name: 'total',
  requestId: result.requestId, visibility: 'public', value: this.data.total,
});
```

The [order example](../../examples/business/pages/order/index.ink) implements this flow. Binding messages observe application-selected projections; they do not hook every `setData()` or read the entire App/Page. Without `visibility: 'public'`, the value is omitted even in development. This flag controls diagnostic collection only and never publishes model context. For a known cross-request relationship, `kind: 'link'` with `requestId` and `relatedRequestId` records the application's explicit link; the framework does not invent one. `AgentInspectionMessage` exports this contract. Messages are ignored when the Inspector is disabled.

## Inspect model context and privacy

**Model context and privacy boundary** shows `model-context.sent` at the actual `app.updateModelContext()` call, after queueing and revision checks, with the outbound payload redacted. Superseded queued snapshots have `model-context.skipped`; they are not shown as sent. Context replacement, explicit clearing and realm release use the same observation path. `model-context.acknowledged` means the host accepted that write; `modelConsumptionVerified: false` states that this is not evidence of a subsequent model turn using it. Refused/failed publication produces `model-context.failed`.

Only the explicit context projection is sent. The Inspector does not scan private App/Page state, collect UI-only values, inject diagnostic context or publish traces to the model. Tool-result `_meta`, `uiOnly` and `uiMetadata` values are redacted before retention. A diagnostic `visibility` flag does not change this model boundary. See [Agent sessions](agent-session.md) for actual context publication and model-acceptance requirements.

## Export and diagnose startup failures

For versioned interaction fixtures, enable `inspector.recording` before opening a fresh View. **Export interaction recording** uses a separate explicit data allowlist and integrates with `verifyPlugin({ replay })`; see [interaction recording and replay](interaction-replay.md). Ordinary Inspector JSON is a diagnostic trace, not an executable recording.

**Export redacted JSON** downloads a local `mcpkit-inspector/1` trace. Export includes all retained events, independent of the current filter; **Clear trace** removes the retained events. Nothing is automatically sent, saved to browser storage or published to a host. Events are bounded and snapshotted before retention; long values/deep structures are truncated.

Built-in filtering removes credential-like fields, private/UI metadata, Bearer/Basic credentials, URL userinfo/query values and common credential assignments, including JSON encoded in tool text. Add application-specific `redactKeys`. Redaction is heuristic: review public free text and exported traces before sharing; arbitrary secrets in unlabelled text cannot be reliably recognized. Redaction changes diagnostics only, never actual tool arguments, results or model publications.

The panel and browser listeners initialize before the host handshake and WASM loading. Diagnostics include:

| Event | Next step |
| --- | --- |
| `diagnostic.host` | Check Apps initialization and the host's supported capabilities. |
| `diagnostic.bundle`, `diagnostic.agent` | Check bundled manifest/page paths and runtime versions. |
| `diagnostic.wasm` | Check WASM compilation permissions, gzip support and packaged Ink version. |
| `diagnostic.browser`, `diagnostic.promise` | Inspect the failing browser operation and request trace. |
| `diagnostic.csp` | Compare the blocked directive/URI with host CSP and `uiCsp`. |
| `diagnostic.resource` | Check the failing browser resource URL, response, CORS and resource domains. |

A host that blocks all script execution cannot run the Inspector. Failures hidden inside the Ink guest or host require its own logs or explicit diagnostic messages; the browser cannot inspect them automatically. Use client/browser developer tools when the HTML itself never loads. Automated coverage uses a real Ink WASM View, real stdio business server and browser CSP/resource failures; it does not establish compatibility with every desktop host. Run `npm run build:examples`, then `node --test tests/inspector.test.mjs tests/host-provider.test.mjs tests/inspector-browser.test.mjs` to reproduce it.

**Next, if needed:** [Capture a repeatable verification](preview-verification.md).
