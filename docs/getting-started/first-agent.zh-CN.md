# 创建自己的 Agent

[English](first-agent.md) | 简体中文 · [文档目录](../README.zh-CN.md)

**前置条件：** 完成[快速开始](quickstart.zh-CN.md)，保持仓库依赖已安装。本教程创建独立的 `my-agent` 源码目录，构建命令仍在 MCPKit 仓库根目录执行。先用静态页面确认流程，再替换为下方的交互页面。

## 1. 创建两个源码文件

在方便的位置创建 `my-agent/` 和其中的 `pages/` 目录，把以下内容分别保存为 `app.json` 和 `pages/home.ink`。构建和安装命令中的 `/path/to/my-agent` 是占位路径，请替换为真实绝对路径；含空格时加引号。

示例跑通后，就可以换成自己的页面。最小项目结构如下：

```text
my-agent/
├── app.json
└── pages/
    └── home.ink
```

`app.json` 定义应用名称和页面列表：

```json
{
  "name": "My Agent",
  "pages": ["pages/home"]
}
```

`pages/home.ink` 定义第一个界面：

```html
<page>
  <view>
    <text>Hello from AIUI Agent</text>
  </view>
</page>
```

`app.json` 中的页面路径不带 `.ink` 后缀。需要按钮和状态管理时，可以参考完整的 [Counter 页面](../../examples/counter/pages/counter/index.ink)。

在 MCPKit 仓库中运行本地构建脚本。把 `/path/to/my-agent` 换成自己项目的实际路径：

```sh
npm run build
node scripts/build-plugin.mjs /path/to/my-agent \
  --name my-agent \
  --out /path/to/my-agent/dist/plugin
```

项目根目录直接包含 `app.json` 和 `pages/`；输出可以放在项目的 `dist/` 下，构建器会排除输出目录。输出目录不能等于或包含源码目录。这个脚本用于在仓库内调试；包对外提供的集成入口是 [ESM 库](../guides/esm-build.zh-CN.md)。

将自己的插件安装到 Codex：

```sh
codex plugin marketplace add /path/to/my-agent/dist/plugin
codex plugin add my-agent@my-agent-local
```

安装后重新加载桌面宿主。自己的 Agent 默认通过 `open_app` 工具打开。其他客户端可以[直接连接生成的服务](../guides/clients.zh-CN.md)。

## 2. 确认静态页面能打开

按上面的命令构建、安装后，重载宿主，让它用 `{}` 调用 `open_app`。支持 Apps 的宿主应显示 “Hello from AIUI Agent”；纯文字客户端会返回解释，不会显示页面。

不要直接在浏览器打开 `view.html`。生成的界面依赖 MCP Apps 宿主提供初始化消息通道和工具数据。

## 3. 加入状态和按钮

将 `pages/home.ink` 的**全部内容**替换为：

```html
<script setup>
export default {
  data: { count: 0 },
  increment() { this.setData({ count: this.data.count + 1 }); },
};
</script>

<page>
  <view class="screen">
    <text class="title">My first Agent</text>
    <text class="count">{{count}}</text>
    <button class="control" bindtap="increment">+ ADD ONE</button>
  </view>
</page>

<style>
.screen { width: 100%; min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 16px; background-color: #000000; color: #40ff5e; }
.title { font-size: 20px; }
.count { font-size: 40px; }
.control { padding: 8px 16px; background-color: #000000; color: #40ff5e; border-width: 1px; border-style: solid; border-color: #40ff5e; }
</style>
```

`data` 保存页面状态，`{{count}}` 读取该状态，`bindtap="increment"` 在点击时调用 `increment` 方法，`setData` 更新状态并重绘。这个按钮只修改本地界面状态，不调用业务 handler。

## 4. 重新构建并确认新版本

再次执行前面的 `node scripts/build-plugin.mjs ...` 命令。直接注册服务的客户端需要重载服务并打开新界面。通过 Codex 安装的插件需要使用客户端的插件更新或重新安装流程，把新目录同步到缓存，再重载宿主、打开新卡片。仓库的 `update:examples` 只更新自带示例，不更新 `my-agent`。

预期页面从 0 开始，点击 **+ ADD ONE** 后变成 1。Ink 默认的数字插值可能显示为 `0.0` 和 `1.0`，数值含义相同。这个例子没有持久化逻辑，新建页面会重新从 0 开始。

## 5. 接下来学什么

- 想让 AI 传入参数：按[页面工具](../guides/page-tools.zh-CN.md)增加输入 schema。
- 想在服务端计算或获取数据：按[业务工具](../guides/business-tools.zh-CN.md)增加输出 schema 和 handler。
- 想在自己的项目中构建：使用 [ESM 库](../guides/esm-build.zh-CN.md)。
- 想理解产物和选项：查看[构建 API](../reference/build-api.zh-CN.md)。

---

[文档目录](../README.zh-CN.md) · 上一篇：[运行示例](quickstart.zh-CN.md) · 下一篇：[页面工具](../guides/page-tools.zh-CN.md)
