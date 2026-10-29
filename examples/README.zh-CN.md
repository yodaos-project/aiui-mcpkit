# 选择一个示例开始体验

[English](README.md) | 简体中文 · [学习路线](../docs/README.zh-CN.md)

从想做的界面开始。先执行 `npm ci`，以下命令均在仓库根目录运行。第一次使用时，可以先按 [Counter 快速开始](../docs/getting-started/quickstart.zh-CN.md)操作。

## 1. 在浏览器中预览一个示例

```sh
npm run watch:examples -- travel
```

打开终端 `preview` 行中的地址，切换示例前先按 Ctrl+C 停止。可以把 `travel` 替换为：

| ID | 可以操作什么 | 源码 |
| --- | --- | --- |
| `counter` | 点击改变计数，是最小的入门起点。 | [Counter](counter) |
| `travel` | 切换日期、收藏地点；与助手分享放到客户端阶段体验。 | [旅行规划](travel) |
| `focus` | 开始、暂停、重置计时。 | [专注计时](focus) |
| `analytics` | 切换周/月，观察指标和图表同步变化。 | [数据洞察](analytics) |
| `events` | 选择场次与人数，核对演示预约。 | [活动预约](events) |

这五个示例不需要原生 Worker 或外部服务。旅行、数据、预约使用固定演示数据；预约流程不会真实付款、订位或发送邮件。计时器隐藏时暂停，View 关闭时销毁。不同的新 View 有独立状态。

普通浏览器预览不能发送对话消息或执行服务端业务调用，体验这些能力时再做[客户端接入](../docs/guides/clients.zh-CN.md)。[使用 Worker 的业务示例](../docs/guides/business-tools.zh-CN.md)还包含报价、库存、选择与共享目录，建议完成基础界面路线后再体验。

## 2. 在助手中体验示例

构建可安装插件，再按[连接指南](../docs/guides/clients.zh-CN.md)接入自己的客户端：

```sh
npm run build:examples
```

Codex 先注册一次共享目录，再按需安装：

```sh
codex plugin marketplace add ./dist/examples
codex plugin add ink-counter@aiui-mcpkit-examples
codex plugin add travel-planner@aiui-mcpkit-examples
codex plugin add focus-studio@aiui-mcpkit-examples
codex plugin add analytics-lab@aiui-mcpkit-examples
codex plugin add event-booking@aiui-mcpkit-examples
```

Business Demo 额外需要配置 Worker 宿主，插件名为 `business-demo@aiui-mcpkit-examples`。安装后重载客户端，并检查当前会话的工具列表。每个插件有自己的生成服务。

`npm run start:examples -- travel` 启动的是提供给 MCP 客户端的 stdio 服务，不会输出预览地址。需要修改已安装副本时，按[开发迭代](../docs/guides/development.zh-CN.md)操作。

## 3. 查询工具与输入字段

<details>
<summary>插件 ID、工具输入与实时 View Action</summary>

| ID / 插件 | 打开工具与参数 | 设计与交互 | View 内实时 Action |
| --- | --- | --- | --- |
| `counter` / `ink-counter` | `open_counter`、`open_countdown` | 绿色终端风格；计数、活动记录和显示模式。 | — |
| `business` / `business-demo` | `quote_order`、`check_stock`、`find_products` 与共享目录工具 | 业务结果、取消、选中上下文与共享 App 导航，需要 Ink Worker 宿主。 | `catalog_state` 与目录操作 |
| `travel` / `travel-planner` | `open_trip`，可选 `day: 1 \| 2` | 蓝色编辑风格行程；切换日期、收藏地点并主动分享。 | `trip_state` |
| `focus` / `focus-studio` | `open_focus`，可选 `minutes: 1–60`、不超过 50 字符的 `task` | 珊瑚色计时器；开始、暂停、重置与销毁清理。 | `focus_state` |
| `analytics` / `analytics-lab` | `open_analytics`，可选 `period: "week" \| "month"` | 紫色看板；周期筛选同步更新指标与柱状图。 | `analytics_state` |
| `events` / `event-booking` | `open_workshop`，可选 `seats: 1–4` | 暖白陶艺海报；场次、人数边界、金额、核对与确认。 | `workshop_state` |

打开工具由页面 `script def` 生成；新增的实时状态 Action 使用 `ModelContext.defineAction()`，只返回明确的只读状态投影，在 View 打开且宿主支持时可用。它们不是额外的服务端工具，View 销毁后即不可调用。

四个新插件都不需要外部服务或原生 Worker。旅行使用策划好的演示行程，分析使用确定性的样例指标，预约确认只修改本地演示状态，不会真实订位、付款或发送邮件。专注计时器在 View 打开期间运行，隐藏时暂停，关闭时清理。新建 View 不恢复此前状态。

旅行示例只在点击 **ASK ASSISTANT +** 后发布明确选中的地点，等待上下文确认后再发送用户消息，并在销毁时释放上下文。宿主不支持对话或上下文时，页面展示不可用状态。浏览器测试验证了宿主接收；模型是否实际使用上下文取决于宿主。

</details>

## 4. 截图与验证

手动跑通界面后再使用这些步骤，需要 Playwright/Chromium；普通监听预览不需要。

```sh
npx playwright install chromium
node --test tests/showcase-browser.test.mjs
npm run capture:examples
```

采集命令需要先构建示例。它通过实时 Action 验证状态变化，采集真实 Ink canvas 的 800×500/DPR 3 画面以及内嵌、窄屏布局，将操作坐标与状态写入已忽略的 `test-results/showcase-captures/layout.json`。README 截图位于 `docs/assets/examples/`，交互过程的中间截图保留在 `test-results/showcase-captures/`。可通过 `CHROMIUM_PATH` 指定现有 Chromium。

**下一步：** [修改按钮](../docs/getting-started/edit-example.zh-CN.md)，或[创建自己的应用](../docs/getting-started/first-agent.zh-CN.md)。
