# 创建自己的应用

[English](first-agent.md) | 简体中文 · [学习路线](../README.zh-CN.md)

**这一课的结果：** 用两个源文件创建一个独立的计数器。先完成[第一次修改](edit-example.zh-CN.md)；这一课只需要会创建文件、保存文字。

AIUI 把应用称为 **Agent（智能体）**，这里指你维护的应用源码，不要求你训练或实现 AI 模型。所有终端命令都在 MCPKit 仓库根目录执行。

## 1. 创建目录

按 **Ctrl+C** 停止之前的监听。在编辑器里，在仓库根目录创建：

```text
my-agent/
├── app.json
└── pages/
    └── home.ink
```

只需要这两个源文件，扩展名要与上面一致。

## 2. 注册页面

将以下完整内容保存为 `my-agent/app.json`：

```json
{
  "name": "My First App",
  "pages": ["pages/home"]
}
```

`name` 是应用显示名称，`pages` 列出页面路径。`pages/home` 对应 `pages/home.ink`，这里省略扩展名。

## 3. 编写页面

将以下完整内容保存为 `my-agent/pages/home.ink`：

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

可以分成三部分理解：

- `data` 保存状态，`{{count}}` 显示当前值。
- `bindtap="increment"` 在点击时调用 `increment()`，其中的 `setData()` 更新状态并重绘界面。
- `<style>` 让组件居中，并设置页面颜色。

## 4. 构建并预览

在仓库根目录运行：

```sh
node scripts/build-plugin.mjs ./my-agent --name my-agent --out ./dist/my-agent --watch
```

[快速开始](quickstart.zh-CN.md)已经构建过 MCPKit 库；如果跳过了那一步，请先执行 `npm run build`。打开终端 `preview` 行提供的地址。

**预期结果：** 显示“My first app”、数字 **0** 和 **+ ADD ONE**。点击一次，数字变成 **1**。再修改页面标题并保存，等待预览刷新。刷新后计数重置，因为它属于这份打开的应用实例。

## 5. 了解生成了什么

源码仍在 `my-agent/`，构建产物在 `dist/my-agent/`：

| 文件 | 用途 |
| --- | --- |
| `view.html` | 应用界面，包含你的应用与 Ink/WASM。 |
| `dist/server.mjs` | 客户端可以启动的本地 MCP 服务。 |
| `plugin.json`、`mcp.json`、`.agents/` | 插件名称及客户端连接、安装所需的元数据。 |

此时还没有把插件安装进客户端，浏览器预览已经可以用于开发界面。重新构建会替换产物，请修改源码文件。

**完成检查：** 自己的应用能打开、按钮能工作、保存源码后能看到变化。

**下一步：** [为应用添加工具参数](../guides/page-tools.zh-CN.md)。想先在助手中体验？按[连接自己的应用](../guides/clients.zh-CN.md#连接自己的应用)操作；尚未声明页面 schema 时，默认工具名为 `open_app`。
