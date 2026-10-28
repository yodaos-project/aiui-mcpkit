<p align="center">
  <picture>
    <source media="(max-width: 600px)" srcset="docs/assets/readme-banner-compact.svg">
    <img src="docs/assets/readme-banner.svg" width="1200" alt="AIUI MCPKit — AIUI agents to interactive MCP Apps">
  </picture>
</p>

<h3 align="center">Give your AI tools an interface.</h3>

<p align="center">
  Build interactive MCP Apps with JavaScript and AIUI.<br>
  Ship your pages, Ink WebAssembly renderer and MCP server as one plugin.
</p>

<p align="center">
  <a href="https://github.com/yodaos-project/aiui-mcpkit/actions/workflows/ci.yml"><img src="https://github.com/yodaos-project/aiui-mcpkit/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://github.com/yodaos-project/aiui-mcpkit/actions/workflows/benchmark.yml"><img src="https://github.com/yodaos-project/aiui-mcpkit/actions/workflows/benchmark.yml/badge.svg?branch=main" alt="Benchmarks"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&amp;logoColor=white" alt="Node.js 22+"></a>
</p>

<p align="center">
  <strong>English</strong> · <a href="README.zh-CN.md">简体中文</a><br>
  <a href="#quickstart">Quickstart</a> · <a href="#build-your-own">Build your own</a> · <a href="docs/README.md">Documentation</a> · <a href="#contributing">Contributing</a>
</p>

## Tools people can use

Let the assistant return structured data while the user works with buttons, forms and live state. Build order calculators, product selectors and shared workspaces that connect UI actions to the conversation.

<table>
  <tr>
    <th width="50%" align="left">Travel Planner · Fieldnotes</th>
    <th width="50%" align="left">Focus Studio</th>
  </tr>
  <tr>
    <td width="50%" align="center" valign="top"><a href="docs/assets/examples/travel.png"><img src="docs/assets/examples/travel.png" width="480" alt="Blue Kyoto itinerary with day selection and saved stops"></a></td>
    <td width="50%" align="center" valign="top"><a href="docs/assets/examples/focus.png"><img src="docs/assets/examples/focus.png" width="480" alt="Coral focus timer with start, pause and reset"></a></td>
  </tr>
  <tr>
    <td valign="top">Switch days, save a stop and explicitly share it with the assistant.</td>
    <td valign="top">Set a task and duration, then start, pause or reset the timer.</td>
  </tr>
  <tr>
    <td><a href="examples/travel">Explore Travel Planner →</a></td>
    <td><a href="examples/focus">Explore Focus Studio →</a></td>
  </tr>
</table>

<table>
  <tr>
    <th width="50%" align="left">Analytics Lab · Signal</th>
    <th width="50%" align="left">Event Booking · The Making Room</th>
  </tr>
  <tr>
    <td width="50%" align="center" valign="top"><a href="docs/assets/examples/analytics.png"><img src="docs/assets/examples/analytics.png" width="480" alt="Violet dashboard with period filters, KPIs and a bar chart"></a></td>
    <td width="50%" align="center" valign="top"><a href="docs/assets/examples/events.png"><img src="docs/assets/examples/events.png" width="480" alt="Ceramic workshop reservation with session and seat selection"></a></td>
  </tr>
  <tr>
    <td valign="top">Switch week/month to update the metrics and chart together.</td>
    <td valign="top">Choose a session and seats, review the total and confirm a local demo.</td>
  </tr>
  <tr>
    <td><a href="examples/analytics">Explore Analytics Lab →</a></td>
    <td><a href="examples/events">Explore Event Booking →</a></td>
  </tr>
</table>

<sub>Real Ink/WASM captures from the local MCP Apps browser harness. Travel, analytics, workshop and business data are demo fixtures. Workshop confirmation makes no real booking or payment; the timer runs while its View is open. Conversation sharing requires host support.</sub>

<details>
<summary><strong>Also explore business results and shared Apps</strong></summary>

<table>
  <tr>
    <th width="50%" align="left">Calculate and act</th>
    <th width="50%" align="left">Search, inspect and select</th>
  </tr>
  <tr>
    <td width="50%" align="center" valign="top"><a href="docs/assets/business.png"><img src="docs/assets/business.png" width="420" alt="Order quote showing CNY 40, stock and calculate/cancel controls"></a></td>
    <td width="50%" align="center" valign="top"><a href="docs/assets/shared-agent-search.png"><img src="docs/assets/shared-agent-search.png" width="420" alt="Catalog showing a lamp search while preserving the selected travel bag"></a></td>
  </tr>
  <tr>
    <td valign="top">Return a validated quote to the model. Let the user calculate again or cancel from the same interface.</td>
    <td valign="top">Use multiple tools in one App. Preserve search, navigation and selection within each live View.</td>
  </tr>
  <tr>
    <td><a href="docs/guides/business-tools.md">Build business tools →</a></td>
    <td><a href="docs/guides/shared-agent.md">Build a shared App →</a></td>
  </tr>
</table>

</details>

https://github.com/user-attachments/assets/487a1771-ca2d-4b04-91f4-8a55f8f8eba1

**[Watch the 33-second English showcase →](docs/assets/mcpkit-showcase.mp4)** · [Without background music](docs/assets/mcpkit-showcase-nobgm.mp4)

<details>
<summary>About the showcase and media credits</summary>

From a Codex conversation to an independent view and back, with the same selection preserved. The English film also highlights desktop agents such as Codex and Claude Code, and AIUI on Rokid Glasses. The Codex/desktop shells are labelled illustrations, app interfaces are actual runtime captures, and the glasses use the official product image from the [AIUI site](https://open.rokid.com/aiui/?lang=en-US). Interactive desktop views depend on host capabilities. Music: [Cat Walk — Arulo](https://assets.mixkit.co/music/371/371.mp3) ([Mixkit license](https://mixkit.co/license/#musicFree)); sound effects: [Mixkit](https://mixkit.co/license/#sfxFree).

</details>

## Why build with MCPKit?

- **Define pages and tools together.** Tool names and schemas live in `.ink` pages. Generate tool registration, runtime validation and TypeScript contracts from one source.
- **Connect the assistant to live state.** Expose App/Page methods with `ModelContext.defineAction()`. Send messages and publish selected context through `getApp().getAgent()`.
- **Run business logic beyond the View.** Use Ink Agent Workers or Node.js server handlers for calculations and integrations. Keep server credentials out of UI code.
- **Build, ship and verify.** `buildPlugin()` bundles the server, UI, runtime and manifests. Check readiness with [preview verification](docs/guides/preview-verification.md) and build identity with [diagnostics](docs/guides/build-diagnostics.md).

## Quickstart

**You need:** Node.js **22+**, Git and an MCP Apps client with WASM support. Start with Counter; the business examples additionally need [`ink-worker`](docs/guides/business-tools.md).

### 1. Build the examples

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
npm ci
npm run build:examples
```

The build creates six independent plugins in `dist/examples/`. Counter and the four visual examples need no native Worker or external service. [Explore all examples →](examples/README.md)

### 2. Install Counter

For Codex Desktop, use a Codex CLI with plugin commands:

```sh
codex plugin marketplace add ./dist/examples
codex plugin add ink-counter@aiui-mcpkit-examples
```

Restart the host and confirm `open_counter` appears in the active session. For Claude Desktop, VS Code or direct stdio registration, follow [client setup](docs/guides/clients.md).

### 3. Make it interactive

Ask the assistant:

```text
Call open_counter with { "initialCount": 5, "label": "Demo" }.
```

Click **+ ADD ONE**. The count should change from **5 to 6**.

[Counter source →](examples/counter/pages/counter/index.ink) · [Complete walkthrough →](docs/getting-started/quickstart.md)

<details>
<summary><strong>Try travel, focus, analytics and event booking</strong></summary>

Install any subset after adding the marketplace above, then reload the host:

```sh
codex plugin add travel-planner@aiui-mcpkit-examples
codex plugin add focus-studio@aiui-mcpkit-examples
codex plugin add analytics-lab@aiui-mcpkit-examples
codex plugin add event-booking@aiui-mcpkit-examples
```

| Call | Interaction |
| :--- | :--- |
| `open_trip({ "day": 2 })` | Switch days, save a stop and explicitly share the selection. |
| `open_focus({ "minutes": 25, "task": "Write the next chapter" })` | Start, pause or reset the focus timer. |
| `open_analytics({ "period": "month" })` | Switch reporting periods and update the chart. |
| `open_workshop({ "seats": 2 })` | Choose a session and review a demo reservation. |

Run a stdio server directly with `npm run start:examples -- travel`; the other IDs are `counter`, `business`, `focus`, `analytics` and `events`. Open Views expose read-only `trip_state`, `focus_state`, `analytics_state` and `workshop_state` actions through `ModelContext.defineAction()`. Querying them requires host routing for live View tools. [Example guide →](examples/README.md)

</details>

<details>
<summary><strong>Next: try quotes, product selection and a shared catalog</strong></summary>

Put `ink-worker` on the server process's PATH or set `INK_WORKER_BIN` using the [Worker setup guide](docs/guides/business-tools.md), then install:

```sh
codex plugin add business-demo@aiui-mcpkit-examples
```

Reload the host and confirm the tools are available in the active session.

| Call | Expected result |
| :--- | :--- |
| `quote_order({ "quantity": 2 })` | **CNY 40**, remaining stock **98**; calculate/cancel controls work when host tool access is enabled. |
| `find_products({ "query": "travel" })` | Product candidates with an explicit action to publish a selection and ask the assistant about it. |
| `search_catalog({ "query": "travel" })` | A shared catalog App with search, details and selection; live App actions update the same instance. |

The demo uses AgentWorker `ModelContext.defineAction()` methods. [Candidate selection](docs/guides/candidate-selection.md), [shared Apps](docs/guides/shared-agent.md) and opt-in [state restoration](docs/guides/state-restoration.md) each have a dedicated guide. Messaging, live-tool routing and restoration depend on host capabilities.

</details>

## Build your own

Create an AIUI agent with `app.json` and registered `.ink` pages. Add tool metadata and input schemas in each page's `script def`; add `schema.output` for business results.

After building this checkout, save the following as `build-agent.mjs` at the repository root. Put your agent source in `./agent/`:

```js
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

const plugin = await buildPlugin({
  source: './agent',
  name: 'my-agent',
  outputDir: './dist/my-agent',
});

console.log(plugin.outputDir);
```

Run `node build-agent.mjs` to generate `view.html`, `dist/server.mjs` and plugin/connection manifests. The deployment host needs Node.js 22+; native Worker execution also needs `ink-worker`.

| Your next step | Guide |
| :--- | :--- |
| Create the source files and your first button | [Your first Agent](docs/getting-started/first-agent.md) |
| Turn page arguments into validated tools | [Page tools](docs/guides/page-tools.md) |
| Add typed business operations | [Business tools](docs/guides/business-tools.md) |
| Use MCPKit in a separate Node.js project | [ESM integration](docs/guides/esm-build.md) |

### Let the assistant use live UI state

Add this method to a Page's default export to expose the current selection as an instance-bound tool:

```js
export default {
  data: { selectedSku: 'DEMO' },
  getSelection: ModelContext.defineAction({
    name: 'get_selection',
    description: 'Read the product selected on this page',
    annotations: { readOnlyHint: true },
    execute() {
      return { selectedSku: this.data.selectedSku };
    },
  }),
};
```

From a button handler, `getApp().getAgent().conversation.sendMessage()` can send a user message; `agent.provideContext()` publishes context for later turns. [Agent sessions](docs/guides/agent-session.md) covers complete pages, dynamic tools, context updates and revocation. The host must route View tools to its model and enable the relevant conversation capabilities.

## Client support

MCPKit generates **local stdio servers**. Interactive rendering needs an MCP Apps host with WASM support. Clients without Apps support receive tool data and an explicit UI-unavailable response.

| Surface | Verification |
| :--- | :--- |
| **Ink/WASM + MCP Apps bridge** | Real browser tests cover tool input/results, UI actions, display modes, messages, context and cancellation. |
| **Codex Desktop** | Counter inline UI has been observed; other interactions and modes are covered in the browser harness. |
| **Claude Desktop / VS Code** | Connection guides are available; this project's UI still needs verification in these clients. |
| **Conversation + live tools** | Host capabilities and View-tool routing determine availability. Actual model consumption of context needs separate verification. |

See [protocol compatibility](docs/reference/compatibility.md) and [runtime prerequisites](docs/guides/runtime-integration.md) for details. HTTPS deployment and conversation-card rendering remain separate work.

## Go deeper

| Build | Connect | Verify |
| :--- | :--- | :--- |
| [AIUI, Ink and MCPKit](docs/getting-started/overview.md) | [Client setup](docs/guides/clients.md) | [Preview verification](docs/guides/preview-verification.md) |
| [Build API](docs/reference/build-api.md) | [Agent sessions](docs/guides/agent-session.md) | [Build diagnostics](docs/guides/build-diagnostics.md) |
| [Plugin metadata](docs/guides/metadata.md) | [Runtime and Workers](docs/guides/runtime-integration.md) | [Benchmarks](docs/reference/benchmarks.md) |
| [Shared Apps](docs/guides/shared-agent.md) | [State restoration](docs/guides/state-restoration.md) | [Troubleshooting](docs/guides/troubleshooting.md) |
| [Example collection](examples/README.md) | [Development loop](docs/guides/development.md) | [Contributing](docs/contributing.md) |

[Browse all documentation →](docs/README.md)

## Contributing

Bring a runnable example, a client test report or a focused fix. [Open an issue](https://github.com/yodaos-project/aiui-mcpkit/issues) with your client version and reproduction steps, or send a pull request.

```sh
npm run build:examples
npx playwright install chromium
npm run typecheck
npm test
```

See [contributing](docs/contributing.md) for Worker test setup and benchmark checks.

---

<p align="center">
  Built on <a href="https://github.com/yodaos-project/AIUI">AIUI</a> · <a href="https://github.com/jsar-project/ink">Ink</a> · <a href="https://github.com/modelcontextprotocol/ext-apps">MCP Apps SDK</a>
</p>
