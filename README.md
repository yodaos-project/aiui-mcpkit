# AIUI MCPKit

**Bring Ink applications to MCP Apps.**

AIUI MCPKit turns your [Ink](https://github.com/yodaos-project/ink) application into an interactive MCP App plugin. Write your interface in Ink, build it with one command, and open it in a compatible AI client.

The toolkit packages your pages, the Ink Web runtime, and an MCP server together, so you can focus on the application instead of writing host integration code.

[简体中文](README.zh-CN.md) · [Quick start](#quick-start) · [Build your app](#build-your-app) · [Development](#development) · [Issues](https://github.com/yodaos-project/aiui-mcpkit/issues)

## Features

- **Your Ink application, packaged as a plugin.** Use your own pages, application name, and opener tool.
- **Self-contained output.** JavaScript, Ink source, and compressed WebAssembly are bundled; the generated plugin runs without installing npm dependencies.
- **Inline and fullscreen layouts.** Host display modes map to Ink's `_current` and `_blank` targets, so one page can reveal more content when expanded.
- **Ready for local installation.** Every build includes plugin metadata, stdio MCP configuration, and a local marketplace manifest.

## Quick start

You need **Node.js 22+**, npm, and a compatible desktop host with MCP Apps and local stdio support. The installation commands below use a Codex CLI that supports `codex plugin`.

Clone the repository and build the Counter example:

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
npm ci
npm run build:example
```

Install the generated plugin:

```sh
codex plugin marketplace add ./dist/examples/counter
codex plugin add ink-counter@ink-counter-local
```

Restart the desktop host after the initial installation, then open **AIUI MCPKit Counter**. In a host that exposes local MCP tools, you can also invoke `open_counter`.

The [Counter example](examples/counter/ink) uses AIUI's monochrome-green design. Inline mode shows the count and an increment action; fullscreen adds session statistics, recent activity, and quick actions. The host controls expansion, while the plugin view displays only the Ink canvas.

## Build your app

### 1. Prepare your Ink source

An application contains an `app.json` manifest and its Ink pages:

```text
my-app/
└── ink/
    ├── app.json
    └── pages/
        └── home.ink
```

`app.json`:

```json
{
  "name": "My App",
  "pages": ["pages/home"]
}
```

`pages/home.ink`:

```html
<page>
  <view>
    <text>Hello from Ink</text>
  </view>
</page>
```

Page paths in `app.json` omit the `.ink` extension. For a working example with state and input handlers, see the [Counter page](examples/counter/ink/pages/counter/index.ink).

### 2. Package the application

From the MCPKit checkout:

```sh
npm run build
node dist/cli.mjs \
  --ink /path/to/my-app/ink \
  --name my-app \
  --out /path/to/my-app/dist/plugin
```

Keep the source and output directories separate; neither may contain the other.

### 3. Install the plugin

```sh
codex plugin marketplace add /path/to/my-app/dist/plugin
codex plugin add my-app@my-app-local
```

The generated directory is the marketplace root. Each build creates a marketplace named `<plugin-name>-local` and an opener tool named `open_app` by default.

### CLI options

| Option | Description | Default |
| --- | --- | --- |
| `--ink` | Ink source directory | Required |
| `--name` | Plugin identifier: lowercase letters, numbers, and hyphens; starts with a letter | Required |
| `--out` | Plugin output directory | `dist/<plugin-name>` |
| `--title` | Display name | `app.json` name, then plugin name |
| `--description` | Plugin and opener tool description | `Open <title>, an interactive Ink app.` |
| `--tool` | Opener tool name | `open_app` |
| `--page` | Initial page path, without `.ink` | First `app.json` pages entry |
| `--help` | Show command help | — |

## How it works

```text
Ink source → MCPKit build → Plugin package → MCP Apps host → Ink canvas
```

The generated stdio MCP server registers an opener tool and a `ui://` HTML resource. The host loads that resource into its app view, where Ink Web renders your application through Canvas2D and WebAssembly. Host display-mode changes update the Ink target without reopening the application.

Each build produces:

```text
plugin/
├── plugin.json                       # Plugin identity and display metadata
├── mcp.json                          # Portable stdio server configuration
├── view.html                         # Embedded application and Ink runtime
├── dist/server.mjs                   # Bundled MCP server
└── .agents/plugins/marketplace.json  # Local installation catalog
```

You can distribute this directory through your own marketplace or configure another compatible MCP Apps host to run `node /path/to/plugin/dist/server.mjs`. The generated `mcp.json` resolves server paths through `${PLUGIN_ROOT}`.

## Development

### Update the installed example

After editing the Counter's Ink page or browser view, run:

```sh
npm run update:example
```

This rebuilds the example and atomically replaces the installed `ink-counter` plugin's `view.html`. Open a new Counter card to load the updated UI; existing cards retain their current view.

The script uses `$CODEX_HOME`, defaulting to `~/.codex`, and checks the matching version and `local` cache directories. To select a different installation:

```sh
npm run update:example -- --plugin-dir /absolute/path/to/installed/plugin
```

This updates the view only. MCP server or manifest changes require reinstalling and reloading the plugin. If the desktop host caches the UI resource, a restart may still be needed.

### Project commands

| Command | Purpose |
| --- | --- |
| `npm run build` | Build the CLI and runtime templates |
| `npm run build:example` | Build and package the Counter example |
| `npm run update:example` | Build and replace the installed Counter view |
| `npm run start:example` | Start the generated stdio MCP server |
| `npm run typecheck` | Check TypeScript types |
| `npm test` | Run packaging, MCP, and browser tests |

For the test suite, build the example and install Playwright Chromium first:

```sh
npm run build:example
npx playwright install chromium
npm run typecheck
npm test
```

Browser tests render real Ink WASM in an MCP Apps `AppBridge` harness and cover input, state continuity, host-driven display modes, and a restrictive no-network CSP. Chromium can also be selected through `CHROMIUM_PATH` or `/usr/bin/chromium` when available.

## Compatibility

AIUI MCPKit currently produces local **stdio** plugins. A host must support MCP Apps, launching Node.js processes, and WebAssembly compilation in its UI sandbox. Inline, fullscreen, and sidebar entrypoints depend on host support.

- **Resources:** source files are read as UTF-8; binary asset packaging is not yet supported. The embedded runtime makes the HTML resource roughly 10 MB, so host resource limits matter.
- **Tool access:** a plugin appearing in a picker or sidebar does not establish model access to its local tools. Chat model invocation of this generated local plugin remains unverified. For an account-connected HTTPS MCP integration, follow the [developer connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt).
- **Verification:** automated tests cover the generated package and browser harness. Plugin discovery, resource caching, placement, and sandbox policies should also be checked in your target desktop host.

## Contributing

Bug reports and pull requests are welcome. For a host integration issue, include the host and CLI versions, the build command, and the steps needed to reproduce it. For code changes, run the checks above and keep the English and Chinese READMEs aligned.

[Report an issue](https://github.com/yodaos-project/aiui-mcpkit/issues) · [Browse the source](https://github.com/yodaos-project/aiui-mcpkit)
