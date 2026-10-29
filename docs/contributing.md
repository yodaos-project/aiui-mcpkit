# Contribute

English | [简体中文](contributing.zh-CN.md) · [Learning path](README.md)

Try the example, connect a new host, or improve the build API. [Open an issue](https://github.com/yodaos-project/aiui-mcpkit/issues) with the client version, build command, and reproduction steps; reports from Claude Desktop and other MCP Apps hosts are especially useful.

| Command | Purpose |
| --- | --- |
| `npm run build` | Build the ESM library, types, and runtime templates |
| `npm run build:examples` | Build all six examples and their shared marketplace |
| `npm run update:examples` | Update installed example UIs, servers, and manifests |
| `npm run start:examples` | Start Counter, or select `-- business` |
| `npm run watch:examples -- counter` | Start the beginner browser preview and rebuild on save |
| `npm run typecheck` | Check TypeScript types |
| `npm test` | Run packaging, MCP, and browser tests |
| `npm run bench` | Measure rendering, server and packaging baselines |
| `npm run verify:plugin -- <plugin-directory> ...` | [Verify readiness and capture an Agent PNG](guides/preview-verification.md) |

Before submitting a code change:

```sh
npm run build:examples
npx playwright install chromium
npm run typecheck
INK_WORKER_BIN=/absolute/path/to/ink-worker npm test
```

For a native host, follow [business-tool setup](guides/business-tools.md). To run the complete suite using only published npm dependencies, use `INK_WORKER_BIN="$PWD/scripts/ink-worker-wasm.mjs" npm test`. CI selects this generic host, which executes the same Worker actions in the published SDK's real Ink QuickJS/WASM runtime; it needs no private source checkout. Browser tests use the actual agent runtime in an MCP Apps `AppBridge` harness, covering input, state continuity, display modes, and a no-network CSP. You can select an existing Chromium through `CHROMIUM_PATH`; `/usr/bin/chromium` is also supported when available. Keep the English and Chinese READMEs aligned when updating documentation.

[Browse the source](https://github.com/yodaos-project/aiui-mcpkit) · [Report an issue](https://github.com/yodaos-project/aiui-mcpkit/issues) · [Explore AIUI](https://github.com/yodaos-project/AIUI)

## Run the benchmark correctness check

For changes to packaging, runtime or protocol behavior, run the same smoke workload as the Benchmark workflow:

```sh
npm run bench -- --samples 1 --operations 3 --idle-ms 250 \
  --server-calls 8 --out benchmark-results/ci
```

This tests all four real-WASM scenarios and server workloads; it does not enforce performance thresholds. Run on macOS/Linux. Full methodology and A/B measurements are in [benchmarks](reference/benchmarks.md). Passing local commands does not establish that a GitHub Actions run has passed; remote workflows require a pushed commit/PR.

## Documentation changes

Keep the [learning path](README.md) progressive. A beginner should be able to finish each lesson with a visible result before learning the next capability.

1. State the goal, prerequisites and command working directory before code.
2. Define a new term when first needed. Put protocol contracts and implementation details in reference/advanced pages.
3. Label complete files with their paths; identify snippets and where to insert them. Distinguish terminal commands, chat prompts and tool inputs.
4. Give the expected result, a small completion check and one next step. Introduce client installation, Workers and automation only in the lessons that need them.
5. Keep English/Chinese pages, navigation and examples aligned. Preserve existing public paths and benchmark forwarding pages.
6. Check links, anchors, Markdown/code syntax and rendered layout. When a tutorial's commands or complete examples change, run that path and record the actual result. Documentation-only changes do not require unrelated runtime benchmarks.

Source-linked examples and verification records should distinguish local preview behavior from actual desktop-host and model behavior. Prefer detailed explanations in `docs/` and a short path into them from the root README.

---

[Learning path](README.md) · Previous: [Benchmarks](reference/benchmarks.md)
