# AIUI MCPKit

**Turn AIUI Agents into interactive apps inside AI clients.**

MCPKit packages [AIUI Agent](https://github.com/yodaos-project/AIUI) pages, the Ink WebAssembly runtime and a local MCP server together. Compatible MCP Apps clients display the interface: AI uses tool data while users operate buttons and state directly.

[简体中文](README.zh-CN.md) · [Documentation and tutorials](docs/README.md) · [Quickstart](docs/getting-started/quickstart.md)

## What you can build

- Generate MCP tools from page schemas and open each tool's page.
- Implement typed business handlers with generated input/output declarations and runtime validation.
- Handle progress, cancellation, timeouts and controlled retries.
- Configure public metadata/custom UI resources and inspect final protocol items.
- Build a complete plugin through the ESM API; install in Codex or connect a client directly over stdio.

## Try it

You need **Node.js 22+**, Git and an MCP Apps client. Run these commands in a terminal:

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
npm ci
npm run build:examples
```

Install the examples with a Codex CLI that supports plugin commands:

```sh
codex plugin marketplace add ./dist/examples
codex plugin add ink-counter@aiui-mcpkit-examples
codex plugin add business-demo@aiui-mcpkit-examples
```

Restart the desktop host and confirm tools appear in the current session. Ask the client to call `open_counter` with `{ "initialCount": 5, "label": "Demo" }`; one **+ ADD ONE** click should change it to 6.

Follow the [quickstart](docs/getting-started/quickstart.md) for complete steps, business examples and expected results. For Claude Desktop, VS Code or other clients, see [client setup](docs/guides/clients.md).

## Documentation and tutorials

| Your goal | Start here |
| --- | --- |
| Learn MCP / AIUI concepts | [Overview](docs/getting-started/overview.md) · [Environment setup](docs/getting-started/installation.md) |
| Write your first interactive page | [Your first Agent](docs/getting-started/first-agent.md) |
| Provide tools and business data to AI | [Page tools](docs/guides/page-tools.md) · [Business tools](docs/guides/business-tools.md) |
| Integrate a build system or look up APIs | [ESM integration](docs/guides/esm-build.md) · [Build API](docs/reference/build-api.md) |
| Update plugins or diagnose a failure | [Development](docs/guides/development.md) · [Troubleshooting](docs/guides/troubleshooting.md) |
| Check compatibility or measure performance | [Compatibility](docs/reference/compatibility.md) · [Benchmarks](docs/reference/benchmarks.md) |

[Browse all documentation](docs/README.md), including metadata, request lifecycle and page message references.

## Development and contributions

```sh
npm run build:examples
npx playwright install chromium
npm run typecheck
npm test
```

MCPKit currently generates local stdio servers. Rendering needs Apps/WASM support. See [compatibility](docs/reference/compatibility.md) for host verification boundaries and [contributing](docs/contributing.md) for the full checks and benchmark smoke command.

[Report an issue](https://github.com/yodaos-project/aiui-mcpkit/issues) · [Explore AIUI](https://github.com/yodaos-project/AIUI)

### Direct Ink host services and Worker execution

With Ink Web SDK 0.20 or later, generated Views bind `navigator.host` to MCP Apps:
conversation context publication, explicit user messages, tool calls and resource
list/read operations use typed runtime APIs. Legacy message-based pages continue
to work. Capabilities come from the completed host handshake; unsupported methods
reject. The adapter supports text content, checks structured-context support,
redacts raw transport metadata, and keeps `isError` tool results as business results.
Context acknowledgement does not confirm a later model turn consumed the selection.
MCP Apps notifications have no invocation ID; local revisions order them but cannot
prove correlation between overlapping invocations. Tool-list proxying and list-change
notifications are not advertised.

A manifest-declared Agent Worker can implement business operations without a
handwritten `mcp-server/handlers.ts` module:

```javascript
await buildPlugin({
  source: '/absolute/path/to/agent',
  name: 'worker-business',
  outputDir: '/absolute/path/to/output',
  worker: { name: 'business' },
});
```

`worker.name` must match `app.json.agentWorkers`. Each page's existing `tool` name
maps to an own function in the worker default export's `operations` object. Input
and output schemas remain in registered `.ink` pages and are validated by the
generated MCP server. `worker` and `handlers` are mutually exclusive.

The generated server packages the app under `worker-app/` and launches the real
Ink `ink-worker` executable over JSON Lines. Put the binary on PATH or configure
`INK_WORKER_BIN` at deployment. Build it from Ink with
`cargo build -p ink-script --bin ink-worker`. `INK_WORKER_CONFIGURATION` may name
a private runtime JSON configuration file, exposed only as the operation context's
immutable `configuration`. Configuration values are not embedded in View HTML.

An operation receives `(input, { requestId, signal, reportProgress, configuration })`
and explicitly returns an asynchronous JSON result. For page-backed business tools,
return `{ content, structuredContent, uiMetadata? }`; the adapter validates output
and converts `uiMetadata` to the existing UI-only result field. The worker executes
in Ink's real module loader and realm, with timers and promises, without a Page or
renderer. Node APIs, `process.env` and `fetch` are unavailable. This initial path is
for pure computation; network-backed Node handlers require separate capability work.
Session state is shared between its calls and released at shutdown. It is separate
from UI `open` worker generations. Cancellation is per request and cooperative.

The Ink repository's `fixtures/agents/host-business` is the quote/stock example.
Its Page calls `navigator.host.tools.call()` and the generated server reaches the
same worker operation used by model-triggered calls. Selecting a SKU publishes only
`selectedSku`; sending a conversation message is a separate action.

Validation is split between provider tests, real Ink/WASM browser tests, generated
MCP server tests against `ink-worker`, and an interactive real-client/model check.
Run Worker integration tests with `INK_WORKER_BIN=/absolute/path/to/ink-worker`.
Browser harness delivery is not evidence that a production model consumed context;
record that interactive check separately.

During development, the new host API requires the locally built Ink SDK (the
published 0.18 dependency keeps legacy pages supported). Build the Ink Web SDK,
then run `npm install /absolute/path/to/ink/packages/ink-web/dist --no-save --package-lock=false`
in this checkout. The host-services browser test checks the installed SDK's actual
`setHostProvider` method and skips on older runtimes; the native Worker tests need
`INK_WORKER_BIN`. Both paths are run against the new runtime during feature validation.
