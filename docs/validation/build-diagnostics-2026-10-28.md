# Build identity and desktop update experiment — 2026-10-28

Related: [issue #9](https://github.com/yodaos-project/aiui-mcpkit/issues/9), [diagnostic guide](../guides/build-diagnostics.md), [中文指南](../guides/build-diagnostics.zh-CN.md).

## Local acceptance

Node **22.21.1**, published Ink **0.20.0-daily.20261027171530**, real QuickJS/WASM Worker host and Playwright Chromium:

```sh
npm run build:examples
npm run typecheck
INK_WORKER_BIN="$PWD/scripts/ink-worker-wasm.mjs" npm test
npm run bench -- --samples 1 --operations 3 --idle-ms 250 \
  --server-calls 8 --out benchmark-results/issue-9-node22
```

Build and type checks passed. All **79 tests passed**, with no skips. Coverage includes deterministic IDs across output directories, source additions/deletions, dependency fingerprints, unchanged URI references across release-version changes, legacy/malformed manifests, modified installed bytes, diagnosis categories, and propagation through both protocol eras. The real Ink View exposes its build without UI changes, compares matching/newer server results, and returns to `unknown` when a later result lacks identity.

The live stdio regression keeps server A running while replacing only `view.html` with build B. Reading the original URI succeeds and reports **server A / HTML B**; local byte inspection identifies the modified HTML. Custom HTML stays byte-for-byte unchanged. The update regression copies UI, server, Worker app and `build.json`, removes obsolete Worker files, validates before mutating destinations, and exercises the diagnostic command with observed IDs.

Benchmark smoke covers all four real-WASM scenarios and the server workloads. It is a correctness check, not a performance threshold or host-cache measurement. Reports remain in the ignored local benchmark output directory.

## Real desktop update experiment

Host: macOS, Codex desktop bundle `com.openai.codex`, version **26.1023.50603**, build **22391**. Counter was already installed through the older `ink-counter-local` marketplace, rather than the newer shared examples marketplace. Its actual cache directory was `$CODEX_HOME/plugins/cache/ink-counter-local/ink-counter/0.1.0`.

Observed sequence:

1. Called the actual connected `ink_counter.open_counter` tool with `{initialCount:9,label:"Issue 9 · before update"}`. It returned `AIUI MCPKit Counter opened.` No build identity was visible in the connected tool result. Local inspection found a legacy installation with no `build.json`.
2. Backed up that installation, built the changed Counter and updated the actual cache using the existing helper's explicit-directory route:

   ```sh
   node scripts/update-examples.mjs --example counter --plugin-dir "$INSTALLED_COUNTER"
   npm run diagnose:examples -- --example counter --plugin-dir "$INSTALLED_COUNTER"
   ```

3. The initial experimental build was `c26267733266a198182db4589671625d0e70827b3518e0ae497a1be1e77e0a92`. Source/output and installed-byte checks agreed. Called the actual desktop tool again with `{initialCount:10,label:"Issue 9 · after update"}`. It again returned the opener text without a model-visible build marker. Updating files alone therefore did **not establish** which server/document the desktop was using.
4. After final runtime refinements, repeated the installed-file update with build `6c1fc0ea6aff975ba8523c4a188c0e7ff6845a821653c0e4d6d229c1d0149867`. Source and both generated/installed byte checks were current/OK. A **separate fresh stdio probe** of those installed files returned this same ID in tool/resource metadata and HTML. Both original resource URIs remained readable:

   ```text
   ui://ink-counter/open_counter.html
   ui://ink-counter/open_countdown.html
   ```

The fresh probe verifies the installed server and returned HTML. It does not inspect the desktop's existing MCP process. The actual desktop tool result surface did not expose its `_meta`, so absence of visible identity does not by itself prove a legacy server. Read-only diagnostics correctly left these desktop observations as `SERVER_NOT_OBSERVED` and `VIEW_NOT_OBSERVED`, rather than reporting `CURRENT`.

The supported desktop `mcpapps` browser listed no expanded side-panel Apps during the experiment; inline cards are not inspectable through that backend. No loaded desktop document ID or screenshot was obtained. No desktop restart, connection reload, old-card replacement, host-cache invalidation or cache-hit inference is claimed. There was no forced refresh or cache-clearing operation. Opening a new card after reloading the connection and reading its document marker is the remaining host-side observation; the framework now supplies the evidence needed to perform it.

The experiment records an actual installed-client update and its observational limits. It does not substitute the browser harness or fresh stdio probe for desktop View acceptance.
