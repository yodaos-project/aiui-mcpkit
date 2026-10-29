# Give your app tool arguments

English | [简体中文](page-tools.zh-CN.md) · [Learning path](../README.md)

**You will add:** `open_my_counter`, a tool that accepts a starting count. Complete [your own app](../getting-started/first-agent.md) first and keep `my-agent/app.json` unchanged. Commands run from the repository root.

A tool is a named operation an assistant can call. Its **input schema** describes which JSON arguments it accepts. MCPKit reads the declaration in your page and generates registration and validation.

## 1. Replace the page

Stop its watcher with Ctrl+C. Replace the **entire** `my-agent/pages/home.ink` file with:

```html
<script type="application/json" def>
{
  "tool": "open_my_counter",
  "navigationBarTitleText": "My counter",
  "description": "Open my counter at the requested starting value.",
  "schema": {
    "data": {
      "type": "object",
      "properties": {
        "initialCount": { "type": "integer", "minimum": 0, "maximum": 100 }
      },
      "required": ["initialCount"],
      "additionalProperties": false
    }
  }
}
</script>

<script setup>
export default {
  data: { count: 0 },
  onLoad(query) {
    this.setData({ count: Number(query.initialCount) });
  },
  increment() {
    this.setData({ count: this.data.count + 1 });
  },
};
</script>

<page>
  <view class="screen">
    <text class="title">My first app</text>
    <text class="count">{{count}}</text>
    <button class="control" bindtap="increment">+ ADD ONE</button>
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
.title {
  font-size: 20px;
}
.count {
  font-size: 40px;
}
.control {
  padding: 8px 16px;
  background-color: #000000;
  color: #40ff5e;
  border-width: 1px;
  border-style: solid;
  border-color: #40ff5e;
}
</style>
```

Only two things are new: a JSON `script def` declaration and `onLoad(query)`.

## 2. Preview with a starting value

Run from the repository root:

```sh
node scripts/build-plugin.mjs ./my-agent --name my-agent --out ./dist/my-agent --watch --input '{"initialCount":5}'
```

Open the printed preview URL. The count starts at **5**; one click makes it **6**. `--input` supplies launch arguments for the local preview; it does not ask an AI to call the tool.

## 3. Read the declaration

| Field | Meaning |
| --- | --- |
| `tool` | The name a client discovers: `open_my_counter`. |
| `description` | Explains when an assistant should use the tool. |
| `schema.data` | JSON Schema for the arguments. |
| `type: "integer"`, `minimum`, `maximum` | Accept only whole numbers from 0 to 100. |
| `required` | The call must include `initialCount`. |
| `additionalProperties: false` | Reject undeclared arguments. |

The real server validates arguments before success. Ink exposes scalar launch values as strings, so `Number(query.initialCount)` converts the declared number before storing it in page state. Objects and arrays arrive as JSON strings; parse those according to their schemas.

## 4. Verify through a client

After [connecting your own app](clients.md#connect-your-own-app), ask the assistant to call `open_my_counter` with `{ "initialCount": 5 }`. These are **tool inputs**, not terminal commands:

| Input | Expected server behavior |
| --- | --- |
| `{ "initialCount": 5 }` | Open at 5. |
| `{}` | Reject: required argument is missing. |
| `{ "initialCount": "5" }` | Reject: a string is not an integer. |
| `{ "initialCount": -1 }` | Reject: below the minimum. |

**Checkpoint:** the preview starts at 5. Once connected, the client discovers `open_my_counter`, accepts valid input and rejects invalid input.

## When you add more pages

Only registered pages declaring `schema.data` become public tools. Adding the declaration replaces the fallback `open_app`; it has not been lost accidentally. Other registered pages remain available for internal navigation.

If no page has a schema, MCPKit supplies `open_app`. Without an explicit `tool` on a schema-defined page, the name is `open_` plus its full route, with unsupported characters replaced by `_`. Choose explicit names and keep them unique. `navigationBarTitleText` sets the title. See [build API](../reference/build-api.md) for route and naming rules.

**Next:** [Connect an AI client](clients.md), then [return a business result](first-business-tool.md).
