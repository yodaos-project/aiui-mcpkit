# AIUI MCPKit

**Turn your AIUI Agent into an interactive app inside an AI client.**

AI conversations can do more than return text. With AIUI MCPKit, your agent can show a page with buttons, live state, and a layout that expands when the user opens it fullscreen.

Write the interface as an [AIUI Agent](https://github.com/yodaos-project/AIUI), then package it with MCPKit. The build includes the interface, its runtime, and the MCP server needed to connect it to a compatible client.

[简体中文](README.zh-CN.md) · [Try the example](#try-the-example) · [Create your own agent](#create-your-own-agent) · [Use the ESM library](#use-the-esm-library) · [Choose a client](#choose-a-client) · [Protocol compatibility](#protocol-compatibility) · [Contribute](#contribute)

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
npm run build:examples
```

The Counter and business plugins are now in `dist/examples/counter` and `dist/examples/business`. Their shared marketplace is in `dist/examples/.agents/plugins/marketplace.json`. Keep the terminal in this repository for the next step.

### 3. Install in Codex

```sh
codex plugin marketplace add ./dist/examples
codex plugin add ink-counter@aiui-mcpkit-examples
codex plugin add business-demo@aiui-mcpkit-examples
```

The first command registers the shared local catalog; the next two install Counter and the business demo. Copy the identifiers as shown: they must match the generated metadata.

Restart Codex Desktop after the initial installation, then open **AIUI MCPKit Counter** from the plugin's UI entrypoint. In a Codex chat with the local tool available, you can also ask it to call `open_counter`.

### 4. Explore the interface

The Counter uses AIUI's monochrome-green design. Click **+ ADD ONE** to change the count. In a host with fullscreen support, expand the view to see session statistics, recent actions, and additional controls.

The example also demonstrates two page-defined tools. Ask the client to call:

```text
open_counter({ "initialCount": 5, "label": "Demo" })
open_countdown({ "start": 8, "step": 2 })
```

`open_counter` opens the Counter page at 5 with the label “Demo”; clicking **+ ADD ONE** changes it to 6. Both parameters are optional, and omitting `initialCount` restores the saved count. `open_countdown` opens a separate Countdown page at 8; each click subtracts 2 until zero. `start` is required and `step` defaults to 1 in Page logic. Missing `start`, negative initial counts, and nonpositive steps are rejected by the MCP server.

Both tools are declared in their pages' `<script def>` blocks, with parameters received by `onLoad(query)`. The browser tests verify page selection, initial state, and interaction using real Ink WASM. If you installed Counter from the older `ink-counter-local` catalog, register the shared catalog above and reinstall it there. For subsequent changes, `update:examples` updates both installed plugins, including their servers; reload the host to refresh its tool list.

The [Counter source](examples/counter/pages/counter/index.ink) shows state and adaptive layout; the [Countdown source](examples/counter/pages/countdown/index.ink) shows a second tool with required input. The inline Counter has been observed in Codex Desktop; fullscreen and the page-tool example are tested in the browser harness.

## Create your own agent

Once the example works, replace it with your own page. You can start with this minimal project:

```text
my-agent/
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

Page paths in `app.json` omit the `.ink` extension. For buttons and state, use the [Counter page](examples/counter/pages/counter/index.ink) as a working reference.

From the MCPKit repository, run the local build helper. Replace `/path/to/my-agent` with your project's actual path:

```sh
npm run build
node scripts/build-plugin.mjs /path/to/my-agent \
  --name my-agent \
  --out /path/to/my-agent/dist/plugin
```

The project root directly contains `app.json` and `pages/`. Output may live under the project’s `dist/` directory and is excluded from UI assets. The output directory cannot equal or contain the source directory. The helper is for development in this repository. The package's public integration API is the [ESM library](#use-the-esm-library).

To install your new plugin in Codex:

```sh
codex plugin marketplace add /path/to/my-agent/dist/plugin
codex plugin add my-agent@my-agent-local
```

Reload the desktop host after installation. Your agent's opener tool is `open_app` by default. Other clients can [connect directly to its server](#choose-a-client).

### Define tools per page

For routes registered in `app.json.pages`, declare a tool in the `.ink` file's JSON `<script def>`. MCPKit uses `description` as the tool description and `schema.data` as the MCP input schema:

```html
<script type="application/json" def>
{
  "tool": "show_weather",
  "navigationBarTitleText": "Weather",
  "description": "Show weather for the requested city.",
  "schema": {
    "data": {
      "type": "object",
      "properties": { "city": { "type": "string", "description": "City name" } },
      "required": ["city"],
      "additionalProperties": false
    }
  }
}
</script>

<script setup>
export default {
  data: { city: '' },
  onLoad(query) { this.setData({ city: query.city }); }
};
</script>

<page><text>{{city}}</text></page>
```

`tool` is an optional MCPKit field for an explicit tool name. Without it, the name is `open_` plus the full page route, replacing characters other than letters, numbers, underscores, and hyphens with `_`. For example, `pages/weather/index` becomes `open_pages_weather_index`. Names must be unique. Titles use `navigationBarTitleText`, falling back to the page route.

Give another page its own `description`, `schema.data`, and optional `tool` to expose a second tool. Each tool has a separate UI resource bound to its page, so invoking `show_weather` opens the weather page. Only pages declaring `schema.data` become tools; other registered pages remain available for internal navigation. If no page declares a schema, MCPKit keeps the single `open_app` opener (or your `tool` / `--tool` override). With page tools, `tool` / `--tool` does not rename them and `page` / `--page` does not override their routes.

Arguments are validated before the server returns success. The view receives complete tool arguments from the MCP Apps host and passes them as Ink's launch query to `onLoad(query)`. Ink exposes scalar values as strings and objects/arrays as JSON strings: use `Number(query.days)` or `JSON.parse(query.options)` when appropriate. Page views wait for complete input before opening, so required arguments are available on the first load. Unsupported schema dialects, unresolved references, and invalid page definitions fail the build before output is written.

`buildPlugin()` returns mappings in `result.tools`, each with `name`, `title`, `description`, `page`, `inputSchema`, and `resourceUri`. The existing `result.tool` is the first registered tool name.

### Typed business tools

Declare business tools directly in the `.ink` pages registered by `app.json.pages`. Their `script def` supplies `schema.data` for inputs and `schema.output` for business outputs. The builder generates MCP registration metadata and TypeScript types from these definitions, without a separate `contracts.ts` or duplicate schemas. Tools without `schema.output` retain the page-opening behavior.

```html
<!-- pages/order/index.ink -->
<script type="application/json" def>
{
  "tool": "quote_order",
  "navigationBarTitleText": "Order quote",
  "description": "Calculate an order quote.",
  "schema": {
    "data": {
      "type": "object", "properties": { "quantity": { "type": "integer", "minimum": 1 } },
      "required": ["quantity"], "additionalProperties": false
    },
    "output": {
      "type": "object", "properties": { "total": { "type": "number" } },
      "required": ["total"], "additionalProperties": false
    }
  }
}
</script>
```

```ts
// mcp-server/handlers.ts
import { BusinessToolError } from '@yodaos-pkg/aiui-mcpkit/tools';
import type { BusinessHandlers } from '../.mcpkit/tools.js';

export const handlers: BusinessHandlers = {
  async quote_order(input, { signal, progress }) {
    if (input.quantity > 100) throw new BusinessToolError('OUT_OF_STOCK', 'Choose at most 100 items.');
    signal.throwIfAborted();
    progress({ progress: 1, total: 1, message: 'Quote calculated' });
    return {
      content: [{ type: 'text', text: `Quote: ${input.quantity * 20}` }],
      structuredContent: { total: input.quantity * 20 },
      uiOnly: { stockRemaining: 100 - input.quantity },
    };
  },
};
```

The builder reads `mcp-server/handlers.ts` in the project root by default; `handlers` can select another module. It bundles handlers without executing them at build time. Set `typesFile` to keep generated declarations in the project’s `.mcpkit/` directory:

```js
await buildPlugin({
  source: './order-agent', name: 'order-agent',
  outputDir: './order-agent/dist/plugin',
  typesFile: './order-agent/.mcpkit/tools.d.ts',
});
```

Build before running TypeScript checks. Generated `ToolInputs`, `ToolOutputs` and `BusinessHandlers` check tool names, arguments and structured outputs; rebuild after changing a page schema. The generator handles nested objects, arrays, enums, unions and local `$ref`; schema features it cannot express use `unknown`, while runtime JSON Schema validation remains authoritative. Tool names must be unique, and business tools require object input and output schemas. Schemas are checked at build time, advertised unchanged through MCP tools/list, and validated on every call. Missing handlers fail server startup before connection. Business tools in `result.tools` include `outputSchema`, and `result.files.types` points to the generated declarations.

| Handler field | MCP response | Visibility |
| --- | --- | --- |
| `content` | `content` | Model-visible summary/content blocks |
| `structuredContent` | `structuredContent` | Model-visible data validated against `outputSchema`, also available for rendering |
| `uiOnly` | `_meta.uiOnly` | UI-only data; excluded from model context |

Ink pages receive the initial model-invoked result in `onMessage(event)` as `{ type: 'mcpkit:tool-result', structuredContent, uiOnly, isError, error, request }`, including when the result arrives before WASM startup. Agent-initiated calls use the [request lifecycle](#tool-request-lifecycle) protocol; successful `mcpkit:tool-state` messages contain the complete result in `result`. For initial-result rendering, read `event.data.structuredContent` and `event.data.uiOnly`. UI-only data is accessible to the client and must never contain credentials.

Business failures return `isError: true`, text content `CODE: message`, and `_meta.businessError: { code, message }`. They omit `structuredContent` so clients do not validate an error against a successful output schema. `BusinessToolError(code, message, details?)` exposes its explicit code/message; optional details go to `_meta.uiOnly`. Built-in codes are `INVALID_INPUT`, `INVALID_OUTPUT`, `INTERNAL_ERROR`, `CANCELLED`, `REQUEST_TIMEOUT` and `TOTAL_TIMEOUT`. Invalid inputs do not run a handler; invalid outputs never produce success. Unexpected exceptions return the generic `INTERNAL_ERROR` message, including in lifecycle metadata, without leaking exception text or stacks. Business errors end the request in `error` and never retry by default.

Keep handlers and configuration in the project’s `mcp-server/` directory. The builder excludes `mcp-server/`, `dist/`, `.mcpkit/`, `.git/`, `node_modules/`, `.env` files and transitive server imports from UI assets; remaining assets are public UI content. Handler code is bundled only into `dist/server.mjs`, and environment variables are read at server runtime. Handler modules can import runtime helpers from the root package or `/tools`; packaging APIs such as `buildPlugin` belong in the build script.

Try the complete [business example](examples/business):

```sh
npm run build:examples
npm run start:examples -- business
```

Register that server with an MCP Apps client. Call `quote_order` with `{ "quantity": 2 }` (optionally `"coupon": "DEMO10"`), or `check_stock` with `{ "sku": "DEMO" }`. The quote page shows structured totals and UI-only stock data; **CALCULATE** calls the real handler and **CANCEL** interrupts it. The tools open their respective quote and stock pages registered in `app.json.pages`. The fixture uses deterministic demo data and places no orders. `npm run typecheck` checks the typed example and rejects intentionally incorrect input/output assignments; MCP and real Ink WASM browser tests verify discovery, contracts, errors, server-code isolation, rendering, invocation and cancellation.

### Tool request lifecycle

Agent pages can call tools exposed by their MCP Apps host through Ink messages. This requires the host's `serverTools` capability and tool access; MCPKit does not register external business tools itself. Each call must use a unique `requestId` for the lifetime of the view:

```js
// Inside an Ink page:
this.postMessage({
  type: 'mcpkit:call-tool', requestId: 'weather-1',
  name: 'get_weather', arguments: { city: 'Hangzhou' },
});
// To stop that request:
this.postMessage({ type: 'mcpkit:cancel-tool', requestId: 'weather-1' });

// Add this method to the page definition:
onMessage(event) {
  const request = event.data;
  if (request.type !== 'mcpkit:tool-state') return;
  // Track each ID separately; pending shows loading, all other states stop it.
  this.setData({ weatherRequest: request });
}
```

Responses have `type: 'mcpkit:tool-state'`, `requestId`, `state`, `attempt` (starting at 1), and the effective `policy`. `pending` may include `progress`; `ready` includes the MCP tool `result`; `error` and `cancelled` include `{ code, message }` in `error`. Timeout codes are `request_timeout` and `total_timeout`; business and transport failures use `tool_error`. Invalid tool names/arguments produce `invalid_request` without executing work. Empty or missing IDs are ignored. Reusing an ID is ignored, including after completion, so delayed messages cannot start or replace a different invocation. Keep state keyed by ID when several calls run concurrently. Host cancellation, page replacement and view closure cancel all outstanding calls; a per-ID cancellation affects only that call.

Configure generated server and view budgets through the ESM API:

```js
await buildPlugin({
  source: './weather-agent', name: 'weather-agent',
  requestPolicy: {
    totalTimeoutMs: 60000, requestTimeoutMs: 15000,
    resetTimeoutOnProgress: true, maxRetries: 1, retryDelayMs: 250,
  },
  retrySafeTools: ['get_weather'],
});
```

| Setting | Default | Rule |
| --- | --- | --- |
| `totalTimeoutMs` | `60000` | Wall-clock budget from start through every attempt and retry delay; progress never resets it. |
| `requestTimeoutMs` | `60000` | Budget for one attempt, starting when dispatched. |
| `resetTimeoutOnProgress` | `false` | When enabled, progress from the active attempt restarts only its request budget. |
| `maxRetries` | `0` | Number of extra attempts; disabled unless the operation is explicitly safe and its failure is eligible. |
| `retryDelayMs` | `0` | Delay before each retry; cancellation and the total deadline still apply. |

Timeouts must be positive integer milliseconds; retries/delay must be nonnegative integers, all at most `2147483647`. Cancellation and either timeout immediately exit pending and abort the current attempt's `AbortSignal`, even if unfinished work ignores it. Abort propagates through `callServerTool` as MCP cancellation; server handlers receive the SDK cancellation signal. Cancellation cannot undo an already committed business operation. Late results, failures and progress are ignored. Retry attempts receive fresh signals and retain the same request ID. The Agent bridge retries only request timeouts for build-time `retrySafeTools`; tool errors, host cancellation and total timeouts never retry. Agent messages cannot enable retries. Generated page openers never retry.

For future server handlers or developer tools, the package exports `RequestLifecycle`, `RequestLifecycleError`, `AgentToolBridge`, `resolveRequestPolicy` and their TypeScript types. Use the same lifecycle around unfinished work:

```js
const requests = new RequestLifecycle({ requestTimeoutMs: 15000 });
const handle = requests.start(async ({ signal, progress }) => {
  progress({ stage: 'fetching' });
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}, { signal: callerSignal });
const result = await handle.result; // rejects on failure, cancellation or timeout
```

In this API, retries require both `retrySafe: true` and a `shouldRetry(error)` predicate as well as a positive `maxRetries`. Observer callbacks cannot change settlement by throwing. Inspect defaults/configuration in `buildPlugin().requestPolicy`, the generated tools/list `_meta.requestPolicy`, or `requests.policy`; inspect active requests with `requests.inspect()` and terminal state with `handle.snapshot()`. Generated tool responses include `_meta.request` with the request ID, terminal state and effective policy. Per-request snapshots report `maxRetries: 0` when safety conditions disable retries. Deterministic tests cover budgets and races; a real Ink WASM browser test covers Agent messages, progress, retries, cancellation propagation and ignored late responses.

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

Edit the [Counter page](examples/counter/pages/counter/index.ink), the [business page](examples/business/pages/order/index.ink), or its [handlers](examples/business/mcp-server/handlers.ts), then run:

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

## Build reference

### Generated files

```text
plugin/
├── plugin.json                       # Plugin name and display metadata
├── mcp.json                          # Plugin-host stdio configuration
├── view.html                         # Agent interface and embedded runtime
├── tools.d.ts                        # Generated tool and handler types
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
| `tool` | `--tool` | `open_app` fallback when no page declares a schema |
| `page` | `--page` | First page in `app.json`, without `.ink` |
| `version` | `--version` | `0.1.0` |
| `requestPolicy` | ESM only | Shared lifecycle defaults above |
| `retrySafeTools` | ESM only | `[]` |
| `handlers` | ESM only | `<source>/mcp-server/handlers.ts` for business tools |
| `typesFile` | ESM only | `<outputDir>/tools.d.ts` |

Plugin names start with a lowercase letter and contain lowercase letters, numbers, or hyphens. Tool names contain 1–128 letters, numbers, underscores, or hyphens. Use `node scripts/build-plugin.mjs --help` for helper usage. If you omit `[source]`, the current project root is used; output is excluded from UI assets.

### Current scope

The UI host must allow WebAssembly compilation. The embedded HTML is roughly 10 MB, so resource size limits also matter. Source files are read as UTF-8; packaging binary assets is not supported yet.

Automated tests cover packaging, MCP tool/resource responses, and the browser runtime. They do not establish full compatibility with every desktop host, account-connected tool access, or resource-cache behavior.

## Protocol compatibility

The target released MCP revision is **2026-07-28**. Runtime dependencies are pinned to `@modelcontextprotocol/server`, `client`, and `core` **2.2.0**, and `@modelcontextprotocol/ext-apps` **2.0.3**. The UI contract is the released [MCP Apps 2026-01-26 specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx); a **View** is the Apps iframe containing the AIUI runtime. Draft contracts are not advertised.

| Capability | Support and verification |
| --- | --- |
| Current MCP over stdio | `serveStdio` serves `2026-07-28`: `server/discover`, per-request protocol/capability metadata, tool discovery/calls, and resource listing/reads. Tests pin this revision so fallback cannot hide failures. |
| Legacy MCP over stdio | The same server accepts `initialize` and `notifications/initialized`. Tests cover `2024-11-05`, `2025-03-26`, `2025-06-18`, and `2025-11-25`; original SDK **1.31.0** clients also run the existing regressions. |
| Apps/View negotiation | A client must advertise `extensions["io.modelcontextprotocol/ui"].mimeTypes` containing `text/html;profile=mcp-app`. Legacy capabilities come from initialization; current capabilities are read on each request. |
| Tool metadata and results | Apps clients receive `_meta.ui.resourceUri`, the compatibility alias `_meta["ui/resourceUri"]`, and existing OpenAI entrypoints. Original input/output JSON Schemas, model-visible content/structured data, and UI-only metadata are preserved; the official SDK handles each era's wire encoding. |
| Clients without Apps | Tool discovery omits UI entrypoint metadata. Page openers return arguments and an explicit text-only explanation; business handlers still run and return their data with a UI-unavailable notice. `_meta.mcpkit.ui` reports `available` or `unavailable` on discovery and executed results. Explicit UI resource reads remain available. |
| View/host channel | The existing Apps `ui/initialize` handshake, tool input/result/cancellation notifications, and host-context changes remain in use. Views advertise inline/fullscreen; real Ink WASM browser tests cover host mode restrictions, business rendering, calls and cancellation. |
| Progress and cancellation | Protocol tests cover progress notifications and client cancellation in both eras; existing regressions verify handler abort, timeouts and late-result isolation. |

Run `npm run build:examples`, `npm run typecheck`, and `npm test` for the compatibility suite (including `tests/protocol.test.mjs`). CI runs these on every pull request. This is acceptance coverage for the capabilities above, not certification of the entire MCP specification. HTTP transport, authorization, multi-round-trip input, subscriptions and cache policies are not exposed by MCPKit. Resource/tool lists are static. Desktop-host fullscreen and tool-access behavior still require testing in that host.

## Performance benchmarks

Run `npm run build` followed by `npm run bench` to measure four fixed real Ink WASM scenarios, separate stdio server workloads, and package/resource sizes. The suite saves raw samples, screenshots, machine/runtime versions and A/B comparisons. See the [benchmark guide](benchmarks/README.md) for setup and measurement boundaries; CI runs a correctness smoke check without performance thresholds.

## Contribute

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
