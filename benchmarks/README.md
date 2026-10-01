# Rendering and packaging benchmarks

[简体中文](README.zh-CN.md) | English

This suite establishes the baseline for [issue #18](https://github.com/yodaos-project/aiui-mcpkit/issues/18). It runs the generated MCPKit plugin with **real Ink WASM**, in a fixed local MCP Apps `AppBridge` browser host. It does not change Ink or establish compatibility with desktop clients.

## Run

From the repository root, with Node.js 22+ on macOS or Linux:

```sh
npm ci
npm run build
npx playwright install chromium
npm run bench -- --label ink-baseline --out benchmark-results/baseline
```

An existing Chromium can be selected with `CHROMIUM_PATH=/absolute/path/to/chromium`. Browser installation is explicit; it is not part of the core package or performed by the benchmark. The first run on Linux may require `npx playwright install --with-deps chromium`.

Default settings are **3 fresh browser processes per scenario, 30 measured pointer actions, 25ms think time, 2s idle, 100ms memory sampling, DPR 1 and a 60Hz frame reference**. One initial action verifies interactivity and warms the input path; it is excluded from the input-latency distribution. Scenarios run sequentially. Keep the machine idle and use the same power/thermal conditions for comparisons.

A correctness smoke run, also used by CI:

```sh
npm run bench -- --samples 1 --operations 3 --idle-ms 250 \
  --server-calls 8 --out benchmark-results/smoke
```

Use `npm run bench -- --help` for options. `--scenario small-card` selects a single scenario. Reports with different sampling settings are deliberately not directly comparable. Very short smoke runs validate the pipeline; they are not statistically useful performance baselines.

## Fixed scenarios

| Scenario | Canvas CSS viewport | Mode | Data and operations |
| --- | --- | --- | --- |
| `small-card` | 420 × 220 | inline | Start at 7; increment once per pointer action. |
| `virtual-list` | 640 × 480 | fullscreen | Materialize 10,000 deterministic data records but mount only 20 rows, 18px each. Advance the window and scroll offset by 50 rows per action. Spacer sizes preserve full-list geometry. |
| `live-dashboard` | 640 × 480 | fullscreen | Eight metrics updated every 100ms, `value = (tick × 17 + index × 31) % 100`; select the next metric per action. Pause the feed before measuring idle CPU. |
| `dense-canvas` | 640 × 480 | fullscreen | Redraw 512 bars and a 512-segment polyline in an Ink `<canvas>` per action, with coordinates determined by the input sequence. |

The outer browser viewport is 800 × 800. The host advertises inline/fullscreen support, disables HTTP caching, serves UI under a no-network CSP, and supplies fixed initial arguments. Sources are in [agent/](agent/). The list acknowledges its final target window after scrolling settles; for runtimes without `scrollend`, a fixed 100ms quiet window is included in latency. Its latency must not be interpreted as layout time alone. Dashboard feed values are deterministic by tick; wall-clock tick counts can vary with runtime speed.

## Metrics and correctness

| Metric | Measurement |
| --- | --- |
| First verified frame | Time from **iframe navigation** to a Canvas render turn with an application state message and the expected marker pixel. Visible business content is checked separately. |
| Exercised time to interactive | Same origin to the updated pixels from the first successfully exercised trusted pointer action. This is an upper bound including automation/readiness overhead, not a Lighthouse TTI score. |
| Input-to-display proxy | Trusted DOM `pointerdown` to the last Canvas2D surface mutation in the render turn containing the expected marker. Report min/median/p95/max/mean and raw samples. It includes tap and application work. |
| Frame time and missed slots | Browser `requestAnimationFrame` intervals during measured operations. Missed slots are `max(0, round(interval / targetPeriod) - 1)`; ratio is missed / (observed intervals + missed). This is a scheduling estimate, **not measured GPU/compositor dropped frames**. |
| Canvas submissions | Render turns with observed Canvas2D surface mutations, counted separately from browser frame opportunities. Both vector and bitmap paths are observed. |
| Idle CPU | Chromium CDP `TaskDuration` delta divided by CDP wall time, expressed as a percentage of one main thread. Includes the host and benchmark observer. Dashboard feed is paused. |
| Memory | Sampled sum of the isolated Chromium processes' RSS via `ps`; CDP JS heap; exported WASM linear-memory buffer sizes. Report peaks and raw samples separately. |

The sampler starts during navigation and continues through startup, active actions, idle and screenshot verification. RSS is logical resident memory, may double-count shared pages, includes browser/renderer/utility processes, and is not an exact transient peak or GPU allocation measurement. WASM linear memory is not the whole runtime's memory use. Windows RSS measurement is currently unsupported and fails explicitly.

Instrumentation runs only in benchmark contexts. It wraps Canvas2D mutation methods and uses a single small marker readback for each input. Its overhead, readiness polling, CDP sampling and screenshots are part of this harness; keep methodology fixed across A/B runs. OS filesystem caches, machine load and thermal conditions are recorded only where available, not reset. Each sample launches a fresh Chromium process/profile to avoid reusing the prior sample's browser/WASM cache.

Each action must produce the expected application sequence and marker pixels. Checks also validate counts, list window/row counts, dashboard selections/live ticks, Canvas geometry counts, nonblank business pixels, changed business-pixel hashes, canvas dimensions and absence of browser/runtime errors. Each sample saves a warmup screenshot (sequence 1) and a final screenshot (sequence operations + 1) for visual review. These checks do not prove every glyph is correct; review the PNGs before publishing results. Failures save diagnostics and a screenshot, exit nonzero, and write `status.json` with `failed` so stale reports are not mistaken for a new success.

## Separate server and size measurements

Before any browser is launched, the real generated **stdio MCP server** is initialized, discovered, and read through the SDK. The `benchmark_card` business handler returns `value + 1`, with normal MCPKit contract validation. After 10 warmup calls, measure 1,000 sequential calls and 1,000 calls at concurrency 4 on **one client connection**. Report initialization/resource-read latency, throughput, per-call latency distributions, validated results, and RSS snapshots. This is not an HTTP, multi-client, external-service, or rendering benchmark.

Size categories remain separate:

- Installed production/shared dependencies and development-only dependencies: logical regular-file bytes, classified by `package-lock.json`'s `dev` flags, with actual installed package versions. Optional packages not installed for this platform are excluded. Nested packages are not double-counted; symlinks are not followed. Total installed bytes and unclassified packages/install metadata are also reported.
- npm package: compressed tarball and unpacked file sizes from `npm pack --dry-run --ignore-scripts --json`, after building the library.
- Generated plugin: total bytes plus individual server/view/manifest/type files.
- UI resource: HTML bytes, serialized MCP resource JSON bytes, and gzip HTML bytes. Gzip is a comparison metric, not an assertion that stdio or a desktop host compresses that resource.
- Runtime: raw and gzip WASM bytes plus its SHA-256.

## Reports and A/B comparisons

The output directory contains `report.json`, `report.md`, `status.json`, `screenshots/` and the generated `plugin/`. JSON records settings, scenarios, source fixture and host hashes, Node/Chromium/Ink/SDK versions, machine/OS, Git revision/dirty state, build settings, raw samples and measurement limitations. Markdown displays the median across independent samples of each per-sample metric. No timing threshold is used in CI on shared runners.

The separate [Benchmark workflow](../.github/workflows/benchmark.yml) runs the smoke check on pushes and pull requests to `main`, and can also be started manually. Its run Summary displays the report and links to the `benchmark-smoke` artifact containing raw samples and screenshots, retained for seven days. Failed runs still publish their status and available diagnostic evidence. The [CI workflow](../.github/workflows/ci.yml) independently builds, checks types and runs tests, with a check-results table in its Summary.

Run two measurements under identical settings:

```sh
npm run bench -- --label before --out benchmark-results/before
# Apply the candidate MCPKit/runtime change and rebuild the library.
npm run build
npm run bench -- --label after --out benchmark-results/after \
  --baseline benchmark-results/before/report.json
```

`comparison.json` reports before/after values, absolute and percentage changes, and runtime versions/hashes. A zero baseline produces a null percentage. Machine/OS, host/fixture/methodology hashes, Node/Chromium/protocol/Playwright/esbuild/TypeScript versions, scenario set and measurement settings must match. Ink version/WASM hash and MCPKit revision may differ intentionally. A mismatch rejects the comparison instead of attributing environmental changes to the candidate. Review variance/raw samples; a difference alone is not proof of a repeatable improvement.

To compare a released Ink candidate without committing dependency changes, use an isolated checkout and install its package with `npm install --no-save --package-lock=false @yodaos-pkg/ink@<candidate-version>` before the second build/run. Restore the lockfile installation with `npm ci` afterward. No dependency swapping is performed automatically.

API references: [Playwright CDPSession](https://playwright.dev/docs/api/class-cdpsession), [Chromium Performance domain](https://chromedevtools.github.io/devtools-protocol/tot/Performance/), [Chromium SystemInfo domain](https://chromedevtools.github.io/devtools-protocol/tot/SystemInfo/).
