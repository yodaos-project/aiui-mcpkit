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
