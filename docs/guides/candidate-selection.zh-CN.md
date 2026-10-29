# 候选选择与模型上下文

[English](candidate-selection.md) | 简体中文 · [学习路线](../README.zh-CN.md)

**适用场景：** 助手返回候选项，用户需要决定把哪个选择带入下一轮对话。

**开始前：** 先看[业务工具配置](business-tools.zh-CN.md)与 [Agent 会话](agent-session.zh-CN.md)。本篇使用 Worker 业务示例；只想练习界面时，可以先看[示例集合](../../examples/README.zh-CN.md)。

[Business Demo](../../examples/business/app.json) 提供了完整的候选选择页。`find_products` 返回经过校验的候选商品，用户选择后点击 **ASK ABOUT SELECTION**，显式发布选择并发送用户消息。本例使用演示商品目录，不会购买商品，也不执行持久化业务写入。

## 运行示例

在仓库根目录构建并更新已安装的 Business Demo：

```sh
npm run build:examples
node scripts/update-examples.mjs --example business
```

首次安装见[快速开始](../getting-started/quickstart.zh-CN.md)。更新后重载 MCP 服务或桌面宿主，重新打开 View，并确认当前聊天除了 `quote_order`、`check_stock`，也能发现 `find_products`。更新文件本身不能证明已有聊天已发现新工具。

让客户端调用：

```text
find_products({ "query": "travel" })
```

工具返回 Travel mug（`TRAVEL-MUG`，CNY 89）和 Travel bag（`TRAVEL-BAG`，CNY 249）。空查询返回全部三种商品；没有匹配项时返回空数组。在界面中选择候选项，点击 **ASK ABOUT SELECTION**。页面等待上下文发布确认后才发送消息；不支持能力或宿主拒绝时，页面显示错误。发布失败不会发送消息。

## 数据边界

| 数据 | 去向 |
| --- | --- |
| 候选列表 | 工具的 `structuredContent.candidates`，模型和 UI 均可读取 |
| 当前选择 | 点击询问按钮后才进入 `structuredContent.contexts.product_selection.value` |
| 供应商信息 | 工具的 `_meta.uiOnly`，仅供 UI 使用 |
| 私有备注及 Page 状态 | 保留在 UI，不进入发布字段投影 |
| 持久化业务数据 | 本例不执行写入 |

发布值仅包含 `sku`、`name`、`unitPrice`、`currency`、`selectionId`。页面在点击询问按钮时生成选择编号，原始候选结果和用户消息正文都不包含该编号。更换选择后再次询问，会更新同一个命名上下文并生成新编号。关闭或卸载页面会释放上下文。

用户消息要求模型介绍所选商品，并给出 SKU、价格和选择编号，但不直接携带这些值。因此，下一轮模型回复中的正确编号可以作为模型收到新上下文的证据；前提是验收时没有通过日志、截图、工具或粘贴提示词等其他渠道把编号告诉模型。

源码：[页面](../../examples/business/pages/selection/index.ink)、[Worker Action](../../examples/business/workers/business.js)。业务工具由 manifest 中的 `business` AgentWorker 通过 `ModelContext.defineAction()` 执行。服务进程需在 PATH 中找到 `ink-worker`，或设置 `INK_WORKER_BIN`；详见[业务工具](business-tools.zh-CN.md)。上下文 API 见 [Agent 会话](agent-session.zh-CN.md)。

## 分层验收

1. **协议层：** `tests/examples.test.mjs` 检查真实 stdio 服务的工具发现、候选结果、输入校验、页面路由及 UI-only 供应商字段。
2. **浏览器层：** `tests/selection-browser.test.mjs` 使用真实服务结果、Ink WASM 和 MCP Apps bridge，点击两种候选项，检查精确发布字段、确认后发送消息、上下文更新与释放。该测试不运行模型。
3. **目标客户端及模型：** 在实际桌面客户端中执行下面的验收流程；协议和浏览器测试不能替代它。

构建后运行本地检查：

```sh
npm run typecheck
INK_WORKER_BIN=/absolute/path/to/ink-worker node --test tests/examples.test.mjs tests/selection-browser.test.mjs
```

桌面验收需记录日期、客户端及版本、SDK、工具参数、选择项、实际投递的上下文和下一轮模型回复。先选 Travel bag 并询问，模型应答出 `TRAVEL-BAG`、CNY 249 和本次新编号。再选 Travel mug，模型应答出 `TRAVEL-MUG`、CNY 89 和另一个新编号。不要通过其他渠道提供编号。私有备注和供应商字段是否被排除，需要单独检查宿主的模型输入或上下文记录，不能只看模型有没有在回答中提到它们。

人工点击和自动化工具点击应分别记录。宿主确认、界面截图和 View 工具发现，分别只能证明其对应环节；真实模型回复需要独立证据。[Issue #3](https://github.com/yodaos-project/aiui-mcpkit/issues/3) 应在目标客户端及模型验收留档后关闭。

---

[学习路线](../README.zh-CN.md) · [验收记录](../validation/candidate-selection-2026-10-28.md)

**按需继续：** [让多个工具共用 App](shared-agent.zh-CN.md)。
