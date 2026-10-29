# Return your first business result

English | [简体中文](first-business-tool.zh-CN.md) · [Learning path](../README.md)

**You will build:** a demo quote tool that returns **CNY 40** for two items, and shows that same result in its UI. Complete [page tools](page-tools.md) and [client setup](clients.md) first. This lesson uses a normal Node.js server function; it needs no external service, API key or Worker.

A page tool opens a screen. A **business tool** also runs a server function and returns structured data. MCPKit validates the input and output, then delivers the result to the assistant and the UI.

## 1. Create a separate small app

Keep your Counter. Create these files under the repository root:

```text
my-quote/
├── app.json
├── pages/
│   └── quote.ink
└── mcp-server/
    └── handlers.ts
```

Save this complete `my-quote/app.json`:

```json
{
  "name": "My Quote",
  "pages": ["pages/quote"]
}
```

## 2. Declare the input, output and UI

Save this complete `my-quote/pages/quote.ink`:

```html
<script type="application/json" def>
{
  "tool": "calculate_total",
  "navigationBarTitleText": "My Quote",
  "description": "Calculate a demo quote at CNY 20 per item.",
  "schema": {
    "data": {
      "type": "object",
      "properties": { "quantity": { "type": "integer", "minimum": 1, "maximum": 100 } },
      "required": ["quantity"],
      "additionalProperties": false
    },
    "output": {
      "type": "object",
      "properties": {
        "quantity": { "type": "integer" },
        "total": { "type": "integer" },
        "currency": { "type": "string", "enum": ["CNY"] }
      },
      "required": ["quantity", "total", "currency"],
      "additionalProperties": false
    }
  }
}
</script>

<script setup>
export default {
  data: { quantity: 0, total: 0, currency: 'CNY', status: 'Waiting for a tool result' },
  onMessage(event) {
    const message = event.data;
    if (message.type !== 'mcpkit:tool-result') return;
    if (message.isError) {
      this.setData({ status: 'The calculation failed' });
      return;
    }
    this.setData({ ...message.structuredContent, status: 'Ready' });
  },
};
</script>

<page>
  <view class="screen">
    <text>My quote</text>
    <text>Quantity: {{quantity}}</text>
    <text>{{currency}} {{total}}</text>
    <text>{{status}}</text>
  </view>
</page>

<style>
.screen {
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  background-color: #000000;
  color: #40ff5e;
}
</style>
```

`schema.data` describes the input, as in the previous lesson. `schema.output` describes a successful business result. `onMessage()` receives that result through `event.data`; `setData()` displays it.

## 3. Implement the calculation

Save this complete `my-quote/mcp-server/handlers.ts`:

```ts
export const handlers = {
  calculate_total: async ({ quantity }: { quantity: number }) => {
    const total = quantity * 20;
    return {
      content: [{ type: 'text', text: 'Total: CNY ' + total }],
      structuredContent: { quantity, total, currency: 'CNY' },
    };
  },
};
```

`handlers.ts` is the default server module. This is a TypeScript file; the parameter annotation says that `quantity` is a number. Generated contracts can be added later. The `calculate_total` key must match the page's `tool` name. `content` is a readable summary, while `structuredContent` must match `schema.output`.

## 4. Build and connect it

From the repository root:

```sh
node scripts/build-plugin.mjs ./my-quote --name my-quote --out ./dist/my-quote
```

For Codex's plugin route:

```sh
codex plugin marketplace add ./dist/my-quote
codex plugin add my-quote@my-quote-local
```

For another client, follow [client setup](clients.md) using the absolute path to `dist/my-quote/dist/server.mjs`. Reload the host and confirm it discovers `calculate_total`.

Send this **chat prompt** to the assistant:

```text
Call calculate_total with { "quantity": 2 }.
```

**Expected:** structured data `{ "quantity": 2, "total": 40, "currency": "CNY" }`, and a UI showing quantity 2, CNY 40 and Ready. A text-only MCP client receives the result without an interactive View.

The ordinary browser watcher shows the layout but does not execute this server call, so it stays at “Waiting for a tool result”. Use the connected client to verify business execution.

## 5. Check one failure

Ask for `{ "quantity": 0 }`. The input schema rejects it before your handler runs. If your handler returns data that does not match `schema.output`, MCPKit also rejects that successful result.

**Checkpoint:** a valid call returns CNY 40; invalid input fails. The assistant and UI use the same server result. No real order is placed.

## Add complexity when you need it

- Add an external API call inside the handler. Keep credentials in server environment variables; `mcp-server/` is excluded from UI assets.
- Use the generated `dist/my-quote/tools.d.ts` contracts when adding TypeScript types; see [business tool adapters](business-tools.md#node-handlers-and-validation).
- Add a calculate button, loading and cancellation with [request lifecycle](tool-lifecycle.md).
- Choose an optional Worker backend with [business tools](business-tools.md).

**Next:** [Send a message or selected context](agent-session.md), or [handle loading and errors](tool-lifecycle.md).
