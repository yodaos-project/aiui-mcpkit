# Create your own app

English | [简体中文](first-agent.zh-CN.md) · [Learning path](../README.md)

**You will build:** an independent Counter with two source files. First complete [your first edit](edit-example.md). Knowing how to create a file and save text is enough for this lesson.

AIUI calls an app an **Agent**. Here it means the source files you own; you do not need to build an AI model. Run all terminal commands from the MCPKit repository root.

## 1. Create the folders

Stop the previous watcher with **Ctrl+C**. In your editor, create this structure inside the repository root:

```text
my-agent/
├── app.json
└── pages/
    └── home.ink
```

Only these two source files are needed. Keep the file extensions exactly as shown.

## 2. Register the page

Save this complete file as `my-agent/app.json`:

```json
{
  "name": "My First App",
  "pages": ["pages/home"]
}
```

`name` is the app's display name. `pages` lists its page routes; `pages/home` refers to `pages/home.ink`, with the extension omitted.

## 3. Add the page

Save this complete file as `my-agent/pages/home.ink`:

```html
<script setup>
export default {
  data: { count: 0 },
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

Read it in three pieces:

- `data` holds state; `{{count}}` displays the current value.
- `bindtap="increment"` calls `increment()` on a click. `setData()` updates the state and redraws the UI.
- `<style>` centers the components and gives the page its colors.

## 4. Build and preview your app

From the repository root:

```sh
node scripts/build-plugin.mjs ./my-agent --name my-agent --out ./dist/my-agent --watch
```

The [quickstart](quickstart.md) already built the MCPKit library. If you skipped it, run `npm run build` first. Open the URL from the terminal's `preview` line.

**Expected:** “My first app”, a count of **0**, and **+ ADD ONE**. Click once: the count becomes **1**. Edit the title, save, and wait for the preview to reload. The count resets on reload; it belongs to this open app instance.

## 5. Know what the build produced

Your source stays in `my-agent/`. Generated output goes to `dist/my-agent/`:

| File | What it is for |
| --- | --- |
| `view.html` | The UI, including your app and Ink/WASM. |
| `dist/server.mjs` | The local MCP server a client can start. |
| `plugin.json`, `mcp.json`, `.agents/` | Plugin identity and client connection/install metadata. |

You have not installed this plugin into a client yet. The browser preview is sufficient to develop its UI. Generated output is replaced on rebuild; edit your source files instead.

**Checkpoint:** your own app runs, its button works, and a source edit appears after saving.

**Next:** [Give your app tool arguments](../guides/page-tools.md). Prefer to try it in an assistant now? [Connect a client](../guides/clients.md#connect-your-own-app); without page schemas its default tool is `open_app`.
