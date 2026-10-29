# Connect your app to an AI client

English | [简体中文](clients.zh-CN.md) · [Learning path](../README.md)

**Goal:** let an assistant discover a tool, call it and display its UI. First finish [the browser quickstart](../getting-started/quickstart.md); the [page-tool lesson](page-tools.md) prepares your own app. Choose only the client you already use below.

Your client starts a local Node.js server. The server exposes tools; a client supporting **MCP Apps and WASM** can also display the interface. Ordinary MCP support can return data without displaying UI. Client UI capabilities differ; this project's Counter inline UI has been observed in Codex Desktop, while Claude Desktop and VS Code still need project-specific UI verification.

## 1. Build the installable examples

Stop a running watcher with Ctrl+C. From the repository root:

```sh
npm run build:examples
```

This creates six plugins under `dist/examples/`. Start with Counter, which needs no Worker host. The plugin build and browser watcher use different output directories.

If your client asks for an absolute path, print the repository location with:

```sh
node -p "process.cwd()"
```

Append `/dist/examples/counter/dist/server.mjs` to that location. Replace `/absolute/path/to/aiui-mcpkit` in the examples below with your actual repository location. For Windows JSON paths, use `/` separators or escape each backslash as `\\`.

## 2. Choose one connection method

### Codex Desktop

Check that `codex plugin --help` works in your terminal, then run from the repository root:

```sh
codex plugin marketplace add ./dist/examples
codex plugin add ink-counter@aiui-mcpkit-examples
```

The first line registers the local plugin catalog, the second installs Counter. Restart the desktop host and use a new chat/session that exposes its tools. See the official [plugin installation guide](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually) for client-specific controls.

<details>
<summary>Codex CLI or direct MCP registration</summary>

For direct registration, use this route instead of installing the same plugin twice:

```sh
codex mcp add aiui-counter -- node /absolute/path/to/aiui-mcpkit/dist/examples/counter/dist/server.mjs
```

Start a new session after registering. The CLI can call tools and show text results; use a graphical Apps host for the interactive View. See [MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

</details>

### Claude Desktop

Open the client's Developer settings and its configuration file, following the official [local-server setup guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers). Merge this entry into `mcpServers`, preserving existing entries:

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

The file is `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows. Replace the placeholder path, save and restart Claude Desktop. If it cannot find Node.js, set `command` to the executable's absolute path.

### VS Code

Use **MCP: Add Server** in the Command Palette, select **Command (stdio)**, and enter `node` plus the absolute server path above. Choose a distinct server ID such as `aiui-counter`, select a configuration destination supported by your setup, and start it through the client's MCP controls.

VS Code has different configuration formats and harnesses. Follow its [current setup guide](https://code.visualstudio.com/docs/agent-customization/mcp-servers) for the appropriate destination. Portable files such as workspace-root `.mcp.json` use `mcpServers`; VS Code-format `.vscode/mcp.json` uses `servers`. The guided flow helps avoid mixing them. Displaying the UI additionally depends on MCP Apps support being enabled in that environment.

## 3. Check discovery, then call the tool

Check the active session's tool list for `open_counter` and `open_countdown`. Installation alone does not prove the session has loaded them.

Send this **chat prompt**, not a terminal command:

```text
Call open_counter with { "initialCount": 5, "label": "Demo" }.
```

**Expected:** a Counter starting at **5**. Click **+ ADD ONE** to reach **6**. If only data appears, confirm the host supports Apps and WASM. An app working in the local preview does not establish that a particular client can display it.

Optional second call: `open_countdown` with `{ "start": 8, "step": 2 }`. Its button should reduce 8 to 6. A new View starts its own state.

## Connect your own app

After [creating your app](../getting-started/first-agent.md), build from the repository root:

```sh
node scripts/build-plugin.mjs ./my-agent --name my-agent --out ./dist/my-agent
```

For Codex's plugin route:

```sh
codex plugin marketplace add ./dist/my-agent
codex plugin add my-agent@my-agent-local
```

For direct registration, point your client's server configuration at the absolute path to `dist/my-agent/dist/server.mjs` instead of the example server. Keep one connection route per plugin.

After the page-tool lesson, call `open_my_counter` with `{ "initialCount": 5 }`. Before adding a page schema, the default tool is `open_app` with `{}`. After source changes, follow [development workflow](development.md) to rebuild and update the installed copy, then reload the server and open a fresh View.

## If you get stuck

- **No tools:** check the absolute server path and client logs, then reload the MCP connection/session.
- **Server is silent when started manually:** stdio waits for protocol input; it does not print a localhost URL. Normally the client starts it for you.
- **Data arrives without UI:** check Apps/WASM support and the client's sandbox limits. See [compatibility](../reference/compatibility.md).
- **Old UI after a rebuild:** source, generated files and the installed copy are separate; use [build diagnostics](build-diagnostics.md).

MCPKit generates local stdio servers; HTTP-only connectors need a separate transport. Hosts decide whether fullscreen, messaging and live View tools are available. [Troubleshooting](troubleshooting.md) covers the next layer of checks.

**Checkpoint:** the intended tool is visible in the active client session, returns the expected data and, in a compatible Apps host, opens a working interface.

**Next:** [Return your first business result](first-business-tool.md).
