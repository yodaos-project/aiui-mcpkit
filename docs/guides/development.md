# Edit, rebuild, repeat

English | [简体中文](development.zh-CN.md) · [Documentation index](../README.md)

**Prerequisites:** Node 22+ and installed repository dependencies. Updating installed plugins also needs a client connection. Commands below run from the repository root.

## Watch and reload locally

```sh
npm run watch:examples -- counter --input '{"initialCount":5}'
# Or: npm run watch:examples -- business
```

Open the printed loopback URL. Agent edits trigger complete builds and automatically replace the preview iframe using the real MCP Apps bridge and Ink/WASM. These independent plugins live in `dist/watch/<example>`; installed marketplace copies are not updated. Opening the URL needs no browser automation dependency. The preview supplies launch input and display context; business/host tool services require an integration harness.

For your own Agent, build the library first, then run the helper from any working directory:

```sh
node /path/to/aiui-mcpkit/scripts/build-plugin.mjs ./agent --name my-agent --watch \
  --out ./dist/my-agent --port 4173 --input '{"recordId":"42"}'
```

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

---

[Documentation index](../README.md) · Previous: [Client setup](clients.md) · Next: [Troubleshooting](troubleshooting.md)
