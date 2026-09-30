# AIUI MCPKit

[简体中文](README.zh-CN.md)

AIUI MCPKit is a framework for building MCP App plugins from developer-owned Ink applications. It packages Ink pages, the Ink Web Canvas/WASM runtime, an MCP Apps view, and a local stdio MCP server into a self-contained plugin. The repository itself is not a plugin or a plugin marketplace.

## Build the framework

Requires Node.js 22+.

```sh
npm ci
npm run build
```

This builds the framework CLI and runtime templates in `dist/`. It does not package an example or generate a plugin automatically. The npm package exposes the `aiui-mcpkit` command; in this checkout, run it with `node dist/cli.mjs`.

## Package your Ink application

Supply your own Ink source directory containing `app.json` and `.ink` pages:

```sh
node dist/cli.mjs --ink /path/to/my-app/ink --name my-app --out /path/to/my-app/dist/plugin
```

With the framework installed as an npm dependency, the equivalent command is:

```sh
npx aiui-mcpkit --ink ./ink --name my-app --out ./dist/plugin
```

`--ink` and `--name` are required. `--title` defaults to the name in `app.json`; `--page` defaults to its first `pages` entry. Page paths omit the `.ink` extension. `--tool` defaults to `open_app`; `--description` supplies the plugin and opener description. Without `--out`, output goes to `dist/<plugin-name>` relative to the current working directory. Use `--help` for options.

The generated plugin contains:

```text
.agents/plugins/marketplace.json
plugin.json
mcp.json
view.html
dist/server.mjs
```

These are build outputs, not framework source files. The server, view, and manifests use the application's identity and initial page. JS, Ink source files, and compressed browser WASM are embedded; the generated plugin needs Node.js 22+ but no npm install or external asset fetch. The current Ink bundle input reads files as UTF-8; binary asset packaging is not yet supported.

The output also includes a local marketplace manifest pointing to the plugin in the same directory. Add the generated output directory as the marketplace root; adding the framework repository itself is not supported. This follows the [official OpenAI local marketplace format](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually). You can also distribute the generated plugin through your own marketplace, or configure a compatible MCP Apps host to launch its `dist/server.mjs` with Node. The generated `mcp.json` uses `${PLUGIN_ROOT}` for portability. A browser-only host cannot launch the local stdio server.

## Counter example

The counter is sample application source in [examples/counter/ink](examples/counter/ink), independent of the framework runtime:

```sh
npm run build:example
npm run start:example
```

To install the generated example locally with a compatible Codex CLI:

```sh
codex plugin marketplace add ./dist/examples/counter
codex plugin add ink-counter@ink-counter-local
```

Restart the desktop host after installation. Rebuild the example and reinstall after changes; installed copies are cached separately from build output.

`build:example` builds the framework, then packages the sample as `ink-counter` under `dist/examples/counter/`, exposing `open_counter`. `start:example` starts its stdio MCP server. The counter demonstrates canvas input, storage where supported, and inline/fullscreen mode switching. Display mode changes use the host's confirmed response.

## Verify

```sh
npm run typecheck
npm run build:example
npx playwright install chromium
npm test
```

The tests verify packaging a separate developer application, stdio MCP tools/resources, and real Ink WASM rendering in an MCP Apps `AppBridge` browser harness. Browser tests use Playwright Chromium, `/usr/bin/chromium` when available, or `CHROMIUM_PATH` when specified. They check accepted/refused/unsupported display mode requests, input, state continuity, and a restrictive no-network CSP.

These checks do not verify a real ChatGPT desktop/Codex GUI host. Plugin discovery, placement, resource-size limits, and host CSP remain host-specific verification work. The browser view is minified; tests enforce an internal 10 MB resource-response budget, which is not a documented host limit. The embedded WASM still produces a roughly 10 MB HTML resource; the sandbox must allow WebAssembly compilation. The runtime supports inline/fullscreen when advertised by the host.
