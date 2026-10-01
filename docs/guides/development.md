# Edit, rebuild, repeat

English | [简体中文](development.zh-CN.md) · [Documentation index](../README.md)

**Prerequisites:** a built example and a client connection. Commands below run from the repository root.

## Pick the update route

| Connection | After changing source |
| --- | --- |
| Installed repository examples in Codex | `npm run update:examples`, reload host/server, open a new card. |
| Directly registered example server | `npm run build:examples`, reload server, open a new View. |
| Your own Agent | Rerun its helper/ESM build; update or reinstall any installed copy, reload and open a new View. |
| Changes to library/runtime source | Rebuild the library before packaging; `build:examples` does both. |

Changing a handler schema requires regenerating declarations before typechecking. An existing View can retain old code even after server reload; use a newly opened card to verify the rebuild.

Edit the [Counter page](../../examples/counter/pages/counter/index.ink), the [business page](../../examples/business/pages/order/index.ink), or its [handlers](../../examples/business/mcp-server/handlers.ts), then run:

```sh
npm run update:examples
```

This rebuilds both examples in the shared marketplace and updates `view.html`, `dist/server.mjs`, `plugin.json` and `mcp.json` for each installed plugin. Reload the MCP server or desktop host and open a **new card** to use the new interface and handlers. Existing cards retain their current view.

The script uses `$CODEX_HOME` (default: `~/.codex`) and checks the matching version and `local` directories under `plugins/cache/aiui-mcpkit-examples`. Uninstalled examples are skipped; it fails if none are installed. To update one example at a custom installation path:

```sh
npm run update:examples -- --example business --plugin-dir /absolute/path/to/installed/business-demo
```

Without `--example`, `--plugin-dir` points to the marketplace cache directory containing `ink-counter/<version-or-local>` and `business-demo/<version-or-local>`. For directly configured MCP clients, rebuilding updates the registered generated server paths; reload those servers through the client.

To start one stdio server from the terminal, use `npm run start:examples` (Counter by default) or `npm run start:examples -- business`. Each marketplace plugin keeps its own server.

---

[Documentation index](../README.md) · Previous: [Client setup](clients.md) · Next: [Troubleshooting](troubleshooting.md)
