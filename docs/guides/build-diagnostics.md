# Build identity and stale Views

English | [简体中文](build-diagnostics.zh-CN.md) · [Learning path](../README.md)

**Use this when:** You saved and rebuilt, but the client still shows an old app or tool definition.

**Before you start:** Read [the source/build/installed update workflow](development.md). A build ID is a fingerprint for one generated version; compare it across each copy before changing cache settings.

Every build produces `build.json` and a content-derived SHA-256 build ID. The ID covers source, bundled runtime/dependencies, build configuration and the server/View payloads. Rebuilding identical inputs in a different output directory keeps the ID; source, options or runtime changes produce another ID. Plugin `version` remains a separately chosen release version. No timestamp or Git checkout is required.

## Inspect each layer

| Layer | Evidence |
| --- | --- |
| Source and generated output | `result.build`, `result.files.build`, or `build.json`. `inspectBuild(directory, true)` compares source/dependency hashes, added/deleted source files and artifact bytes. |
| Installed files | `inspectBuild(installedDirectory)` verifies hashes against the installed `build.json`. A copied manifest alone is insufficient. |
| Running server | `_meta.mcpkit.build` in actual `tools/list`, `resources/list`, tool results and resource contents. Observe the client's response: starting a new stdio process does not inspect its existing process. |
| Returned HTML | Generated `resources/read` contents include `_meta.mcpkit.viewBuildId`, extracted from the actual HTML bytes. This can differ from the serving process's build after an incomplete update. |
| Loaded generated View | `document.querySelector('meta[name="mcpkit-build-id"]').content` or `document.body.dataset.mcpkitBuildId`. After a tool result, `mcpkitServerBuildId` and `mcpkitBuildState` (`current`/`mismatch`) compare that response with this document; before a result the state is `unknown`. |

These markers are inspectable without adding developer text to the product UI. Arbitrary `uiResources[].html` is served unchanged: its response reports the server build, but `viewBuildId` is `null` unless the author supplied a build marker. Such resources manage their own loaded-document diagnostics. Local provenance paths/hashes are in `build.json` only; MCP and generated HTML expose just the public identity, not source paths or contents. Keep `build.json` local if those paths are private.

`inspectBuild()` is a local consistency check, not a signature or tamper-proof provenance record. Expected local edits (for example `mcp.json` environment overrides) are reported as changed artifacts; inspect those differences before updating.

## Run diagnostics

Build the library/examples first, then inspect without rebuilding or updating anything:

```sh
npm run diagnose:examples -- --example counter --plugin-dir /absolute/path/to/installed/ink-counter
```

Without `--plugin-dir`, the script checks the current-version and `local` caches under `$CODEX_HOME/plugins/cache/aiui-mcpkit-examples` (default `~/.codex`). Other registrations, including the older `ink-counter-local` marketplace, need their actual installed directory. When both locations exist, both are inspected. An uninstalled default location is reported explicitly; an incorrect explicit path fails.

Supply IDs observed in the actual desktop tool response and document:

```sh
npm run diagnose:examples -- --example counter \
  --plugin-dir /absolute/path/to/installed/ink-counter \
  --server-build SERVER_ID --view-build VIEW_ID --existing-card
```

Use `--new-card` only after opening a new card. Without either flag a stale View's cause remains unknown. Missing observations are reported as `SERVER_NOT_OBSERVED` / `VIEW_NOT_OBSERVED`; absence is not proof of a cache. The script does not connect to or restart the desktop server.

For your own Agent, use the same API:

```js
import { inspectBuild, diagnosePlugin } from '@yodaos-pkg/aiui-mcpkit';
console.log(await inspectBuild('./dist/my-agent', true));
console.log(await diagnosePlugin({
  buildDir: './dist/my-agent', installedDir: '/absolute/path/to/installed/my-agent',
  serverBuildId: 'observed-server-id', viewBuildId: 'observed-document-id', newCard: true,
}));
```

## Follow the evidence

| Finding | Next step |
| --- | --- |
| `REBUILD_REQUIRED` | Rebuild from the changed source/dependencies. Pre-diagnostics artifacts also require rebuilding. |
| `BUILD_ARTIFACTS_MODIFIED` | Regenerate inconsistent output; do not copy just `build.json`. |
| `INSTALL_UPDATE_REQUIRED` | Update the actual configured installation, including UI, server, manifests and Worker files. |
| `SERVER_RELOAD_REQUIRED` | Reload the client's MCP connection/server after updating disk files. |
| `EXISTING_CARD` | Open a new card. The old View retains its document and running App. |
| `VIEW_STALE` | Inspect a newly opened card before assigning a cause. |
| `HOST_CACHE_SUSPECTED` | The observed server/files match but a newly opened document differs. Check duplicate registrations and client cache/reload behavior. This is a hypothesis, not proof of the host's cache internals. |
| `SOURCE_UNAVAILABLE` | Original provenance paths are unavailable on this machine. Verify/rebuild on the source machine; installed-byte integrity can still be checked. |
| `CURRENT` | Source/output and every supplied observation agree. No desktop claim is made for observations you did not supply. |

`npm run update:examples` rebuilds and validates before copying. It writes `build.json` last so a partial update remains detectable. Standalone `node scripts/update-examples.mjs` rejects stale source/output. The update helper does not clear caches, replace already running Apps, or restart the host. See the [desktop update experiment](../validation/build-diagnostics-2026-10-28.md) for observed behavior and limits.

## Stable resource URIs and upgrades

Generated addresses are stable across build IDs and release versions:

- Fallback: `ui://<plugin-name>/app.html`.
- Page tool: `ui://<plugin-name>/<tool-name>.html`.
- Shared App: `ui://<plugin-name>/applications/<application-id>.html`.
- Explicit `toolMetadata` / `uiResources` URIs retain the author's exact address.

No hash/version/query is appended to these addresses. Adding diagnostics preserves existing references and aliases, including `ui/resourceUri`. Old installations/Views without build markers remain usable; diagnostics label their evidence legacy or unobserved rather than guessing an ID.

Renaming a plugin/tool/application or removing a resource changes its public address. For a compatible upgrade, retain the original identifier/resource while introducing the replacement; use `uiResources` to keep author-managed HTML at a former address and `toolMetadata` to select the new entrypoint. For a generated App, keep its original registered tool/application as the old route until clients migrate. Before a breaking removal, document the old/new URI mapping, update client/plugin registration, reload discovery and open new cards. Existing cards cannot be migrated or forcibly refreshed by this framework. A new ID detects a build; it does not invalidate the host cache or provide semantic API compatibility.

**Next, if needed:** [Follow symptom-based troubleshooting](troubleshooting.md).
