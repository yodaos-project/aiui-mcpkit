# 体验示例

[English](quickstart.md) | 简体中文 · [文档目录](../README.zh-CN.md)

**目标：** 打开真实 Ink 界面，验证按钮和参数。先完成[环境准备](installation.zh-CN.md)。以下终端命令都在 MCPKit 仓库根目录执行。`open_counter({...})` 等示例表示让客户端调用工具，不是终端命令。

先运行一个现成的例子，再决定要写什么。这份教程会构建 Counter 计数器，并安装到 **Codex 桌面版**。

## 1. 准备工具

安装 [Node.js](https://nodejs.org/en/download) **22 或更新版本**（自带 npm）、[Git](https://git-scm.com/downloads)、Codex 桌面版，以及支持 `codex plugin` 命令的 Codex CLI。下面的命令都在终端中执行。

使用 Claude Desktop 或 VS Code？完成第 2 步后，直接跳到[对应客户端的接入说明](../guides/clients.zh-CN.md)。

## 2. 下载并构建

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
npm ci
npm run build:examples
```

完成后，Counter 和业务插件分别位于 `dist/examples/counter` 与 `dist/examples/business`，共享的 marketplace 位于 `dist/examples/.agents/plugins/marketplace.json`。下一步继续在当前仓库目录中执行。

## 3. 安装到 Codex

```sh
codex plugin marketplace add ./dist/examples
codex plugin add ink-counter@aiui-mcpkit-examples
codex plugin add business-demo@aiui-mcpkit-examples
```

第一条命令注册共享的本地插件目录，后两条分别安装 Counter 和业务示例。请按示例复制插件标识，它们需要与生成的元数据一致。

首次安装后重启 Codex 桌面版，从插件的界面入口打开 **AIUI MCPKit Counter**。在已提供本地工具的 Codex 对话中，也可以让它调用 `open_counter`。

## 4. 试着操作

Counter 采用 AIUI 单绿设计。点击 **+ ADD ONE**，计数就会变化。在支持全屏的宿主中展开界面，还可以看到会话统计、最近操作记录和更多控制按钮。

示例还提供了两个通过页面配置定义的工具。可以让客户端调用：

```text
open_counter({ "initialCount": 5, "label": "Demo" })
open_countdown({ "start": 8, "step": 2 })
```

`open_counter` 打开 Counter 页面，初始值为 5，标题为 “Demo”；点击 **+ ADD ONE** 后变成 6。两个参数均可选，省略 `initialCount` 时恢复已保存的计数。`open_countdown` 打开独立的 Countdown 页面，初始值为 8，每次点击减 2，最低为 0。`start` 必填，`step` 在页面逻辑中默认为 1。缺失 `start`、负数初始计数或非正数步长会被 MCP 服务端拒绝。

两个工具均在各自页面的 `<script def>` 中声明，通过 `onLoad(query)` 接收参数。浏览器测试使用真实 Ink WASM 验证页面选择、初始状态和按钮交互。如果之前从 `ink-counter-local` 安装 Counter，请按上面的命令注册共享 marketplace 并重新安装。后续使用 `update:examples` 同步已安装的两个插件及其服务端，再重载宿主刷新工具列表。

[Counter 源码](../../examples/counter/pages/counter/index.ink) 展示状态管理和自适应布局；[Countdown 源码](../../examples/counter/pages/countdown/index.ink) 展示带必填参数的第二个工具。Counter 的内联界面已经在 Codex 桌面版中观察到，全屏行为和页面工具示例通过浏览器测试环境验证。

## 再试业务示例

让客户端以以下 JSON 参数调用 `quote_order`：

```json
{ "quantity": 2, "coupon": "DEMO10" }
```

预期结构化结果：数量 2、单价 18、总价 36、币种 CNY。不传优惠码时，总价为 40。页面还会从仅供界面使用的数据中显示剩余库存 98。点击 **CALCULATE** 再发起一次真实 handler 调用，在加载中点击 **CANCEL** 取消。此操作需要宿主提供 `serverTools` 能力和工具访问权限。

用 `{ "sku": "DEMO" }` 调用 `check_stock`，打开库存页面并得到可用库存 100。其他 SKU 返回 `UNKNOWN_SKU`，其他优惠码返回 `INVALID_COUPON`，无需外部服务即可观察错误路径。

## 完成检查

- 插件已安装，而且工具出现在当前客户端会话中。
- Counter 从 5 开始，点击一次变成 6。
- Countdown 从 8 开始，点击一次变成 6。
- 报价使用 `DEMO10` 时为 36，不使用时为 40。

安装成功和工具已进入当前会话是两件事。当前会话找不到工具时，重载服务或宿主，并检查实际工具列表，见[故障排查](../guides/troubleshooting.zh-CN.md)。下一步可以[创建自己的 Agent](first-agent.zh-CN.md)，或学习[业务工具](../guides/business-tools.zh-CN.md)。

---

[文档目录](../README.zh-CN.md) · 上一篇：[准备环境](installation.zh-CN.md) · 下一篇：[创建第一个 Agent](first-agent.zh-CN.md)
