# Verify an Agent and capture screenshots

English | [简体中文](preview-verification.zh-CN.md) · [Learning path](../README.md)

**Use this when:** The UI works manually and you need a repeatable readiness check or a PNG for documentation.

**Before you start:** Complete [the browser quickstart](../getting-started/quickstart.md). Unlike interactive watch mode, this automation step needs Playwright and a browser installed for it.

`verifyPlugin()` opens a built Agent in a local MCP Apps `AppBridge` harness using the real Ink/WASM runtime. It returns explicit readiness checks and can capture the Agent canvas as a PNG. The repository CLI delegates to the same ESM API.

## Browser setup

Preview support loads Playwright only when called. It is an **optional peer dependency**; normal builds and generated servers do not require it or install a browser. In your development project:

```sh
npm install --save-dev playwright
npx playwright install chromium
```

Linux CI may need `npx playwright install --with-deps chromium`. An existing Chromium can be selected with `executablePath` or `CHROMIUM_PATH` instead of downloading one. Do not add a browser to the generated plugin's runtime deployment.

## ESM example

From the repository root, after `npm run build:examples`:

```js
import { verifyPlugin } from '@yodaos-pkg/aiui-mcpkit';

const result = await verifyPlugin({
  pluginDir: './dist/examples/counter',
  page: 'pages/counter/index',
  input: { initialCount: 42, label: 'Release check' },
  displayMode: 'fullscreen',
  viewport: { width: 480, height: 352 },
  deviceScaleFactor: 1,
  readyWhen: {
    message: { type: 'counter-loaded', count: 42, label: 'Release check' },
  },
  timeouts: { runtime: 15000, firstFrame: 15000, business: 15000 },
  screenshotPath: './test-results/counter.png',
});
console.log(result);
if (!result.usable) process.exitCode = 1;
```

Use `buildPlugin()`'s `outputDir` for your own Agent. `page` defaults to the built initial page; routes omit `.ink`. Launch arguments arrive through the actual host bridge. Every call creates a fresh browser context, so storage and App state are isolated. Paths resolve from the caller's working directory.

## Readiness contract

The checks run in order, each with its own timeout:

1. **runtime:** the generated View has connected to the host, created Ink, and opened its page (`body.dataset.ready`).
2. **firstFrame:** the preview observes an actual canvas submission, two animation callbacks giving the browser a paint opportunity, and nonuniform canvas pixels. A canvas element or a uniformly blank/background-only image is insufficient. This is browser presentation evidence, not a physical display measurement.
3. **business:** `readyWhen.message` recursively matches an Agent message. Extra object fields are allowed; arrays match their full length and contents. Include the expected state, such as a record ID or loaded count, to avoid accepting an unrelated startup message.

The Agent should signal after its required asynchronous work and data updates:

```js
this.setData({ record, loading: false });
this.postMessage({ type: 'record-ready', id: record.id, loading: false });
```

The preview drains two more animation callbacks after readiness before returning/capturing. The message is an application contract: it must cover the business data and assets that matter to the screenshot. It does not automatically establish network idleness, animation completion, interactivity of every control, or later model consumption.

`status: 'passed'` and `usable: true` require all three checks and the configured error gate. Without `readyWhen`, business is `skipped`, `status` is `incomplete`, and `usable` is false. A failed or incomplete run may still write a diagnostic screenshot; the PNG's existence never proves usability.

## Options and results

| Option | Default / meaning |
| --- | --- |
| `pluginDir` | Required built plugin directory containing `view.html` |
| `page`, `input` | Built initial page and `{}` |
| `displayMode` | `inline`; also supports `fullscreen` |
| `viewport` | `{ width: 420, height: 280 }` CSS pixels, dimensions 1–16384 |
| `deviceScaleFactor` | `1`; greater than 0, at most 4 |
| `readyWhen.message` | Optional nonempty JSON object; omission leaves verification incomplete |
| `timeouts` | `runtime`, `firstFrame`, `business`: 15000ms each, positive 32-bit integers |
| `errorGate` | `fail`; `collect` records runtime/rejection/console errors without failing for those errors |
| `screenshotPath` | Optional `.png` path; parent directories are created |
| `executablePath` | Explicit Chromium executable, then `CHROMIUM_PATH`, then Playwright's installed browser |

The screenshot contains the Agent canvas, excluding the host shell. Fullscreen canvas dimensions follow the viewport; inline retains the generated View's height (normally 220 CSS pixels). PNG dimensions include the device scale factor and are returned in `screenshot.width/height`.

The result includes `status`, `usable`, `checks` (`passed`/`failed`/`skipped`), `diagnostics`, actual `readyMessage`, viewport/mode/scale, and optional `screenshot` with an absolute path. Invalid options throw `PreviewError` with `code: 'INVALID_OPTIONS'`; operational failures return `status: 'failed'` and stable diagnostic codes:

| Code | Meaning |
| --- | --- |
| `RUNTIME_ERROR` | Browser runtime exception |
| `UNHANDLED_REJECTION` | Unhandled browser promise rejection |
| `CONSOLE_ERROR` | Error logged by the View, Ink or preview host |
| `RUNTIME_READY_TIMEOUT` | View never reached runtime readiness |
| `FIRST_FRAME_TIMEOUT` | No qualifying frame/presentation within the budget |
| `BUSINESS_READY_TIMEOUT` | Expected business message never arrived |
| `BROWSER_UNAVAILABLE` | Playwright missing, browser missing, or browser launch failed |
| `SCREENSHOT_FAILED` | Canvas capture or PNG write failed |
| `PREVIEW_FAILED` | Other preview setup/navigation failure |

Errors are observed through the end of capture/verification. `collect` never suppresses timeouts or infrastructure failures; a passing result with collected errors reflects that explicit policy.

## Repository CLI

```sh
npm run verify:plugin -- dist/examples/counter \
  --input '{"initialCount":42,"label":"Release check"}' \
  --ready-message '{"type":"counter-loaded","count":42,"label":"Release check"}' \
  --mode fullscreen --width 480 --height 352 \
  --screenshot test-results/counter.png
```

`--timeout` sets every stage's budget. `--page`, `--dpr`, `--chromium`, and `--error-gate collect` map to the ESM options. The CLI prints JSON and exits 0 only for `passed`; failed and incomplete runs exit 1. See `node scripts/verify-plugin.mjs --help`.

This local harness supplies launch input and display context. It does not start the generated MCP server or provide business/host tool services; pages needing those services require their own integration harness. Local verification does not establish compatibility with a deployed desktop host or real model. See [runtime integration](runtime-integration.md) and [client setup](clients.md) for those boundaries.

**Next, if needed:** [Record and replay interactions](interaction-replay.md).
