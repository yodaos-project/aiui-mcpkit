# Business tools in Agent Workers

English | [简体中文](business-tools.zh-CN.md) · [Documentation index](../README.md)

The [Business Demo](../../examples/business) implements `quote_order`, `check_stock` and `find_products` as `ModelContext.defineAction()` methods in [workers/business.js](../../examples/business/workers/business.js). Pages display results and publish selected context. MCPKit generates the protocol server; the example needs no handwritten server handlers.

## Declare and build the Worker

Register the Worker in `app.json.agentWorkers`:

```json
{ "name": "business", "script": "workers/business.js", "trigger": { "type": "open" }, "lifetime": "foreground" }
```

Build with the same name:

```js
await buildPlugin({
  source: './agent', name: 'business-demo',
  outputDir: './dist/business-demo',
  worker: { name: 'business' },
  typesFile: './agent/.mcpkit/tools.d.ts',
});
```

The repository's [example builder](../../scripts/build-examples.mjs) selects this adapter. Registered pages still declare tool names, descriptions, input `schema.data` and successful output `schema.output` for public MCP contracts and page routing. The Worker implements the corresponding names. See [page tools](page-tools.md).

## Implement actions

This fragment shows the pattern; the linked Worker contains all three implementations:

```js
export default {
  available: 100,
  checkStock: ModelContext.defineAction({
    name: 'check_stock', description: 'Check demo stock',
    execute(input, { signal }) {
      signal.throwIfAborted();
      if (input.sku !== 'DEMO') return {
        isError: true,
        businessError: { code: 'UNKNOWN_SKU', message: 'Use demo SKU DEMO.' },
        uiMetadata: { knownSku: 'DEMO' },
      };
      return {
        content: [{ type: 'text', text: '100 demo items available.' }],
        structuredContent: { sku: input.sku, available: this.available },
      };
    },
  }),
};
```

Ink binds `this` to the Worker instance. Actions receive an execution `signal`; the asynchronous quote clears its timer on cancellation. The Worker registry is independent of the UI and can run before a View opens. No Node imports, `process.env`, Page or renderer are used.

| Worker result | MCP result | Visibility |
| --- | --- | --- |
| `content` | `content` | Model-visible content |
| `structuredContent` | `structuredContent` | Validated successful data, also delivered to UI |
| `uiMetadata` | `_meta.uiOnly` | UI-only display data |
| `isError: true` and `businessError: { code, message }` | `isError`, `_meta.businessError`, standard error text | Explicit business failure; no successful output |

Explicit failures may include UI-only details in `uiMetadata`. Malformed failure envelopes and unexpected Worker exceptions produce generic `INTERNAL_ERROR` results, without publishing exception messages or stacks. Input/output schemas are enforced by the generated server. Generated `ToolInputs`, `ToolOutputs` and `BusinessHandlers` remain available for integrations; runtime validation applies to the JavaScript Worker.

The native host's separate `operations` interface provides `requestId`, `configuration` and `reportProgress`. These operation-only fields are not available in `ModelContext.defineAction()` callback context. This example uses declared actions throughout. See [runtime integration](runtime-integration.md).

## Run and deploy

Build the native host from the Ink repository:

```sh
cargo build -p ink-script --bin ink-worker
```

Put `ink-worker` on the MCP server process's PATH or configure that process's `INK_WORKER_BIN` with an absolute executable path. Desktop environments can differ from your terminal. Deploy the generated `worker-app/` alongside `view.html`, `dist/server.mjs` and manifests. `update:examples` synchronizes all these artifacts.

For repository development or CI without a native executable, point `INK_WORKER_BIN` at the absolute path to `scripts/ink-worker-wasm.mjs` after `npm ci`. This generic host runs the actions in the published SDK's real Ink QuickJS/WASM runtime. It is separate from the native host used for the recorded desktop acceptance.

From the MCPKit repository:

```sh
npm run build:examples
INK_WORKER_BIN=/absolute/path/to/ink-worker npm test
INK_WORKER_BIN=/absolute/path/to/ink-worker npm run start:examples -- business
```

Call `quote_order({ "quantity": 2, "coupon": "DEMO10" })` for CNY 36 and stock 98; `check_stock({ "sku": "DEMO" })` for stock 100; or `find_products({ "query": "travel" })` for two candidates. See [candidate selection](candidate-selection.md) for the model-context loop. Unknown coupons return `INVALID_COUPON`, unknown SKUs return `UNKNOWN_SKU`, and schema-invalid inputs never run the Worker. **CALCULATE** and **CANCEL** call/cancel the same Worker action. No orders are placed.

## UI results and privacy

Initial results arrive as `{ type: 'mcpkit:tool-result', structuredContent, uiOnly, isError, error, request }` in `onMessage(event)`. Later `mcpkit:tool-state` successes carry the full response in `result`. The [order page](../../examples/business/pages/order/index.ink) handles both envelopes and correlates requests. See [messages](../reference/messages.md) and [lifecycle](tool-lifecycle.md).

Worker source is bundled with the app, including the browser View: do not put credentials in it. The supplier label is public demo data returned as UI metadata. UI-only data is excluded from model-visible results, but remains accessible to the host/user. The selection page explicitly projects selected fields into context.

## Existing Node handlers and validation

`mcp-server/handlers.ts` was the temporary business entrypoint while headless Worker invocation was pending in [Ink #682](https://github.com/jsar-project/ink/issues/682). MCPKit retains this optional adapter for existing Node integrations; Business Demo has migrated to the Worker adapter. See the [migration steps](runtime-integration.md#worker-contract-and-migration).

A page opener without `schema.output` needs no handler. A business tool with `schema.output` requires an execution implementation, even when no UI is displayed. Its name, description and input/output schemas still come only from registered `.ink` pages; do not add a handwritten contracts file or registration list.

For the Node adapter, export `handlers` from `<source>/mcp-server/handlers.ts`, or select another module with `buildPlugin({ ..., handlers: '/absolute/path/to/handlers.ts' })`. Use generated types:

```ts
import type { BusinessHandlers } from '../.mcpkit/tools.js';

export const handlers = {
  check_stock: async ({ sku }, { signal, progress }) => {
    signal.throwIfAborted();
    progress({ progress: 1, total: 1 });
    return { content: [], structuredContent: { sku, available: 100 } };
  },
} satisfies BusinessHandlers;
```

This fragment assumes `check_stock` is the only business tool; implement every generated `BusinessHandlers` member. Keep computation, queries and service calls in `mcp-server/`. The generated framework owns MCP registration/transport, validation, cancellation/progress forwarding and result packaging; handlers need no MCP SDK imports. Server modules, their dependencies and credentials stay outside UI assets. `_meta.uiOnly` is display data accessible to the host/user, not secret storage.

| When | Checks and failure behavior |
| --- | --- |
| Build, before output creation/replacement | Validate page contracts and resolve the selected handler module with the bundler's normal extension/index rules. An unresolved module reports its path and affected business tool names. Bundle imports without executing application code. Existing artifacts and declarations survive failure. |
| Server startup, before connecting or discovery | Evaluate the bundled module and require an own function for each business tool in its exported `handlers` map. Missing maps/members, inherited members and non-functions fail with `Missing business handler: <tool>`. This dynamic check is intentionally deferred until startup. |
| Invocation | Validate inputs before execution and successful results before returning them. Invalid results and execution failures return errors; a business tool never silently becomes a page opener. |

Worker builds require a manifest entry matching `worker.name` and cannot also select `handlers`. Worker executable availability, initialization and operation lookup are checked on invocation, when the host starts; a successful build or tool list does not prove Worker readiness. A missing host/operation fails the call without falling back to Node execution or fabricated success.

---

[Documentation index](../README.md)
