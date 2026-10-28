# Interaction recording and replay: local validation

Date: 2026-10-29 (Asia/Shanghai). Implements [issue #12](https://github.com/yodaos-project/aiui-mcpkit/issues/12).

Environment: macOS arm64, Node 22.21.1, published Ink `0.20.0-daily.20261027171530`, local headless Chromium. No desktop client, real model turn or production business service is involved.

## Acceptance evidence

- A real Ink WASM View records launch input, product selection, expansion, fullscreen and a later host result. Inspector export and the development snapshot API return the same version 1 JSON.
- Two independent browser replays each verify four public state checkpoints, one exact outbound tool request and four actual model-context publications. Both canvas PNGs equal the original PNG in the same browser.
- Separate browser coverage exercises `mcpkit:call-tool` requests and repeated host inputs, in addition to direct Ink `getAgent().callTool()`.
- Changed state/context expectations, changed mock arguments/results, missing mocks and unused mocks fail with `REPLAY_FAILED`, even when a canvas screenshot exists. An additional `readyWhen` gate cannot be overwritten by replay success. CLI `--replay` uses the same verification API.
- A real HTTP test endpoint receives zero requests when replayed Agent code attempts an external POST. Every server tool is mocked; no generated server or Worker is started by replay.
- Default export omits unlabelled business data. Explicit field authorization still redacts credential values and UI metadata. Tests cover pending acknowledgements, unsupported actions, limits, synthetic replacement requirements and import validation before browser startup.

## Commands

All passed locally:

```sh
npm run build:examples
npm run typecheck
INK_WORKER_BIN="$PWD/scripts/ink-worker-wasm.mjs" npm test
npm run bench -- --samples 1 --operations 3 --idle-ms 250 \
  --server-calls 8 --out benchmark-results/ci
```

The complete suite passed **113/113**, with zero skips. The new recorder/browser tests account for 12 tests. Benchmark smoke verification passed all four real-WASM scenarios and the sequential/concurrent stdio workloads; this establishes correctness, not a performance improvement. Generated logs, reports and PNGs stay in ignored `test-results/` and `benchmark-results/`.

## Boundaries

Version 1 replays clicks at a fixed viewport and host display-mode changes. Unsupported keyboard/drag/scroll/live-tool and other operations explicitly make recordings incomplete. It does not virtualize clocks or randomness. Model-context verification establishes the exact outbound payload and local acknowledgement, not subsequent model consumption. See the [English guide](../guides/interaction-replay.md) or [Chinese guide](../guides/interaction-replay.zh-CN.md) for authorization, fixture injection and the complete boundary list.
