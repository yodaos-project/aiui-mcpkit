# Example collection

[简体中文](README.zh-CN.md) · [Project README](../README.md)

Run `npm ci && npm run build:examples` at the repository root. Each directory builds a separate installable plugin in the shared `dist/examples/` marketplace. `npm run start:examples -- <id>` starts one stdio server; Counter is the default.

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

## Capture and verification

```sh
npx playwright install chromium
node --test tests/showcase-browser.test.mjs
npm run capture:examples
```

The capture command requires built examples. It verifies state changes through live actions, captures actual Ink canvas output at 800×500/DPR 3 and inline/narrow layouts, and records action coordinates and states in `videos/showcase/out/captures/layout.json`. It writes README images to `docs/assets/examples/` and intermediate captures to ignored `videos/showcase/out/captures/`; `npm run capture:modes` updates the film textures. `CHROMIUM_PATH` can select an existing Chromium executable.

[Promotional film source and rendering](../videos/showcase/README.md)
