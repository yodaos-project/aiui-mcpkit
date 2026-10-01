# Typed business tools

English | [简体中文](business-tools.zh-CN.md) · [Documentation index](../README.md)

**Goal:** expose a typed server operation whose result can be used by both the AI and the UI. Read [page tools](page-tools.md) first. The snippets below demonstrate the contract and handler; use the repository's complete [business example](../../examples/business) when you want a runnable UI with buttons and result rendering.

## Start with a working project

1. Build and install `business-demo` using [the quickstart](../getting-started/quickstart.md).
2. Open [`app.json`](../../examples/business/app.json) to see its registered order and stock pages.
3. Open [`pages/order/index.ink`](../../examples/business/pages/order/index.ink): `schema.data` defines inputs and `schema.output` defines the quote result.
4. Open [`mcp-server/handlers.ts`](../../examples/business/mcp-server/handlers.ts): the `handlers` object implements exactly those tool names.
5. Change a public display label first, run `npm run update:examples`, reload the host and open a new quote card.
6. Then change handler logic, rebuild again, and check both the structured tool result and rendered page.

For your own project, register each business page in `app.json.pages`, add a handler for each page with `schema.output`, set `typesFile` as below, and build before typechecking. The TypeScript import `../.mcpkit/tools.js` resolves the generated `.d.ts`; you do not write a JavaScript implementation of that type module. Use `import type` so it disappears from bundled code.

Declare business tools directly in the `.ink` pages registered by `app.json.pages`. Their `script def` supplies `schema.data` for inputs and `schema.output` for business outputs. The builder generates MCP registration metadata and TypeScript types from these definitions, without a separate `contracts.ts` or duplicate schemas. Tools without `schema.output` retain the page-opening behavior.

```html
<!-- pages/order/index.ink -->
<script type="application/json" def>
{
  "tool": "quote_order",
  "navigationBarTitleText": "Order quote",
  "description": "Calculate an order quote.",
  "schema": {
    "data": {
      "type": "object", "properties": { "quantity": { "type": "integer", "minimum": 1 } },
      "required": ["quantity"], "additionalProperties": false
    },
    "output": {
      "type": "object", "properties": { "total": { "type": "number" } },
      "required": ["total"], "additionalProperties": false
    }
  }
}
</script>
```

```ts
// mcp-server/handlers.ts
import { BusinessToolError } from '@yodaos-pkg/aiui-mcpkit/tools';
import type { BusinessHandlers } from '../.mcpkit/tools.js';

export const handlers: BusinessHandlers = {
  async quote_order(input, { signal, progress }) {
    if (input.quantity > 100) throw new BusinessToolError('OUT_OF_STOCK', 'Choose at most 100 items.');
    signal.throwIfAborted();
    progress({ progress: 1, total: 1, message: 'Quote calculated' });
    return {
      content: [{ type: 'text', text: `Quote: ${input.quantity * 20}` }],
      structuredContent: { total: input.quantity * 20 },
      uiOnly: { stockRemaining: 100 - input.quantity },
    };
  },
};
```

The builder reads `mcp-server/handlers.ts` in the project root by default; `handlers` can select another module. It bundles handlers without executing them at build time. Set `typesFile` to keep generated declarations in the project’s `.mcpkit/` directory:

```js
await buildPlugin({
  source: './order-agent', name: 'order-agent',
  outputDir: './order-agent/dist/plugin',
  typesFile: './order-agent/.mcpkit/tools.d.ts',
});
```

Build before running TypeScript checks. Generated `ToolInputs`, `ToolOutputs` and `BusinessHandlers` check tool names, arguments and structured outputs; rebuild after changing a page schema. The generator handles nested objects, arrays, enums, unions and local `$ref`; schema features it cannot express use `unknown`, while runtime JSON Schema validation remains authoritative. Tool names must be unique, and business tools require object input and output schemas. Schemas are checked at build time, advertised unchanged through MCP tools/list, and validated on every call. Missing handlers fail server startup before connection. Business tools in `result.tools` include `outputSchema`, and `result.files.types` points to the generated declarations.

| Handler field | MCP response | Visibility |
| --- | --- | --- |
| `content` | `content` | Model-visible summary/content blocks |
| `structuredContent` | `structuredContent` | Model-visible data validated against `outputSchema`, also available for rendering |
| `uiOnly` | `_meta.uiOnly` | UI-only data; excluded from model context |

Ink pages receive the initial model-invoked result in `onMessage(event)` as `{ type: 'mcpkit:tool-result', structuredContent, uiOnly, isError, error, request }`, including when the result arrives before WASM startup. Agent-initiated calls use the [request lifecycle](tool-lifecycle.md) protocol; successful `mcpkit:tool-state` messages contain the complete result in `result`. For initial-result rendering, read `event.data.structuredContent` and `event.data.uiOnly`. UI-only data is accessible to the client and must never contain credentials.

Business failures return `isError: true`, text content `CODE: message`, and `_meta.businessError: { code, message }`. They omit `structuredContent` so clients do not validate an error against a successful output schema. `BusinessToolError(code, message, details?)` exposes its explicit code/message; optional details go to `_meta.uiOnly`. Built-in codes are `INVALID_INPUT`, `INVALID_OUTPUT`, `INTERNAL_ERROR`, `CANCELLED`, `REQUEST_TIMEOUT` and `TOTAL_TIMEOUT`. Invalid inputs do not run a handler; invalid outputs never produce success. Unexpected exceptions return the generic `INTERNAL_ERROR` message, including in lifecycle metadata, without leaking exception text or stacks. Business errors end the request in `error` and never retry by default.

Keep handlers and configuration in the project’s `mcp-server/` directory. The builder excludes `mcp-server/`, `dist/`, `.mcpkit/`, `.git/`, `node_modules/`, `.env` files and transitive server imports from UI assets; remaining assets are public UI content. Handler code is bundled only into `dist/server.mjs`, and environment variables are read at server runtime. Handler modules can import runtime helpers from the root package or `/tools`; packaging APIs such as `buildPlugin` belong in the build script.

Try the complete [business example](../../examples/business):

```sh
npm run build:examples
npm run start:examples -- business
```

Register that server with an MCP Apps client. Call `quote_order` with `{ "quantity": 2 }` (optionally `"coupon": "DEMO10"`), or `check_stock` with `{ "sku": "DEMO" }`. The quote page shows structured totals and UI-only stock data; **CALCULATE** calls the real handler and **CANCEL** interrupts it. The tools open their respective quote and stock pages registered in `app.json.pages`. The fixture uses deterministic demo data and places no orders. `npm run typecheck` checks the typed example and rejects intentionally incorrect input/output assignments; MCP and real Ink WASM browser tests verify discovery, contracts, errors, server-code isolation, rendering, invocation and cancellation.

## Render the two result paths correctly

The initial AI-invoked result and a later page-initiated result have different envelopes. Add this method to your page's `export default` object; adapt the displayed fields to your output schema:

```js
onMessage(event) {
  const message = event.data;
  if (message.type === 'mcpkit:tool-result') {
    this.setData({ total: message.structuredContent?.total ?? 0 });
  } else if (message.type === 'mcpkit:tool-state' && message.state === 'ready') {
    this.setData({ total: message.result.structuredContent?.total ?? 0 });
  }
}
```

This is a rendering fragment, not a complete page. The complete business page also correlates IDs, stops loading on error/cancellation and displays failure messages. See [messages](../reference/messages.md) and [request lifecycle](tool-lifecycle.md).

## Where configuration belongs

Keep credentials on the server and load them from environment variables in handlers. `uiOnly` means omitted from model context, not secret from the host/user. Metadata, schema descriptions and UI assets are public. Do not send tokens through any of them.

For remote work, pass the handler's `signal` into `fetch(url, { signal })` or another API that actually cancels work. Sending a cancellation message alone cannot undo an already completed side effect. Keep diagnostics off stdio's stdout; use stderr for server logs because stdout carries MCP protocol messages.

---

[Documentation index](../README.md) · Previous: [Page tools](page-tools.md) · Next: [Request lifecycle](tool-lifecycle.md)
