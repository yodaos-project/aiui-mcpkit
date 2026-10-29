# 修改第一个按钮

[English](edit-example.md) | 简体中文 · [学习路线](../README.zh-CN.md)

**开始前：** 先完成[浏览器快速开始](quickstart.zh-CN.md)，保持 `npm run watch:examples -- counter` 和预览页面运行。这一课先只改已有代码中的一行。

## 1. 打开源码

用编辑器打开 [`examples/counter/pages/counter/index.ink`](../../examples/counter/pages/counter/index.ink)。一个 `.ink` 页面主要包含三种内容：

| 区域 | 控制什么 |
| --- | --- |
| `<script setup>` | JavaScript 状态与事件处理函数。 |
| `<page>` | 显示出来的文字、按钮等组件。 |
| `<style>` | 颜色、间距和布局。 |

Counter 还有一个 JSON `script def` 区域，用来声明工具参数。现在先保持不动，后面的[页面工具](../guides/page-tools.zh-CN.md)会解释。

## 2. 修改按钮文案

在 `<page>` 中找到：

```html
<button class="control add" bindtap="increment">+ ADD ONE</button>
```

**只替换这一行**，改成：

```html
<button class="control add" bindtap="increment">+ MY FIRST CLICK</button>
```

保存文件。监听程序会重新构建并刷新预览，你应该看到新的按钮文字。如果写错语法，终端会报错，预览保留上一次成功的版本；修正源码并再次保存即可。

## 3. 确认交互仍然有效

点击 **+ MY FIRST CLICK**，数字仍然加一。

`bindtap="increment"` 把点击连接到 `<script setup>` 中的 `increment()` 方法；方法调用 `setData()` 更新计数。按钮标签中间的文字只改变文案，不会改变行为。

每次成功刷新都会创建新的应用实例，所以计数会重置。这是本地开发时的预期行为。

## 4. 再改一点行为

找到 `increment()`，将其中这一行：

```js
this.updateCount(this.data.count + 1, 'ADD ONE', 1);
```

改为：

```js
this.updateCount(this.data.count + 2, 'ADD TWO', 2);
```

保存，等待刷新，点击一次。计数应该从 **0 变成 2**。数值和操作记录都在描述同一次动作，因此需要一起修改。

**完成检查：** 你已经改变了界面文案和按钮行为。可以保留实验，也可以在编辑器中撤销这些改动，再使用原示例的测试。

**下一步：** [创建自己的应用](first-agent.zh-CN.md)，从一个能完整读懂的小文件开始。
