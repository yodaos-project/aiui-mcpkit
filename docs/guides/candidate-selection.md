# Candidate selection and model context

English | [简体中文](candidate-selection.zh-CN.md) · [Documentation index](../README.md)

The [Business Demo](../../examples/business/app.json) includes a complete candidate selection page. `find_products` returns validated product candidates; the user chooses a product and clicks **ASK ABOUT SELECTION** to publish the choice and send a user message. This is a demo catalog and makes no purchase or durable business write.

## Run the example

From the repository root, build and update the installed Business Demo:

```sh
npm run build:examples
node scripts/update-examples.mjs --example business
```

For the first installation, follow the [quickstart](../getting-started/quickstart.md). Reload the MCP server/desktop host after updating, open a fresh View, and confirm that the active chat discovers `find_products` alongside `quote_order` and `check_stock`. Updating files alone does not establish discovery in an existing chat.

Ask your client to call:

```text
find_products({ "query": "travel" })
```

The tool returns Travel mug (`TRAVEL-MUG`, CNY 89) and Travel bag (`TRAVEL-BAG`, CNY 249). An empty query returns the full three-product catalog; a query without a match returns an empty array. Select either candidate in the UI and click **ASK ABOUT SELECTION**. The page waits for context publication to be acknowledged before sending the message. Unsupported capabilities or host refusal appear in the page status; a publication failure does not send a message.

## Data boundaries

| Data | Destination |
| --- | --- |
| Candidate list | Tool `structuredContent.candidates`, available to both model and UI |
| Current selection | Only after the ask button: `structuredContent.contexts.product_selection.value` |
| Supplier metadata | Tool `_meta.uiOnly`, available to the UI |
| Private note and Page state | Kept in the UI; never included in the publication projection |
| Durable business data | No write is performed by this example |

The published value contains exactly `sku`, `name`, `unitPrice`, `currency`, and `selectionId`. The page creates the selection reference at button click time; it is not in the original candidate result or the user-message text. A second choice updates the same named context handle, with a new reference. Closing/unloading the page disposes the context.

The user message asks the model to describe the selected product, including its SKU, price and selection reference. It contains none of those selected values. A correct reference in a later model response therefore provides useful evidence that the model received the new context, provided the test does not separately reveal it through logs, screenshots, tools or a pasted prompt.

Source: [Page](../../examples/business/pages/selection/index.ink), [Worker actions](../../examples/business/workers/business.js). Business tools execute through `ModelContext.defineAction()` in the manifest's `business` AgentWorker. The server process needs `ink-worker` on PATH or `INK_WORKER_BIN`; see [business tools](business-tools.md). For context APIs, see [Agent sessions](agent-session.md).

## Verify each layer separately

1. **Protocol:** `tests/examples.test.mjs` checks the real stdio server's tool discovery, candidates, input validation, page routing and UI-only supplier metadata.
2. **Browser:** `tests/selection-browser.test.mjs` uses the real server result, Ink WASM and MCP Apps bridge. It clicks both candidates, checks the exact public projection, waits for context acknowledgement before the generic message, and checks context updates/disposal. This harness does not run a model.
3. **Target client/model:** run the following acceptance procedure in the actual desktop client. Protocol/browser success does not replace this step.

Run the local checks after building:

```sh
npm run typecheck
INK_WORKER_BIN=/absolute/path/to/ink-worker node --test tests/examples.test.mjs tests/selection-browser.test.mjs
```

For desktop acceptance, record the date, client/version, SDK, tool arguments, selected product, exact delivered context and subsequent model response. Choose Travel bag, ask about the selection, and require the model to name `TRAVEL-BAG`, CNY 249 and the newly generated reference. Then select Travel mug and repeat: require `TRAVEL-MUG`, CNY 89 and the new reference. Do not reveal either reference to the model through another channel. Check the host's model-input/context evidence separately for exclusion of the private note and supplier; their absence from the model's answer alone is insufficient.

Record UI actions performed by a person separately from actions performed by an automation tool. Host acknowledgement, UI screenshots, and View-tool discovery each establish a narrower fact than a real model response. Keep [issue #3](https://github.com/yodaos-project/aiui-mcpkit/issues/3) open until its target-client/model acceptance is recorded.

---

[Documentation index](../README.md) · [Verification record](../validation/candidate-selection-2026-10-28.md)
