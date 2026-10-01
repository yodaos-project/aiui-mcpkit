# Prepare your environment

English | [简体中文](installation.zh-CN.md) · [Documentation index](../README.md)

This guide uses a local checkout so you can build the library and follow every example without assuming a published npm release. Commands run in a terminal, not the AI chat input. Basic familiarity with creating files and editing JSON is sufficient.

## Prerequisites

| Tool | Needed for | Check |
| --- | --- | --- |
| Node.js **22 or newer** and npm | Build and run generated servers | `node --version`, `npm --version` |
| Git | Download this repository | `git --version` |
| Text editor | Edit `app.json`, `.ink` and handler files | Any editor; TypeScript support helps later |
| MCP client | Call tools; an Apps-capable host displays UI | See [client setup](../guides/clients.md) |
| Codex CLI with plugin commands | Only the Codex plugin installation route | `codex plugin --help` |
| Chromium through Playwright | Only browser tests and benchmarks | Install when following [contributing](../contributing.md) |

Install Node from [Node.js](https://nodejs.org/en/download) and Git from [Git](https://git-scm.com/downloads). Reopen the terminal after installation if a command is not found. Desktop apps may inherit a different `PATH`; use an absolute Node executable path when needed.

## Download and install

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
node --version
npm ci
npm run build:examples
```

`npm ci` installs the exact lockfile dependencies. `build:examples` first builds the ESM package and then builds both examples. Keep this terminal in the repository root for the following tutorials.

Expected output directories:

```text
aiui-mcpkit/
├── dist/                         # Built library and generated examples
│   └── examples/
│       ├── counter/
│       ├── business/
│       └── .agents/plugins/marketplace.json
├── examples/                     # Editable example source
├── scripts/                      # Repository development helpers
└── docs/                         # These guides
```

The `.agents` directory is hidden in some file managers. Its absence from a normal directory listing does not mean the build failed.

## Understand the three directories

- **Source:** Edit `examples/counter/` or your own Agent directory.
- **Generated output:** The builder writes `dist/examples/counter/`; rebuilding replaces generated files. Edit source instead.
- **Installed plugin:** The client may copy generated output into its own cache. Rebuilding alone does not update that installed copy. See [development workflow](../guides/development.md).

## Using MCPKit from your own Node project

You do not need to keep your Agent in this repository. Build a local package with `npm pack`, install its tarball in your project, and call `buildPlugin()` from an ESM script. Follow [ESM integration](../guides/esm-build.md) for exact file contents. The repository helper is not a globally installed CLI.

## Checkpoint

You are ready when `npm run build:examples` exits successfully and `dist/examples/counter/dist/server.mjs` exists. Continue with [run the examples](quickstart.md). If installation or startup fails, use [troubleshooting](../guides/troubleshooting.md).

---

[Documentation index](../README.md) · Previous: [Understand MCPKit](overview.md) · Next: [Run the examples](quickstart.md)
