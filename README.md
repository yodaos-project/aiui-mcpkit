# AIUI MCPKit

**Turn your AIUI Agent into an interactive app inside an AI client.**

AI conversations can do more than return text. With AIUI MCPKit, your agent can show a page with buttons, live state, and a layout that expands when the user opens it fullscreen.

Write the interface as an [AIUI Agent](https://github.com/yodaos-project/AIUI), then package it with MCPKit. The build includes the interface, its runtime, and the MCP server needed to connect it to a compatible client.

[简体中文](README.zh-CN.md) · [Try the example](#try-the-example) · [Create your own agent](#create-your-own-agent) · [Use the ESM library](#use-the-esm-library) · [Choose a client](#choose-a-client) · [Contribute](#contribute)

## Why MCPKit?

- **Give users something to interact with.** Start with the Counter, then use the same packaging workflow for your own agent pages.
- **Adapt to the space available.** Show the essentials inline and more controls or detail fullscreen. Host modes map to the agent's `_current` and `_blank` targets.
- **Keep the build in your toolchain.** Import `buildPlugin()` from `@yodaos-pkg/aiui-mcpkit`; the ESM API includes TypeScript declarations.
- **Ship a self-contained plugin directory.** Agent source, JavaScript, and compressed WebAssembly are bundled. The generated server still needs Node.js, but no separate npm install.
- **Reuse the server across compatible clients.** Codex gets plugin installation metadata; other local MCP Apps clients can connect to the generated server directly.

New to these terms? An **AIUI Agent** is the app you write. **MCP** connects an AI client to tools. **MCP Apps** lets those tools also provide an interactive interface. **MCPKit** packages these pieces together.

## Try the example

Start here if you want to see what the project does before writing code. This walkthrough builds the Counter and installs it for **Codex Desktop**.

### 1. Prepare your tools

Install [Node.js](https://nodejs.org/en/download) **22 or newer** (includes npm), [Git](https://git-scm.com/downloads), Codex Desktop, and a Codex CLI version with `codex plugin` support. Run the commands below in a terminal.

Already using Claude Desktop or VS Code? Complete step 2, then follow [your client's setup](#choose-a-client).

### 2. Download and build

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
npm ci
npm run build:example
```

The Counter plugin is now in `dist/examples/counter`. Keep the terminal in this repository for the next step.

### 3. Install in Codex

```sh
codex plugin marketplace add ./dist/examples/counter
codex plugin add ink-counter@ink-counter-local
```

The first command registers the local plugin catalog; the second installs the Counter. Copy the identifiers as shown: they must match the generated metadata.

Restart Codex Desktop after the initial installation, then open **AIUI MCPKit Counter** from the plugin's UI entrypoint. In a Codex chat with the local tool available, you can also ask it to call `open_counter`.

### 4. Explore the interface

The Counter uses AIUI's monochrome-green design. Click **+ ADD ONE** to change the count. In a host with fullscreen support, expand the view to see session statistics, recent actions, and additional controls.

The [example source](examples/counter/ink/pages/counter/index.ink) shows how the page handles state and adapts its layout. The inline Counter has been observed in Codex Desktop; fullscreen behavior is tested in the browser harness.

## Create your own agent

Once the example works, replace it with your own page. You can start with this minimal project:

```text
my-agent/
└── agent/
    ├── app.json
    └── pages/
        └── home.ink
```

`app.json` gives the app a name and lists its pages:

```json
{
  "name": "My Agent",
  "pages": ["pages/home"]
}
```

`pages/home.ink` defines the first screen:

```html
<page>
  <view>
    <text>Hello from AIUI Agent</text>
  </view>
</page>
```

Page paths in `app.json` omit the `.ink` extension. For buttons and state, use the [Counter page](examples/counter/ink/pages/counter/index.ink) as a working reference.

From the MCPKit repository, run the local build helper. Replace `/path/to/my-agent` with your project's actual path:

```sh
npm run build
node scripts/build-plugin.mjs /path/to/my-agent/agent \
  --name my-agent \
  --out /path/to/my-agent/dist/plugin
```

Use separate source and output directories; neither may contain the other. The helper is for development in this repository. The package's public integration API is the [ESM library](#use-the-esm-library).

To install your new plugin in Codex:

```sh
codex plugin marketplace add /path/to/my-agent/dist/plugin
codex plugin add my-agent@my-agent-local
```

Reload the desktop host after installation. Your agent's opener tool is `open_app` by default. Other clients can [connect directly to its server](#choose-a-client).

## Use the ESM library

For developers building a packaging tool or an automated pipeline, call MCPKit directly from JavaScript. There is no need to launch a CLI subprocess.

To try the package from this checkout, run `npm pack` in the MCPKit repository. It builds the library and produces `yodaos-pkg-aiui-mcpkit-0.1.0.tgz`. Then install that file in your own Node.js project:

```sh
npm install /absolute/path/to/aiui-mcpkit/yodaos-pkg-aiui-mcpkit-0.1.0.tgz
```

Create `build-agent.mjs` in your project:

```js
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

const result = await buildPlugin({
  source: './agent',
  name: 'my-agent',
  outputDir: './dist/plugin',
  version: '1.0.0',
});

console.log(result.outputDir);
console.log(result.files.view);
```

Run it with `node build-agent.mjs`. Relative paths resolve from the directory where you run the command. The result contains plugin identity, the absolute output directory, the marketplace name, and generated file paths.

The API exports `BuildPluginOptions` and `BuildPluginResult`. It reports errors by rejecting the promise, without logging, exiting, or changing the working directory. This is the integration point for tools such as AIX; `aix pack --target mcp-apps` is planned for separate implementation in AIX.

## Choose a client

**Supporting MCP tools alone is not enough to display the interface.** A client also needs MCP Apps UI support. The current build uses **stdio**: the client starts a local Node.js process and communicates with it through standard input and output.

| Client | How to connect | What to expect |
| --- | --- | --- |
| Codex Desktop | Install the local plugin | Counter inline UI observed; fullscreen tested in browser harness |
| Codex CLI | Local plugin or direct MCP registration | Installation and terminal tool calls; use Desktop for graphical UI |
| Claude Desktop | Local MCP server configuration | Officially listed as an MCP Apps host; this project's UI not yet tested |
| VS Code / Copilot Chat | Workspace MCP configuration | Documents MCP Apps support; this project's UI not yet tested |
| Other local MCP Apps clients | Client-specific stdio configuration | Requires compatible UI sandbox and resource limits |
| Remote / HTTP-only clients | Additional HTTP server transport | Not generated by MCPKit today |

### Codex Desktop

Follow the [example walkthrough](#try-the-example) to install the local plugin, then open it in Desktop. Entrypoint placement and local tool availability depend on the app version and chat surface. See the official [local plugin installation guide](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually).

### Codex CLI

The CLI installs plugins and calls their tools. Start a new CLI session after installation and ask it to call `open_counter`. The opener returns a text response; use Desktop to interact with the graphical view.

For a direct MCP connection, use this **instead of** the plugin installation commands:

```sh
codex mcp add aiui-counter -- node /absolute/path/to/aiui-mcpkit/dist/examples/counter/dist/server.mjs
```

Choose one registration method to avoid duplicate tools. See the official [MCP configuration guide](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

### Claude Desktop

Claude Desktop is on the official [MCP Apps host list](https://modelcontextprotocol.io/extensions/apps/overview), and the SDK documents [local stdio connections](https://github.com/modelcontextprotocol/ext-apps#with-mcp-clients). The generated server follows that connection model; the complete UI still needs testing in Claude Desktop.

After building the example, merge this entry into `claude_desktop_config.json`. Replace the placeholder with the absolute path to your repository and preserve any existing server entries:

```json
{
  "mcpServers": {
    "aiui-counter": {
      "command": "node",
      "args": ["/absolute/path/to/aiui-mcpkit/dist/examples/counter/dist/server.mjs"]
    }
  }
}
```

The configuration lives at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows. If Claude cannot find Node.js, replace `node` with its absolute executable path. Restart Claude Desktop, then call `open_counter` in a surface that exposes the configured server. See the [local-server setup guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers).

Codex marketplace commands do not install a Claude extension. MCPKit currently generates neither a `.mcpb` extension nor an HTTPS server for web/mobile connectors. See [Claude connector options](https://support.claude.com/en/articles/11725091-when-to-use-desktop-and-web-connectors) for those workflows.

### VS Code and other clients

For VS Code, put the same `mcpServers` configuration above in the workspace-root `.mcp.json`. Start the server through **MCP: List Servers**, then invoke `open_counter` in Copilot Chat. Follow the official [VS Code MCP guide](https://code.visualstudio.com/docs/agent-customization/mcp-servers) for version and setting requirements.

For another client, check the [MCP Apps host list](https://modelcontextprotocol.io/extensions/apps/overview) and register `node` with the absolute path to `dist/server.mjs` using its own configuration format. When connecting your own agent, replace the example server path and use your configured opener tool name.

OpenAI sidebar entrypoints are client-specific. A different host may render the standard app view with different expansion controls.

## Edit, rebuild, repeat

To change the Counter, edit its [page](examples/counter/ink/pages/counter/index.ink), then run:

```sh
npm run update:example
```

This rebuilds the example and replaces `view.html` in the installed Codex Counter plugin. Open a **new Counter card** to request the new interface. Existing cards keep their current view; if the host caches the resource, a restart may still be needed.

The script uses `$CODEX_HOME` (default: `~/.codex`) and checks the matching version and `local` cache directories. To specify the installation directory yourself:

```sh
npm run update:example -- --plugin-dir /absolute/path/to/installed/plugin
```

This shortcut updates the Counter view only. Server or manifest changes require reinstalling and reloading the plugin. For Claude Desktop or another directly configured client, rebuild the plugin at its registered path and reload the server through that client.

## Build reference

### Generated files

```text
plugin/
├── plugin.json                       # Plugin name and display metadata
├── mcp.json                          # Plugin-host stdio configuration
├── view.html                         # Agent interface and embedded runtime
├── dist/server.mjs                   # Bundled MCP server
└── .agents/plugins/marketplace.json  # Local Codex installation catalog
```

The server exposes an opener tool and a `ui://` HTML resource with MIME type `text/html;profile=mcp-app`. The host loads the resource into its app view and forwards display-mode changes to the agent. In the generated `mcp.json`, `${PLUGIN_ROOT}` is resolved by the plugin host; manual client configurations need real paths.

### API and helper options

| ESM option | Local helper argument | Default |
| --- | --- | --- |
| `source` | `[source]` | API: required; helper: current directory |
| `name` | `--name` | Required |
| `outputDir` | `--out` | `dist/<name>` |
| `title` | `--title` | `app.json` name, then plugin name |
| `description` | `--description` | Generated from the display name |
| `tool` | `--tool` | `open_app` |
| `page` | `--page` | First page in `app.json`, without `.ink` |
| `version` | `--version` | `0.1.0` |

Plugin names start with a lowercase letter and contain lowercase letters, numbers, or hyphens. Tool names contain 1–128 letters, numbers, underscores, or hyphens. Use `node scripts/build-plugin.mjs --help` for helper usage. If you omit `[source]`, set `--out` outside the current directory to keep source and output separate.

### Current scope

The UI host must allow WebAssembly compilation. The embedded HTML is roughly 10 MB, so resource size limits also matter. Source files are read as UTF-8; packaging binary assets is not supported yet.

Automated tests cover packaging, MCP tool/resource responses, and the browser runtime. They do not establish full compatibility with every desktop host, account-connected tool access, or resource-cache behavior.

## Contribute

Try the example, connect a new host, or improve the build API. [Open an issue](https://github.com/yodaos-project/aiui-mcpkit/issues) with the client version, build command, and reproduction steps; reports from Claude Desktop and other MCP Apps hosts are especially useful.

| Command | Purpose |
| --- | --- |
| `npm run build` | Build the ESM library, types, and runtime templates |
| `npm run build:example` | Package the Counter example |
| `npm run update:example` | Replace the installed Codex Counter view |
| `npm run start:example` | Start the generated stdio MCP server |
| `npm run typecheck` | Check TypeScript types |
| `npm test` | Run packaging, MCP, and browser tests |

Before submitting a code change:

```sh
npm run build:example
npx playwright install chromium
npm run typecheck
npm test
```

Browser tests use the actual agent runtime in an MCP Apps `AppBridge` harness, covering input, state continuity, display modes, and a no-network CSP. You can select an existing Chromium through `CHROMIUM_PATH`; `/usr/bin/chromium` is also supported when available. Keep the English and Chinese READMEs aligned when updating documentation.

[Browse the source](https://github.com/yodaos-project/aiui-mcpkit) · [Report an issue](https://github.com/yodaos-project/aiui-mcpkit/issues) · [Explore AIUI](https://github.com/yodaos-project/AIUI)
