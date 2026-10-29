# Change your first button

English | [简体中文](edit-example.zh-CN.md) · [Learning path](../README.md)

**Before you start:** complete [the browser quickstart](quickstart.md). Keep `npm run watch:examples -- counter` running and its preview open. This lesson changes one line of existing code.

## 1. Open the source file

In your editor, open [`examples/counter/pages/counter/index.ink`](../../examples/counter/pages/counter/index.ink). An `.ink` page contains three kinds of content:

| Section | What it controls |
| --- | --- |
| `<script setup>` | JavaScript state and event handlers. |
| `<page>` | Visible components such as text and buttons. |
| `<style>` | Colors, spacing and layout. |

The Counter also has a JSON `script def` block for its tool inputs. Leave it alone for now; [page tools](../guides/page-tools.md) explains it later.

## 2. Change the button label

Find this line inside `<page>`:

```html
<button class="control add" bindtap="increment">+ ADD ONE</button>
```

Replace **only that line** with:

```html
<button class="control add" bindtap="increment">+ MY FIRST CLICK</button>
```

Save the file. The watcher rebuilds the app and reloads the preview. You should see the new label. If there is a syntax error, the terminal reports it and the previous successful preview stays available; correct the source and save again.

## 3. Check that it still works

Click **+ MY FIRST CLICK**. The count increases by one.

`bindtap="increment"` connects the tap to the `increment()` method in `<script setup>`. That method calls `setData()` to update the count. The text between the button tags changes the label, not its behavior.

A successful reload creates a new app instance, so the count resets. This is expected during local development.

## 4. Try one small behavior change

Find `increment()` and change its call from:

```js
this.updateCount(this.data.count + 1, 'ADD ONE', 1);
```

To:

```js
this.updateCount(this.data.count + 2, 'ADD TWO', 2);
```

Save, wait for the reload and click once. The count should go from **0 to 2**. All three numbers/labels describe the same action; keep them consistent.

**Checkpoint:** you changed what the user sees and what a button does. Keep these edits as an experiment or undo them in your editor before reusing the original example's tests.

**Next:** [Create your own app](first-agent.md), using a small file you can understand from top to bottom.
