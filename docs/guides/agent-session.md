# Agent sessions and live tools

English | [简体中文](agent-session.zh-CN.md) · [Documentation index](../README.md)

MCPKit uses the published Ink SDK `0.20.0-daily.20261027171530`. Run `npm ci` and rebuild your plugin; a local Ink SDK build is unnecessary. Reload the server and reopen its View after updating an installed copy.

## Choose the API

| Goal | API | Host requirement |
| --- | --- | --- |
| Send a user message from a button | `getApp().getAgent().conversation.sendMessage()` | Text message capability |
| Publish selected data as model context | `agent.provideContext()` | Structured context capability |
| Let the model read or change the live App/Page | `ModelContext.defineAction()` | View tool discovery, calls and model routing |
| Register or revoke a tool at runtime | `getApp().modelContext.registerTool()` | The same View tool support |
| Call a server business tool from the Page | `agent.callTool()` | Server tool calls |
| List/read host resources | `agent.listResources()` / `readResource()` | Server resources |

The generated View binds the provider after the MCP Apps handshake. Unsupported operations reject with `NotSupportedError`; explicit host refusal of a message rejects with `NotAllowedError`.

For a runnable tool-to-UI-to-context example with a selection reference absent from the user message, see [Candidate selection](candidate-selection.md).

## Send a message and expose the current selection

Replace the page from [your first Agent](../getting-started/first-agent.md) with this complete `.ink` file, preserving its route in `app.json.pages`. This example keeps the fallback `open_app` entrypoint. The button explicitly publishes a context entry and sends a user message. The `get_selection` tool reads the existing Page instance.

```html
<script setup>
export default {
  data: { selectedSku: 'DEMO', status: '', sending: false },
  getSelection: ModelContext.defineAction({
    name: 'get_selection',
    description: 'Read the product selected on the current page',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute() {
      return { selectedSku: this.data.selectedSku };
    },
  }),
  async sendSelection() {
    if (this.data.sending) return;
    this.setData({ sending: true, status: '' });
    try {
      const agent = getApp().getAgent();
      const value = { selectedSku: this.data.selectedSku };
      if (this.selection) {
        await this.selection.update(value);
      } else {
        this.selection = await agent.provideContext({
          key: 'selection', description: 'Selected product', value,
        });
      }
      await agent.conversation.sendMessage({
        role: 'user',
        content: [{ type: 'text', text: 'Describe product ' + value.selectedSku + '.' }],
      });
      this.setData({ status: 'Message accepted by host' });
    } catch (error) {
      this.setData({ status: error.name + ': ' + error.message });
    } finally {
      this.setData({ sending: false });
    }
  },
  onUnload() { this.selection?.dispose(); },
};
</script>
<page>
  <text>Selected product: {{selectedSku}}</text>
  <button bindtap="sendSelection">Ask about this product</button>
  <text>{{status}}</text>
</page>
```

Open the page and click the button. The host should receive a user message and `structuredContent.contexts.selection` with its description and value. If the host routes View tools to its model, ask it to call `get_selection`; expect `{ "selectedSku": "DEMO" }`. Message completion confirms host acceptance; when to run the model and display its response remains a host decision. Context publication alone does not send a message or trigger inference, and App/Page state is never published automatically.

The same `ModelContext.defineAction()` declaration works on own methods in `app.js`, where `this` is the App. On a Page, `this` is the Page. Tool names are explicit and must be unique across the active App/Page registry. Page actions disappear when hidden and return when shown; unloading cancels their pending calls. Use method syntax for `execute()` when you need the owning `this`.

These live tools use MCP Apps View `tools/list` and `tools/call`. They do not become generated server tools or appear in `buildPlugin().tools`, which contains build-time page entrypoints/business tools. For a tool available before any View opens, use [page tools](page-tools.md) or [server business tools](business-tools.md). Worker action registries are independent of the live App and still require the external `ink-worker` executable for MCPKit's native Worker adapter.

## Register and revoke a dynamic tool

Run this inside an active App/Page business method and keep the controller for later revocation:

```javascript
const registration = new AbortController();
await getApp().modelContext.registerTool({
  name: 'calculate_total',
  description: 'Calculate the total for a quantity at 20 per item',
  inputSchema: {
    type: 'object', properties: { quantity: { type: 'integer', minimum: 1 } },
    required: ['quantity'], additionalProperties: false,
  },
  execute(input, { signal }) {
    signal.throwIfAborted();
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new TypeError('quantity must be a positive integer');
    }
    return { total: input.quantity * 20 };
  },
}, { signal: registration.signal });
// Later, when this tool should no longer be offered:
registration.abort();
```

The host receives list-change notifications. A registration belongs to the App even if created by a Page; explicitly revoke it when appropriate. The registration signal controls availability, while the callback signal cancels one invocation. The live tool's `inputSchema` describes input; validate business arguments in the callback. Generated server page/business tools separately retain MCPKit's schema validation.

## Call host tools and resources

Inside an active App/Page method, use the actual tool names and resource URIs supplied by your host:

```javascript
const agent = getApp().getAgent();
const result = await agent.callTool('check_stock', { sku: 'DEMO' });
if (result.isError) console.error(result.content);
else console.log(result.structuredContent ?? result.content);
const page = await agent.listResources();
const contents = await agent.readResource('demo:stock');
```

Tool business failures resolve with `isError`; transport/permission failures reject. Only the declared UI metadata crosses the provider boundary, and resource content can contain text or binary blobs. Remote tool-list proxying and remote list-change events are not advertised. Ink's `conversation.sendCard()` / `updateCard` need a dedicated host renderer and are unavailable in this adapter.

Real WASM browser tests cover button-to-message delivery, context updates, App/Page actions, dynamic registration/revocation, list-change events, cancellation, host refusal and resources. A target client's actual model routing and consumption of published context need separate interactive verification.

---

[Documentation index](../README.md) · [Protocol compatibility](../reference/compatibility.md)
