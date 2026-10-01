# Define tools per page

English | [简体中文](page-tools.zh-CN.md) · [Documentation index](../README.md)

**Goal:** turn an AI request into a page with validated arguments. Complete [your first Agent](../getting-started/first-agent.md) first. The weather example below is a complete replacement `.ink` file, not a real weather API: it displays the city supplied by the client.

## Step-by-step: add a parameterized page

1. Create `pages/weather/index.ink` in your Agent source and paste the complete weather page below.
2. Add `"pages/weather/index"` to `app.json.pages`, preserving `"pages/home"` if you still need it for navigation.
3. Rebuild, update any installed copy, and reload your MCP server/host.
4. Verify `show_weather` appears in tool discovery with a required string `city`.
5. Ask the client to call it with `{ "city": "Hangzhou" }`. The page should display `Hangzhou`.

```json
{
  "name": "My Agent",
  "pages": ["pages/home", "pages/weather/index"]
}
```

Once a page declares `schema.data`, discovery lists the schema-defined tools rather than the fallback `open_app`. In this example `pages/home` remains navigable but has no public opener. Give it a schema too if you want both pages exposed as tools.

For routes registered in `app.json.pages`, declare a tool in the `.ink` file's JSON `<script def>`. MCPKit uses `description` as the tool description and `schema.data` as the MCP input schema:

```html
<script type="application/json" def>
{
  "tool": "show_weather",
  "navigationBarTitleText": "Weather",
  "description": "Show weather for the requested city.",
  "schema": {
    "data": {
      "type": "object",
      "properties": { "city": { "type": "string", "description": "City name" } },
      "required": ["city"],
      "additionalProperties": false
    }
  }
}
</script>

<script setup>
export default {
  data: { city: '' },
  onLoad(query) { this.setData({ city: query.city }); }
};
</script>

<page><text>{{city}}</text></page>
```

`tool` is an optional MCPKit field for an explicit tool name. Without it, the name is `open_` plus the full page route, replacing characters other than letters, numbers, underscores, and hyphens with `_`. For example, `pages/weather/index` becomes `open_pages_weather_index`. Names must be unique. Titles use `navigationBarTitleText`, falling back to the page route.

Give another page its own `description`, `schema.data`, and optional `tool` to expose a second tool. Each tool has a separate UI resource bound to its page, so invoking `show_weather` opens the weather page. Only pages declaring `schema.data` become tools; other registered pages remain available for internal navigation. If no page declares a schema, MCPKit keeps the single `open_app` opener (or your `tool` / `--tool` override). With page tools, `tool` / `--tool` does not rename them and `page` / `--page` does not override their routes.

Arguments are validated before the server returns success. The view receives complete tool arguments from the MCP Apps host and passes them as Ink's launch query to `onLoad(query)`. Ink exposes scalar values as strings and objects/arrays as JSON strings: use `Number(query.days)` or `JSON.parse(query.options)` when appropriate. Page views wait for complete input before opening, so required arguments are available on the first load. Unsupported schema dialects, unresolved references, and invalid page definitions fail the build before output is written.

`buildPlugin()` returns mappings in `result.tools`, each with `name`, `title`, `description`, `page`, `inputSchema`, and `resourceUri`. The existing `result.tool` is the first registered tool name.

## Understand validation

| Call | Expected behavior |
| --- | --- |
| `{ "city": "Hangzhou" }` | Opens the weather page with that city. |
| `{}` | Rejected: required `city` is missing. |
| `{ "city": 123 }` | Rejected: input is a number rather than a string. |
| `{ "city": "Hangzhou", "debug": true }` | Rejected because `additionalProperties` is false. |

`required` controls whether a field must exist; its `type` controls accepted values. Declaring `default` in JSON Schema does not replace implementing a default in your page or handler. For optional scalar parameters, check `query.field === undefined` before converting; an empty string and a missing value are different inputs.

Page tools validate input but do not run server business logic. For trusted calculations, credentials or service calls, continue with [business tools](business-tools.md). See [request/result messages](../reference/messages.md) for page event formats.

---

[Documentation index](../README.md) · Previous: [Create your first Agent](../getting-started/first-agent.md) · Next: [Typed business tools](business-tools.md)
