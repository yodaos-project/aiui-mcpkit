# Pick an example to explore

English | [简体中文](README.zh-CN.md) · [Learning path](../docs/README.md)

Start with the interface you want to build. All commands below run from the repository root after `npm ci`. If this is your first run, follow [the Counter quickstart](../docs/getting-started/quickstart.md).

## 1. Preview one example in a browser

```sh
npm run watch:examples -- travel
```

Open the URL in the terminal's `preview` line. Stop with Ctrl+C before switching examples. Replace `travel` with one of these IDs:

| ID | What to try | Source |
| --- | --- | --- |
| `counter` | Click to change a count. The smallest starting point. | [Counter](counter) |
| `travel` | Switch days and save a stop. Sharing with the assistant is a later client step. | [Travel Planner](travel) |
| `focus` | Start, pause and reset a timer. | [Focus Studio](focus) |
| `analytics` | Change week/month and watch metrics and the chart update. | [Analytics Lab](analytics) |
| `events` | Choose a session and seat count, then review a demo booking. | [Event Booking](events) |

These five examples need no native Worker or external service. Travel/analytics/workshop use fixtures; booking is a local demo without payment, reservation or email. The focus timer pauses when hidden and is disposed when the View closes. New Views start independent state.

The ordinary browser preview cannot send conversation messages or execute server business calls. Use [client setup](../docs/guides/clients.md) to try those features. The [Worker-backed business demo](../docs/guides/business-tools.md) adds quotes, stock, selection and a shared catalog; start there after the basic UI path.

## 2. Try an example with an assistant

Build the installable plugins, then follow your client's [connection guide](../docs/guides/clients.md):

```sh
npm run build:examples
```

For Codex, register the shared catalog once and install any subset:

```sh
codex plugin marketplace add ./dist/examples
codex plugin add ink-counter@aiui-mcpkit-examples
codex plugin add travel-planner@aiui-mcpkit-examples
codex plugin add focus-studio@aiui-mcpkit-examples
codex plugin add analytics-lab@aiui-mcpkit-examples
codex plugin add event-booking@aiui-mcpkit-examples
```

Business Demo additionally needs a configured Worker host; its plugin is `business-demo@aiui-mcpkit-examples`. Reload the client and check its active tool list after installation. Each plugin has its own generated server.

`npm run start:examples -- travel` starts that plugin's stdio server for an MCP client; it does not serve a preview URL. To edit an installed copy, follow [development workflow](../docs/guides/development.md).

## 3. Look up tools and input fields

<details>
<summary>Plugin IDs, tool inputs and live View actions</summary>

| ID / plugin | Open tool and input | Design and interaction | Live View action |
| --- | --- | --- | --- |
| `counter` / `ink-counter` | `open_counter`, `open_countdown` | Green terminal; counters, activity and display modes. | — |
| `business` / `business-demo` | `quote_order`, `check_stock`, `find_products`, shared catalog tools | Business results, cancellation, selected context and shared App navigation. Needs an Ink Worker host. | `catalog_state` and catalog actions |
| `travel` / `travel-planner` | `open_trip`, optional `day: 1 \| 2` | Blue editorial itinerary; day switch, saved stop and explicit sharing. | `trip_state` |
| `focus` / `focus-studio` | `open_focus`, optional `minutes: 1–60`, `task` up to 50 characters | Coral timer; start, pause, reset and teardown cleanup. | `focus_state` |
| `analytics` / `analytics-lab` | `open_analytics`, optional `period: "week" \| "month"` | Violet dashboard; period filter drives KPIs and a bar chart. | `analytics_state` |
| `events` / `event-booking` | `open_workshop`, optional `seats: 1–4` | Warm ceramic poster; sessions, bounded seat stepper, totals, review and confirmation. | `workshop_state` |

Open tools are generated from each page's `script def`; the new live state actions use `ModelContext.defineAction()`. They are read-only projections, available through a supporting host while the View is open. They are not extra server tools and do not persist after teardown.

All four new plugins run without external services or a native Worker. Travel uses a curated itinerary, analytics uses deterministic sample metrics, and workshop confirmation is local demo state. No booking, payment or email is performed. The focus timer runs in the open View and pauses when hidden; closing the View disposes its timer. States are not persisted across new Views.

Travel publishes only the explicitly selected stop after **ASK ASSISTANT +**. It awaits context acknowledgement before sending the user message and disposes context at teardown. A host without conversation/context support shows an unavailable status. Browser tests verify host delivery; actual model use remains host-dependent.

</details>

## 4. Capture and verify examples

Use this after the UI works manually. It needs Playwright/Chromium; ordinary watch mode does not.

```sh
npx playwright install chromium
node --test tests/showcase-browser.test.mjs
npm run capture:examples
```

The capture command requires built examples. It verifies state changes through live actions, captures actual Ink canvas output at 800×500/DPR 3 and inline/narrow layouts, and records action coordinates and states in ignored `test-results/showcase-captures/layout.json`. README images are written to `docs/assets/examples/`; intermediate interaction captures stay under `test-results/showcase-captures/`. `CHROMIUM_PATH` can select an existing Chromium executable.

**Next:** [Change a button](../docs/getting-started/edit-example.md), or [create your own app](../docs/getting-started/first-agent.md).
