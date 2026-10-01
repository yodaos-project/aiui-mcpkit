# Contribute

English | [简体中文](contributing.zh-CN.md) · [Documentation index](README.md)

Try the example, connect a new host, or improve the build API. [Open an issue](https://github.com/yodaos-project/aiui-mcpkit/issues) with the client version, build command, and reproduction steps; reports from Claude Desktop and other MCP Apps hosts are especially useful.

| Command | Purpose |
| --- | --- |
| `npm run build` | Build the ESM library, types, and runtime templates |
| `npm run build:examples` | Build both examples and their shared marketplace |
| `npm run update:examples` | Update installed example UIs, servers, and manifests |
| `npm run start:examples` | Start Counter, or select `-- business` |
| `npm run typecheck` | Check TypeScript types |
| `npm test` | Run packaging, MCP, and browser tests |
| `npm run bench` | Measure rendering, server and packaging baselines |

Before submitting a code change:

```sh
npm run build:examples
npx playwright install chromium
npm run typecheck
npm test
```

Browser tests use the actual agent runtime in an MCP Apps `AppBridge` harness, covering input, state continuity, display modes, and a no-network CSP. You can select an existing Chromium through `CHROMIUM_PATH`; `/usr/bin/chromium` is also supported when available. Keep the English and Chinese READMEs aligned when updating documentation.

[Browse the source](https://github.com/yodaos-project/aiui-mcpkit) · [Report an issue](https://github.com/yodaos-project/aiui-mcpkit/issues) · [Explore AIUI](https://github.com/yodaos-project/AIUI)

## Run the benchmark correctness check

For changes to packaging, runtime or protocol behavior, run the same smoke workload as the Benchmark workflow:

```sh
npm run bench -- --samples 1 --operations 3 --idle-ms 250 \
  --server-calls 8 --out benchmark-results/ci
```

This tests all four real-WASM scenarios and server workloads; it does not enforce performance thresholds. Run on macOS/Linux. Full methodology and A/B measurements are in [benchmarks](reference/benchmarks.md). Passing local commands does not establish that a GitHub Actions run has passed; remote workflows require a pushed commit/PR.

## Documentation changes

Keep article pairs, language-switch links and topic indexes aligned. Update public examples when APIs change, use source-linked runnable examples, and distinguish host observations from browser-harness verification. Prefer adding detailed explanations to `docs/` over growing the root README. Preserve the benchmark forwarding pages for existing source-directory links.

---

[Documentation index](README.md) · Previous: [Benchmarks](reference/benchmarks.md)
