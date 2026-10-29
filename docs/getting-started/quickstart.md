# Run your first preview

English | [简体中文](quickstart.zh-CN.md) · [Learning path](../README.md)

**You will build:** a local Counter that responds to a button click. You need Node.js 22+, Git and a browser. No assistant client or API key is needed for this lesson. If the version checks below fail, follow [environment setup](installation.md).

## 1. Download and install

Open a terminal and run:

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
npm ci
```

If you already completed environment setup, keep that terminal in the repository root and skip to step 2.

## 2. Open the preview

From the repository root:

```sh
npm run watch:examples -- counter
```

Wait for a terminal line with `"type":"preview"`. Copy its `url` value into your browser. It starts with `http://127.0.0.1:`; the port is assigned automatically. Keep the terminal running while you use the preview.

The command builds the library and Counter, then watches its source files. You should see a green Counter interface with a count of **0**. Ink may display numeric values as `0.0`; it is the same count.

## 3. Click a button

Click **+ ADD ONE** once. The count becomes **1**. Click it again and it becomes **2**.

**Checkpoint:** the preview URL opens, Counter is visible, and a click changes its count. You have run a real AIUI app using Ink/WASM.

To stop the preview, return to its terminal and press **Ctrl+C**. Start it again with the same command; a fresh preview starts from zero.

## Understand what you just ran

- **Source:** `examples/counter/` contains the editable app.
- **Build output:** `dist/watch/counter/` contains generated files. Edit the source, not this directory.
- **Preview:** the local page supplies the host connection needed to run the app. Opening generated `view.html` directly will not initialize it.

The preview supplies tool arguments and shows UI. It does not run an AI model, deliver conversation messages or execute server business tools. You will connect a real client in a later lesson.

## If it does not work

| What you see | First thing to try |
| --- | --- |
| `node` or `npm` is missing | Follow [environment setup](installation.md). |
| npm cannot find `package.json` | Open the terminal in the `aiui-mcpkit` repository root. |
| The browser cannot connect | Keep the command running and copy the URL from its latest `preview` line. |
| A blank page or build error | Read the terminal error, then use [troubleshooting](../guides/troubleshooting.md). |

**Next:** [Change your first button](edit-example.md). Want a colorful example first? Stop Counter and use `npm run watch:examples -- travel`; see the [example collection](../../examples/README.md) for the other IDs.
