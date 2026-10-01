# Try the example

English | [简体中文](quickstart.zh-CN.md) · [Documentation index](../README.md)

**Goal:** open a real Ink UI and verify its buttons and typed parameters. First complete [environment setup](installation.md). All shell commands below run from the MCPKit repository root. Tool-call examples such as `open_counter({...})` describe calls to ask your client to make; they are not terminal commands.

Start here if you want to see what the project does before writing code. This walkthrough builds the Counter and installs it for **Codex Desktop**.

## 1. Prepare your tools

Install [Node.js](https://nodejs.org/en/download) **22 or newer** (includes npm), [Git](https://git-scm.com/downloads), Codex Desktop, and a Codex CLI version with `codex plugin` support. Run the commands below in a terminal.

Already using Claude Desktop or VS Code? Complete step 2, then follow [your client's setup](../guides/clients.md).

## 2. Download and build

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
npm ci
npm run build:examples
```

The Counter and business plugins are now in `dist/examples/counter` and `dist/examples/business`. Their shared marketplace is in `dist/examples/.agents/plugins/marketplace.json`. Keep the terminal in this repository for the next step.

## 3. Install in Codex

```sh
codex plugin marketplace add ./dist/examples
codex plugin add ink-counter@aiui-mcpkit-examples
codex plugin add business-demo@aiui-mcpkit-examples
```

The first command registers the shared local catalog; the next two install Counter and the business demo. Copy the identifiers as shown: they must match the generated metadata.

Restart Codex Desktop after the initial installation, then open **AIUI MCPKit Counter** from the plugin's UI entrypoint. In a Codex chat with the local tool available, you can also ask it to call `open_counter`.

## 4. Explore the interface

The Counter uses AIUI's monochrome-green design. Click **+ ADD ONE** to change the count. In a host with fullscreen support, expand the view to see session statistics, recent actions, and additional controls.

The example also demonstrates two page-defined tools. Ask the client to call:

```text
open_counter({ "initialCount": 5, "label": "Demo" })
open_countdown({ "start": 8, "step": 2 })
```

`open_counter` opens the Counter page at 5 with the label “Demo”; clicking **+ ADD ONE** changes it to 6. Both parameters are optional, and omitting `initialCount` restores the saved count. `open_countdown` opens a separate Countdown page at 8; each click subtracts 2 until zero. `start` is required and `step` defaults to 1 in Page logic. Missing `start`, negative initial counts, and nonpositive steps are rejected by the MCP server.

Both tools are declared in their pages' `<script def>` blocks, with parameters received by `onLoad(query)`. The browser tests verify page selection, initial state, and interaction using real Ink WASM. If you installed Counter from the older `ink-counter-local` catalog, register the shared catalog above and reinstall it there. For subsequent changes, `update:examples` updates both installed plugins, including their servers; reload the host to refresh its tool list.

The [Counter source](../../examples/counter/pages/counter/index.ink) shows state and adaptive layout; the [Countdown source](../../examples/counter/pages/countdown/index.ink) shows a second tool with required input. The inline Counter has been observed in Codex Desktop; fullscreen and the page-tool example are tested in the browser harness.

## Try the business demo next

Ask the client to call `quote_order` with this JSON input:

```json
{ "quantity": 2, "coupon": "DEMO10" }
```

Expected structured result: quantity 2, unit price 18, total 36, currency CNY. Without the coupon, total is 40. The page additionally displays remaining stock 98 from UI-only data. Click **CALCULATE** to exercise a second real handler call; click **CANCEL** while it is loading to stop it. This requires host tool access and its `serverTools` capability.

Call `check_stock` with `{ "sku": "DEMO" }` to open the stock page and receive available stock 100. A different SKU returns `UNKNOWN_SKU`; a different coupon returns `INVALID_COUPON`. This validates the error path without a real external service.

## Completion checklist

- The plugin is installed and its tools appear in the current client session.
- Counter starts at 5 and becomes 6 after one click.
- Countdown starts at 8 and becomes 6 after one click.
- The quote result is 36 with `DEMO10` or 40 without it.

Tool discovery is a separate check from installation. If the current session does not expose the tools, reload the server/host and verify its active tool list. See [troubleshooting](../guides/troubleshooting.md). Continue with [your first Agent](first-agent.md) or [business tools](../guides/business-tools.md).

---

[Documentation index](../README.md) · Previous: [Prepare your environment](installation.md) · Next: [Create your first Agent](first-agent.md)
