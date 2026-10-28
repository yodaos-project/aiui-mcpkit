# 示例集

[English](README.md) · [项目 README](../README.zh-CN.md)

在仓库根目录运行 `npm ci && npm run build:examples`。每个目录构建为一个独立插件，统一放在 `dist/examples/` marketplace。`npm run start:examples -- <id>` 启动单个 stdio 服务，默认选择 Counter。

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

## 采集与验证

```sh
npx playwright install chromium
node --test tests/showcase-browser.test.mjs
npm run capture:examples
```

采集命令需要先构建示例。它通过实时 Action 验证状态变化，采集真实 Ink canvas 的 800×500/DPR 3 画面以及内嵌、窄屏布局，将操作坐标与状态写入已忽略的 `test-results/showcase-captures/layout.json`。README 截图位于 `docs/assets/examples/`，交互过程的中间截图保留在 `test-results/showcase-captures/`。可通过 `CHROMIUM_PATH` 指定现有 Chromium。
