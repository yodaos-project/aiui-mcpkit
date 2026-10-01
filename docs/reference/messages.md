# Page messages and result formats

English | [简体中文](messages.zh-CN.md) · [Documentation index](../README.md)

Use this reference when wiring an Ink page's `onLoad`, `onMessage` and `postMessage`. For runnable code, see the [business page](../../examples/business/pages/order/index.ink). Protocol messages below are MCPKit page messages carried by the Apps channel; do not write them directly to server stdin as JSON-RPC requests.

## Initial input and result

`onLoad(query)` receives launch arguments. Scalars are strings; objects/arrays are JSON strings. Convert only according to your schema. For example, `Number(query.quantity)` converts a declared numeric input; `JSON.parse(query.options)` decodes a declared object.

Initial business results are delivered to `onMessage(event)` through `event.data`:

```js
{
  type: 'mcpkit:tool-result',
  structuredContent: { total: 40 },
  uiOnly: { stockRemaining: 98 },
  isError: false,
  // error and request are supplied as applicable
}
```

On error, handle `isError` and `error`; do not assume `structuredContent` exists. Results arriving before WASM startup are buffered for the page. Treat `uiOnly` as client-visible presentation data, not confidential storage.

## Request a tool from the page

```js
this.postMessage({
  type: 'mcpkit:call-tool',
  requestId: 'quote-1',
  name: 'quote_order',
  arguments: { quantity: 2 },
});
```

The host needs `serverTools` capability and access to the requested tool. IDs must be nonempty and unique for the View lifetime. Missing IDs and reused IDs are ignored. Invalid tool names/arguments return `invalid_request` without dispatch.

Cancel using the same ID:

```js
this.postMessage({ type: 'mcpkit:cancel-tool', requestId: 'quote-1' });
```

## Observe request state

`event.data.type === 'mcpkit:tool-state'` identifies lifecycle messages. Common fields are `requestId`, `state`, `attempt` and `policy`.

| State | Additional fields | UI action |
| --- | --- | --- |
| `pending` | Optional `progress`; attempt normally starts at 1. | Show loading; update progress for that ID. |
| `ready` | `result`: complete MCP tool result. | Stop loading; read `result.structuredContent` and `result._meta?.uiOnly`. |
| `error` | `error: { code, message }`. | Stop loading and show the failure. |
| `cancelled` | `error: { code, message }`. | Stop loading and show cancellation. |

Invalid requests use attempt 0. Never infer terminal success from progress reaching its total; await `ready`. `request_timeout`, `total_timeout`, `tool_error` and `invalid_request` are lifecycle failure codes. Business result codes such as `INVALID_OUTPUT` belong to `_meta.businessError`, not the same code namespace.

Keep concurrent state keyed by ID. Host cancellation, view closure and page replacement cancel outstanding calls. Late progress/results cannot settle a cancelled or replaced attempt. Policy/retry configuration is documented in [request lifecycle](../guides/tool-lifecycle.md).

## Model-visible versus UI-only result data

| Handler return field | Delivered MCP result | Reader |
| --- | --- | --- |
| `content` | `content` | AI and client; textual summary or supported content blocks. |
| `structuredContent` | `structuredContent` | AI and client; validated against the output schema. |
| `uiOnly` | `_meta.uiOnly` | Client/UI; excluded from model context. |

An expected `BusinessToolError` returns `isError: true`, text `CODE: message`, `_meta.businessError` and optional `_meta.uiOnly` details. It omits successful `structuredContent`. Unexpected exceptions expose generic `INTERNAL_ERROR`. See [business tools](../guides/business-tools.md) for the handler contract.

---

[Documentation index](../README.md) · Previous: [Build API](build-api.md) · Next: [Protocol compatibility](compatibility.md)
