# AIUI MCPKit

[简体中文](README.zh-CN.md)

A small feasibility prototype: an interactive [MCP App](https://github.com/modelcontextprotocol/ext-apps) whose counter is **rendered by Ink Web 0.18 on Canvas/WASM**. The view starts inline and can request fullscreen from a capable host, then return inline. The host's returned mode is authoritative. This is one example, not a framework API.

## Use locally in ChatGPT desktop / Codex GUI

Requires Node.js 22+ on the **same computer as the desktop host**, and a host version that accepts local plugin marketplaces and MCP Apps. Clone the repository, then from its root:

```sh
codex plugin marketplace add .
codex plugin add aiui-mcpkit@aiui-mcpkit-local
```

The repository's [marketplace](.agents/plugins/marketplace.json) points to [the self-contained plugin](plugins/aiui-mcpkit/). Restart the desktop app, enable **AIUI MCPKit** in Plugins, and ask “Open the AIUI counter.” The `open_counter` MCP tool supplies the view. Click **+ Add one**, **Fullscreen**, then **Inline**. If the host does not advertise fullscreen, the button is disabled; a refused request leaves the confirmed mode unchanged. Desktop placement may be a side panel rather than a literal screen-filling window.

The portable [mcp.json](plugins/aiui-mcpkit/mcp.json) runs `node ${PLUGIN_ROOT}/dist/server.mjs` over stdio. No npm install, web server, tunnel, credentials, or external asset fetch is needed for an installed release. The host must run the process locally; a browser-only ChatGPT session cannot launch this local stdio package. If your ChatGPT build does not expose local plugin marketplaces or MCP App views, use a supported desktop/Codex GUI build; this repository has not been verified in a real ChatGPT host.

## Develop and verify

```sh
npm ci
npm run typecheck
npm run build
npm test
```

`npm run build` embeds the Ink `.ink` bundle and compressed nonshared browser WASM into one local HTML UI resource and bundles the Node MCP server under `plugins/aiui-mcpkit/`. Rebuild before reinstalling after source edits. `npm test` needs `/usr/bin/chromium`; it uses an MCP Apps `AppBridge` host harness to exercise actual WASM rendering, canvas input, resize, accepted/refused/unsupported display mode requests, state continuity, and a restrictive no-network CSP. It also performs a stdio MCP tool/resource round trip. The tests are a harness, not a ChatGPT desktop verification.

The Ink page lives in [ink/pages/counter/index.ink](ink/pages/counter/index.ink). Its count is stored with Ink's `wx` storage where available; the live view is retained and resized during display-mode changes. The MCP server emits protocol messages only on stdout. The resource declares no external connection or resource domains. All JS, Ink assets, and WASM are local. The compressed WASM makes the HTML resource about 10 MB, which may exceed an individual host's view-resource limit. A host also needs to allow local WebAssembly compilation in its sandbox CSP; the test harness allows `wasm-unsafe-eval`.

## Scope and verification limits

- Verified in the cloud Linux workspace: `npm run typecheck`, `npm run build`, `npm test` (4 tests), and local Codex CLI marketplace installation using an isolated configuration directory.
- Pending on a real ChatGPT desktop/Codex GUI host: plugin discovery, UI placement, its exact CSP/resource-size policy, and visual mode switching. Nothing was installed on the user's Mac.
- Claude Desktop and other MCP Apps hosts are possible future targets, but compatibility has not been tested here.

Protocol references: [MCP Apps specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx), [OpenAI plugin packaging and local marketplace](https://developers.openai.com/plugins/build/plugins), [Ink Web SDK](https://www.npmjs.com/package/@yodaos-pkg/ink).
