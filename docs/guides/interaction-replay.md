# Record and replay Agent interactions

English | [简体中文](interaction-replay.zh-CN.md) · [Learning path](../README.md)

**Use this when:** You have a working interaction and want to replay it as an automated regression check.

**Before you start:** Learn [the Inspector](inspector.md) and [preview verification](preview-verification.md) first. Record, inspect the exported data, then replay with explicit tool mocks and state assertions.

Record a fresh development View, export its authorized test data from the Inspector, then run the same inputs and canvas actions in an isolated browser. Replay checks public state assertions, exact outbound tool requests and explicit model context publications. A screenshot is additional evidence, never the only assertion.

## Record from launch

```js
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

await buildPlugin({
  source: './agent', name: 'my-agent',
  inspector: {
    redactKeys: ['customerId', 'accountNumber'],
    recording: {
      maxSteps: 1000,
      allow: {
        input: ['/quantity'],
        result: ['/content', '/structuredContent'],
        state: ['/quantity', '/total', '/expanded'],
        context: ['/structuredContent'],
        toolInput: ['/quantity'],
        toolResult: ['/content', '/structuredContent'],
      },
    },
  },
});
```

Use synthetic business data when recording. These JSON pointers explicitly authorize export of each named field and its entire subtree. An empty pointer `''` authorizes the whole channel, including scalar values. The default allowlist is empty. Built-in credential and UI metadata filtering, plus `redactKeys`, still applies to authorized fields. A subtree such as `/structuredContent` authorizes every business field below it; use narrower pointers for mixed public/private objects. Array elements use numeric pointers such as `/candidates/0/sku`. Missing authorization produces `[MCPKIT: EXPORT NOT AUTHORIZED]` before retention; actual inputs and execution remain unchanged.

Rebuild and open a **fresh View**. Recording begins before the host handshake and initial tool input; opening the Inspector later does not lose earlier steps. Perform selections, expansion and mode changes, then open **Inspector → Export interaction recording**. This downloads a local JSON file. Nothing is uploaded or persisted automatically. **Clear trace** clears Inspector diagnostics only, preserving the separate bounded recording. Omit `inspector` for production builds.

The development-only `window.__mcpkitInteractions.snapshot()` and `.export()` expose the same record for browser automation. The public `InteractionRecorder` API can subscribe to an `Inspector`; call `.dispose()` to unsubscribe. It observes the actual bridge/provider events and never calls a business tool itself.

## Publish semantic state checkpoints

After applying a meaningful state change, send a deliberately public projection using the existing Inspector contract:

```js
this.postMessage({
  type: 'mcpkit:inspect', kind: 'binding', name: 'order',
  visibility: 'public',
  value: {
    quantity: this.data.quantity,
    total: this.data.total,
    expanded: this.data.expanded,
  },
});
```

`visibility: 'public'` permits diagnostic observation; the recording allowlist separately authorizes export. Private binding messages are omitted. No App/Page state scan or generic `setData()` hook is installed. Replay observes these public messages even in builds without the developer panel. Publish model context through the normal `provideContext()` API; replay observes the actual outbound `updateModelContext()` payload, after queueing and revision checks. Host acknowledgement is required for a complete recording, but it does not prove that a later model turn consumed that context.

Wait for a state/context checkpoint after each async action before performing the next action or exporting. Pending tool calls/context acknowledgements make `complete` false. Overflow fails completeness instead of discarding the beginning. Recording and Inspector traces have independent limits (`maxSteps` and `maxEvents`).

## Replay through the preview verifier

```js
import { readFile } from 'node:fs/promises';
import { verifyPlugin, validateInteractionRecord } from '@yodaos-pkg/aiui-mcpkit';

const replay = JSON.parse(await readFile('./fixtures/order.json', 'utf8'));
validateInteractionRecord(replay);
const result = await verifyPlugin({
  pluginDir: './dist/my-agent', replay,
  timeouts: { business: 5000 },
  screenshotPath: './test-results/order-replay.png',
});
if (!result.usable) throw new Error(JSON.stringify(result.diagnostics));
console.log(result.replay);
// {status:'passed', completedSteps:..., checks:{state:..., toolRequests:..., modelContext:...}}
```

Playwright/Chromium setup follows [preview verification](preview-verification.md). The repository CLI delegates to the same API:

```sh
npm run verify:plugin -- ./dist/my-agent \
  --replay ./fixtures/order.json \
  --screenshot ./test-results/order-replay.png
```

The record supplies the initial page, viewport, scale and display mode. Do not also pass input/page/viewport/mode/scale overrides. For deterministic data injection, edit a copy of the JSON fixture's `tool-input`, `tool-result` and mock result values, updating the corresponding state/context assertions. Redacted/truncated values are rejected before browser launch; replace them explicitly with synthetic fixtures. There is no fallback to private in-memory data or a real service.

Every server request must match the next mock's exact name and input, independent of object property order. This covers both `mcpkit:call-tool` and Ink `getAgent().callTool()`. Unmocked/mismatched calls receive an error; unused mocks also fail. All server calls, including writes and calls marked read-only, are mocked. No generated MCP server or headless Worker process is launched. Context is acknowledged locally; conversation messages are blocked. An isolated browser context blocks external HTTP requests, network writes, WebSockets and service workers. This is a development regression harness for trusted Agent code, not an operating-system sandbox for hostile code.

Each state/context assertion consumes the next actual publication in that channel and requires exact structural equality. Extra unasserted state/context output fails. At least one semantic assertion is mandatory. `REPLAY_FAILED` identifies a failed step or unmatched output without exposing actual business values in its message. Failed runs may retain a diagnostic screenshot. Successful replay satisfies the verifier's business check without `readyWhen`; an optional `readyWhen` remains an additional required gate. Pixel comparison can be performed on returned PNGs using the same browser/runtime and fixtures.

## Version 1 format and boundaries

`InteractionRecord` uses `format: 'mcpkit-interactions'`, `version: 1`, `complete`, environment fields (`page`, `viewport`, `deviceScaleFactor`, `displayMode`), `steps` and `mocks`. Unknown versions and invalid routes, dimensions, coordinates or envelopes fail before execution.

| Step | Meaning |
| --- | --- |
| `tool-input` / `input` | Host launch/update arguments; the first step must be an input |
| `tool-result` / `result` | Inject an incoming host result; private metadata is excluded |
| `click` / `x`, `y` | Canvas-relative CSS coordinates; executed through real browser pointer events |
| `display-mode` / `mode` | Apply `inline` or `fullscreen` through the host bridge |
| `assert-state` / `name`, `value` | Exact next public binding assertion |
| `assert-context` / `value` | Exact next outbound model context publication |

Mocks are `{name, input, result}` in invocation order; results contain MCP `content` and optional `structuredContent`/`isError`. Shared-App host results can preserve the explicitly authorized `result.invocation` (`page`, `query`, `tool`) and replay reconstructs their `_meta.aiui`; other metadata is excluded.

Version 1 supports click-driven selection/expansion and host-driven mode changes at a fixed viewport. Keyboard/text entry, drag, wheel, paste/drop, partial input, cancellation, direct live-tool invocations, retry attempts, resource operations and conversation sends mark a recording incomplete rather than silently replaying a different scenario. Arbitrary clocks, randomness, network timing and animations are not virtualized; expose stable public projections and supply deterministic fixture data. Private UI-only results and persisted restoration state are not replay sources. Browser tests establish local state/protocol/rendering behavior, not compatibility or model consumption in every desktop client.

Reproduce the round-trip and failure gates with `npm run build:examples`, then `node --test tests/interactions.test.mjs tests/interactions-browser.test.mjs`. The browser fixture records selection, expansion, fullscreen and a host result, replays twice, compares the canvas, and checks corrupted state/context/mocks plus a blocked network write.

[Learning path](../README.md) · [Inspector](inspector.md) · [Preview verification](preview-verification.md)

**Next, if needed:** [Read the replay validation record](../validation/interaction-replay-2026-10-29.md).
