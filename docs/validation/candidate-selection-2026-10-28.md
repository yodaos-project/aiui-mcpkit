# Candidate selection verification — 2026-10-28

Scope: [issue #3](https://github.com/yodaos-project/aiui-mcpkit/issues/3). The [example guide](../guides/candidate-selection.md) describes the reproducible procedure and evidence requirements.

**Result: actual desktop/model acceptance passed in two consecutive turns.** The user selected Travel bag, then Travel mug in the same app session; both model replies reproduced the correct product, price and newly published reference. The exact app-origin model-context inputs were inspected for the five allowed fields and exclusion of private state. Validation was performed on uncommitted changes on the branch below; subsequent publication is tracked in the linked issue.

[Issue #3](https://github.com/yodaos-project/aiui-mcpkit/issues/3) was closed as **completed** at 21:39 on 2026-10-28 (Asia/Shanghai), after publishing the [target-client acceptance evidence](https://github.com/yodaos-project/aiui-mcpkit/issues/3#issuecomment-6470513465). Independent GitHub read-back confirmed the closed/completed state, all four acceptance criteria checked and the exact evidence comment. Closure records verification of the bridge already shipped in PR #24; it does not publish the local example changes.

## Environment

- Source base: `b3ec5cbaa5f0b893397644638689cee14c46b394`; local changes on `codex/issue-3-candidate-selection`.
- Ink SDK: published `@yodaos-pkg/ink@0.20.0-daily.20261027171530`.
- Full suite: Node.js `22.21.1`, Google Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, native `ink-worker` from the companion Ink checkout.
- Installed macOS desktop bundle at the actual model validation: version `26.1023.50603`, build `22391`, with `codex-cli 0.165.0-alpha.1.2`. Earlier setup used `26.1016.61520`, build `21421`, with `codex-cli 0.163.0-alpha.11.1`. Version values were read from the installed application, rather than an About dialog.
- Business Demo: `business-demo@aiui-mcpkit-examples`, local version `0.1.0`.

## Initial candidate example verification (before Worker migration): passed

- `npm run build:examples` and `npm run typecheck` passed.
- Full `npm test` under Node 22 with `INK_WORKER_BIN` and `CHROMIUM_PATH`: **70 passed, 0 failed, 0 skipped**.
- Separate stdio protocol coverage verifies `find_products` discovery, typed candidates, routing, invalid input, empty results and supplier metadata isolation.
- Real Ink WASM browser coverage selects Travel bag and then Travel mug. Both publications contain exactly `sku`, `name`, `unitPrice`, `currency`, `selectionId`; the private note, supplier and unselected candidate are absent. Message text contains none of the selected values. Delivery waits for context acknowledgement; the second choice updates the named entry and unloading clears it.
- Browser interaction was automated with Playwright. The browser harness acknowledges delivery and does **not** run a model.

The full-suite command was:

```sh
PATH=/Users/yorkie/.nvm/versions/node/v22.21.1/bin:$PATH \
INK_WORKER_BIN=/Users/yorkie/workspace/jsar-project/ink/target/debug/ink-worker \
CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
npm test
```

## Desktop/model acceptance history

The new build was copied to the installed Business Demo using `node scripts/update-examples.mjs --example business`, then reinstalled with `codex plugin add business-demo@aiui-mcpkit-examples --json`. The user reported completing a reload. The active tool inventory in this execution still exposed only `check_stock` and `quote_order`, without `find_products`. A real `check_stock({"sku":"DEMO"})` call returned stock 100; this establishes an existing tool call, not candidate-selection acceptance.

All four installed artifacts were verified byte-for-byte against the new build. SHA-256: `view.html` = `2234ce371499099e527c0d84c2a2025041e29d198d4982997c5bc28cc84be431`; `dist/server.mjs` = `0726095321007361504a22618673d5f138f9f8cd57d31ba927da1620b3ad9f4b`.

The computer-use tool refused access to the native Codex application under its safety policy. Its supported MCP Apps browser listed no expanded side-panel app tabs; inline cards are outside that browser's inventory. No alternative native control mechanism was used.

At this stage no actual candidate selection, context injection or subsequent model response had been observed in the desktop client. The issue remained open pending that evidence.

### Follow-up: discovery diagnostics

After the user sent a new ordinary message, the model's active inventory still contained only `check_stock` and `quote_order`. A fresh stdio connection to the **installed** Business Demo server independently listed all three tools, including `find_products` and its `ui://business-demo/find_products.html` resource. This isolates the observed discrepancy to client discovery/loaded session state; it is not evidence of successful desktop routing.

`codex plugin marketplace list` also failed because two historical configured sources (`aiui-mcpkit-local` and `ink-counter-local`) no longer contained marketplace manifests. Their installed plugin snapshots were copied unchanged to durable catalogs under `~/.codex/local-marketplaces/`, preserving the marketplace names, plugin names and versions. `codex plugin marketplace add` updated these two source paths. The complete marketplace listing then succeeded. The prior configuration was backed up privately to `/tmp/mcpkit-marketplaces-before-repair-01a18105.toml`. This repaired a concrete configuration error; whether it caused the stale desktop inventory remains unverified.

Sending another message alone did not refresh the inventory. The [official local-plugin instructions](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually) require updating the marketplace's plugin directory and restarting the desktop app after a change. A full desktop restart after the catalog repair, fresh tool discovery and an expanded app panel are still needed before the real model test can run.

### Worker-action migration: current implementation

Following the application's requested Ink architecture, all three business tools now execute as `ModelContext.defineAction()` methods in `examples/business/workers/business.js`. The separate `examples/business/mcp-server/` directory was removed. `app.json.agentWorkers` declares the Worker, and the example build uses `worker: { name: 'business' }`. Page schemas retain public input/output contracts and UI routes; MCPKit generates the protocol adapter.

The Worker adapter now maps explicit JSON business failures to the original MCP business-error contract. Tests cover known error codes, UI-only failure details, malformed error envelopes and unexpected-exception redaction. The plugin updater copies/replaces the complete `worker-app/`, removing obsolete files. Protocol progress coverage uses a separate native operation fixture, because declared Action callbacks receive `signal` rather than the operation-only `reportProgress` extension.

Revalidation after migration: build and type checks passed; the full Node 22 suite passed **70/70**, with zero failures/skips. All four benchmark correctness scenarios and their server workloads passed (`benchmark-results/worker-migration/report.md`). The desktop native host was built from `e7bfd674575279730e1afda9747da4fad2a757a3`. CI uses the published SDK's QuickJS/WASM Worker host instead of checking out private Ink sources; remote results are tracked separately from these local checks.

The installed Business Demo was updated with its complete Worker app and a local `mcp.json` environment pointing `INK_WORKER_BIN` at the existing native executable. The generated and installed files were compared byte-for-byte. Current SHA-256: `view.html` = `723d306c342a145db86b17e4213deac6a820fe6544c5ca2f9b5d4a6d484ae276`; `dist/server.mjs` = `772605a0ced9676a1a469ae268379b36f067968972a188182620dbb2df9ec53c`.

A fresh stdio connection using that installed runtime configuration returned CNY 36 for quantity 2 with `DEMO10`, stock 100 for `DEMO`, and both travel candidates. This verifies the installed Worker deployment independently of Desktop. The active model inventory still lacked `find_products`; no real desktop selection/model response has been verified, and issue #3 remains open.

### Desktop restart: discovery and real tool execution

After the user reported a full desktop restart, the active inventory included `find_products`. Its first real call failed with `INTERNAL_ERROR`: the configured companion-checkout `target/debug/ink-worker` executable and its parent target directory no longer existed. A fresh standalone connection reproduced the same failure, so this was no longer a tool-discovery problem.

The native host was rebuilt from pinned Ink commit `e7bfd674575279730e1afda9747da4fad2a757a3` and installed at the stable local runtime path `~/.codex/runtimes/aiui-mcpkit/bin/ink-worker-e7bfd674`. Both generated and installed local MCP configurations now point to this path. A compatibility symlink restores the previous path for already-loaded client configuration without overwriting any existing file.

The subsequent **actual desktop tool call** `find_products({"query":"travel"})` succeeded, returning `TRAVEL-MUG` / CNY 89 and `TRAVEL-BAG` / CNY 249. This established native Worker execution through the real client. The stable host also passed all nine focused example, native Worker, business-browser and selection-browser tests with zero failures/skips.

### Actual model run 1: passed

Recorded on 2026-10-28 at approximately 21:33 (Asia/Shanghai). The user selected Travel bag and clicked **ASK ABOUT SELECTION**. The assistant did not automate the UI selection. The desktop delivered two distinct app-origin items from `business-demo`: a `model_context` payload and a generic message requesting the selected product and reference.

The exact structured context received by the model was:

```json
{
  "contexts": {
    "product_selection": {
      "description": "Product explicitly selected by the user. selectionId is the reference for this selection.",
      "value": {
        "currency": "CNY",
        "name": "Travel bag",
        "selectionId": "selection-pjqrdjdciq",
        "sku": "TRAVEL-BAG",
        "unitPrice": 249
      }
    }
  }
}
```

The separate message was: "Describe the product I selected, including its SKU and price, and quote my selection reference. If my selection is unavailable, say so instead of guessing."

Before calling any tools or reading files in that model turn, the assistant answered: "你选中的是 **Travel bag（旅行包）**，SKU **TRAVEL-BAG**，价格 **CNY 249**，选择编号 **`selection-pjqrdjdciq`**。"

The fresh reference was absent from the candidate tool result, generic message and prior conversation. Its correct appearance in the actual model response proves consumption of the newly published context. Inspection of the received context itself confirms exactly the five selected fields; it contains no private note, supplier, full Page state or unselected candidate. This privacy evidence comes from the delivered input, not merely the wording of the answer.

### Actual model run 2: passed

Recorded on 2026-10-28 at approximately 21:36 (Asia/Shanghai). In the same app session, the user changed the selection to Travel mug and clicked **ASK ABOUT SELECTION** again. The app-origin items had the same server and source session as run 1. The user-message text was unchanged and still contained no product values or reference.

The updated model-context value was:

```json
{
  "currency": "CNY",
  "name": "Travel mug",
  "selectionId": "selection-0phkxgygo7",
  "sku": "TRAVEL-MUG",
  "unitPrice": 89
}
```

This value appeared at the same `contexts.product_selection.value` key. It contained neither the previous product/reference nor the private note or supplier. Before using any tools or files in the second model turn, the assistant replied: "现在选中的是 **Travel mug（旅行杯）**，SKU **TRAVEL-MUG**，价格 **CNY 89**，选择编号 **`selection-0phkxgygo7`**。"

The new reference differed from run 1 and had not appeared in the previous conversation, candidates or generic user message. The reply therefore establishes actual consumption of the updated context, with no lookup of the reference through a different channel.

Record the following for each real run without obtaining the fresh reference from another channel before the model responds:

| Run | Selected candidate | Published reference | Actual model response | Result |
| --- | --- | --- | --- | --- |
| 1 | Travel bag / TRAVEL-BAG / CNY 249 | `selection-pjqrdjdciq` | Correct product, SKU, CNY 249 and exact fresh reference | Passed |
| 2 | Travel mug / TRAVEL-MUG / CNY 89 | `selection-0phkxgygo7` | Correct updated product, SKU, CNY 89 and exact new reference | Passed |

The protocol/provider, real Ink WASM browser, native Worker and actual desktop/model observations are recorded separately above. Both real model inputs contained only explicitly published selection fields. This completes the remaining target-client acceptance for issue #3. It does not establish live View-tool-to-model routing, other-client compatibility or remote CI results for the local changes.

## Public CI portability check

Before publishing, the full **70/70** tests were also run with `INK_WORKER_BIN` pointing to `scripts/ink-worker-wasm.mjs`, under Node 22 and Chrome, with zero failures/skips. This generic JSON Lines host delegates every operation to the pinned published SDK's `createInkWorkerHost()`; business code still executes in real Ink QuickJS/WASM. The helper contains no business handlers. CI selects this backend so it can run without credentials for the private Ink source repository. This additional backend check is separate from the native host used in the actual desktop/model acceptance above.
