# Edit, preview and update

English | [简体中文](development.zh-CN.md) · [Learning path](../README.md)

**Use this when:** you have [a working app](../getting-started/first-agent.md) and want a repeatable edit/preview loop, or need to update the copy installed in a client. Run commands from the repository root after `npm ci`.

## 1. Choose the copy you are working on

| You are using | What to do after editing source |
| --- | --- |
| **Browser preview** | Keep the watcher running; it rebuilds and reloads automatically. |
| **Directly registered server** | Rebuild its output, restart the client's MCP connection and open a fresh View. |
| **Installed plugin** | Rebuild, update/reinstall the client's copied plugin, restart its connection and open a fresh View. |

## 2. Edit with a local preview

For a repository example:

```sh
npm run watch:examples -- counter
```

Open the URL from the terminal's `preview` line. Change `examples/counter/pages/counter/index.ink`, save and wait for a successful build. [Your first edit](../getting-started/edit-example.md) shows exactly which line to change.

For the app from the page-tool lesson:

```sh
node scripts/build-plugin.mjs ./my-agent --name my-agent --out ./dist/my-agent --watch --input '{"initialCount":5}'
```

Before adding its required input schema, you can omit `--input`. The helper needs the library built once with `npm run build`.

A successful reload starts a fresh App/Page instance and resets in-memory state. A failed build leaves the previous successful preview running; fix the terminal diagnostic and save again. Press Ctrl+C to stop. Choose a dedicated output directory: the watcher owns and replaces its whole contents.

The ordinary preview shows UI and launch input. Server business calls and conversation services need a supporting client or test harness.

## 3. Update the client copy deliberately

The watcher writes `dist/watch/counter/` for the Counter example. Installable examples are built separately into `dist/examples/`; neither folder automatically replaces the client's cached plugin.

For an already-installed repository Counter:

```sh
npm run update:examples -- --example counter
```

Then reload the client's server/host and open a new View. For your own app, rerun its build command and use the client's update/reinstall flow. `update:examples` handles the repository examples, not your `my-agent` app.

**Checkpoint:** a saved edit appears in the browser; after updating a client, its new View shows the same change. If it does not, use [build diagnostics](build-diagnostics.md).

## Advanced: build-system integration and exact reload behavior

<details>
<summary>ESM watch API, rebuild ordering and lifecycle guarantees</summary>

`--no-preview` watches/builds without serving a preview. Ctrl+C/SIGTERM stops polling and waits for the in-flight build to be discarded. The watcher owns its entire output directory: use an empty directory or the same built plugin, and keep unrelated files elsewhere. `typesFile` must be inside the output so declarations and artifacts publish together.

Use the same loop through ESM, without logging or changing the working directory:

```js
import { watchPlugin } from '@yodaos-pkg/aiui-mcpkit';
const watcher = await watchPlugin({
  source: './agent', name: 'my-agent', outputDir: './dist/my-agent',
  preview: { input: { recordId: '42' }, displayMode: 'fullscreen' },
  pollInterval: 200, debounce: 100,
  watchPaths: ['./shared'], // optional external files/directories
  onEvent(event) {
    console.log(event.sequence, event.phase, event.build?.id, event.diagnostics);
  },
});
console.log(watcher.previewUrl, watcher.state);
// await watcher.rebuild(); // complete rebuild; waits for queued edits
// await watcher.close();
```

`watchPlugin()` resolves after the first attempt, even if that attempt failed, allowing recovery after source fixes. `state` and `onEvent` provide isolated snapshots. Phases are `building`, `ready`, `failed`, `superseded`, and `closed`. `sequence` identifies an attempt; `build.id` always identifies the last successfully published artifacts. Diagnostics include source paths and line/column where available. `recovered: true` marks the first success after failure. The browser banner and CLI JSON events expose these values.

Content polling handles atomic saves, additions and deletions; `debounce` coalesces edits before starting. Builds run serially in staging directories. Source/dependency changes found before publication discard the stale attempt. Failed or superseded attempts retain the last successful artifacts and running preview. Successful publication replaces the complete generation, including Worker files. Local transitive esbuild imports are watched after discovery; use `watchPaths` for external files/directories needed before a first successful build. Package changes under `node_modules` require explicit rebuild/restart. After library `src/` changes, run `npm run build` and restart the watcher to load updated ESM/runtime templates.

### Reload actions and state

| Change | Local preview | External-host action |
| --- | --- | --- |
| Page, CSS, image, App code or browser adapter | Load the new View | Update installation, reload the MCP connection for current build metadata, open a new card |
| Server handler/import or Worker code (including possible shared JS/JSON dependencies) | Load the new View | Update installation, restart the MCP server, open a new card |
| `app.json` or page-tool schema/metadata | Load the new View | Update installation, reload the plugin/MCP connection, rediscover tools/resources, open a new card |

Each changed successful build reloads the local iframe. **App/Page memory and navigation reset**, and configured launch input is delivered again. Browser storage stays on the same preview origin; an explicitly configured restoration adapter may restore its own scoped state. This loop does not preserve live module state. Failed builds leave the running preview and its state intact.

After success, `state.action` is `reload-view`, `restart-server`, or `refresh-manifest`; it is `none` during builds/failures. `hostSteps` provides manual instructions. The watcher does not restart real-host stdio connections, copy installed plugins, or bypass host caching. Compare the actual server `_meta.mcpkit.build.id` and loaded View marker with the successful ID. If a new card remains stale, use [build diagnostics](build-diagnostics.md) to inspect the connection and host resource cache. Local reload does not verify desktop or model behavior.

</details>

<details>
<summary>Installed plugin paths, update helpers and diagnostics</summary>

## Pick the update route

| Connection | After changing source |
| --- | --- |
| Installed repository examples in Codex | `npm run update:examples`, reload host/server, open a new card. |
| Directly registered example server | `npm run build:examples`, reload server, open a new View. |
| Your own Agent | Rerun its helper/ESM build; update or reinstall any installed copy, reload and open a new View. |
| Changes to library/runtime source | Rebuild the library before packaging; `build:examples` does both. |

Changing a handler schema requires regenerating declarations before typechecking. An existing View can retain old code even after server reload; use a newly opened card to verify the rebuild.

Edit the [Counter page](../../examples/counter/pages/counter/index.ink), the [business page](../../examples/business/pages/order/index.ink), or its [Worker actions](../../examples/business/workers/business.js), then run:

```sh
npm run update:examples
```

This rebuilds all examples in the shared marketplace and updates `view.html`, `dist/server.mjs`, `plugin.json`, `mcp.json` and `build.json` for each installed plugin, plus Business Demo's `worker-app/`. Reload the MCP server or desktop host and open a **new card** to use the new interface and Worker actions. Existing cards retain their current view. Business calls require `ink-worker` on the server process's PATH or configured through `INK_WORKER_BIN`.

The script uses `$CODEX_HOME` (default: `~/.codex`) and checks the matching version and `local` directories under `plugins/cache/aiui-mcpkit-examples`. Uninstalled examples are skipped; it fails if none are installed. To update one example at a custom installation path:

```sh
npm run update:examples -- --example business --plugin-dir /absolute/path/to/installed/business-demo
```

Without `--example`, `--plugin-dir` points to the marketplace cache directory containing `ink-counter/<version-or-local>` and `business-demo/<version-or-local>`. For directly configured MCP clients, rebuilding updates the registered generated server paths; reload those servers through the client.

To start one stdio server from the terminal, use `npm run start:examples` (Counter by default) or `npm run start:examples -- business`. Each marketplace plugin keeps its own server.

Use `npm run diagnose:examples -- --example counter --plugin-dir /absolute/path/to/installed/ink-counter` to compare source/build and installed bytes without changing them. For actual server/View IDs, cache diagnosis and URI upgrade rules, see [build diagnostics](build-diagnostics.md). The update helper does not restart servers or clear host caches.

</details>

**Next, if needed:** [Troubleshoot a failure](troubleshooting.md) or [verify a preview automatically](preview-verification.md).
