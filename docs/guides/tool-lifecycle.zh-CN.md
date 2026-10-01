# 工具请求生命周期

[English](tool-lifecycle.md) | 简体中文 · [文档目录](../README.zh-CN.md)

**目标：** 展示加载与进度、处理错误并停止未完成任务。先读[业务工具](business-tools.zh-CN.md)和[消息格式](../reference/messages.zh-CN.md)。下方页面方法是接入片段；完整可运行实现见[业务页面](../../examples/business/pages/order/index.ink)。

界面应在发起前记录 ID，`pending` 期间禁用冲突操作，仅更新匹配该 ID 的进度，并在所有终态清除加载。使用每个界面递增的序号生成 ID，例如 `quote-${++this.sequence}`，不要反复使用固定名称。调用外部操作前，先确认宿主当前实际可调用的工具及 `serverTools` 能力。

Agent 页面可以通过 Ink 消息调用 MCP Apps 宿主暴露的工具。这需要宿主提供 `serverTools` 能力和工具访问权限；MCPKit 本身不会注册外部业务工具。每次调用的 `requestId` 必须在视图生命周期内唯一：

```js
// 在 Ink 页面内调用：
this.postMessage({
  type: 'mcpkit:call-tool', requestId: 'weather-1',
  name: 'get_weather', arguments: { city: 'Hangzhou' },
});
// 取消该请求：
this.postMessage({ type: 'mcpkit:cancel-tool', requestId: 'weather-1' });

// 在页面定义中添加：
onMessage(event) {
  const request = event.data;
  if (request.type !== 'mcpkit:tool-state') return;
  // 按 ID 分别保存状态；pending 显示加载，其他状态结束加载。
  this.setData({ weatherRequest: request });
}
```

响应包含 `type: 'mcpkit:tool-state'`、`requestId`、`state`、从 1 开始的 `attempt` 和实际生效的 `policy`。`pending` 可携带 `progress`；`ready` 携带 MCP 工具的 `result`；`error` 和 `cancelled` 在 `error` 中提供 `{ code, message }`。超时代码为 `request_timeout` 和 `total_timeout`，业务及传输失败为 `tool_error`。工具名或参数无效时返回 `invalid_request`，不会执行调用；缺失或空 ID 会被忽略。重复使用 ID 也会被忽略，包括已完成的请求，避免延迟消息启动或覆盖其他调用。并发时应按 ID 保存各自状态。宿主取消、页面替换和视图关闭会取消所有未完成调用；指定 ID 的取消只影响该请求。

通过 ESM API 配置生成的服务端与视图的超时预算：

```js
await buildPlugin({
  source: './weather-agent', name: 'weather-agent',
  requestPolicy: {
    totalTimeoutMs: 60000, requestTimeoutMs: 15000,
    resetTimeoutOnProgress: true, maxRetries: 1, retryDelayMs: 250,
  },
  retrySafeTools: ['get_weather'],
});
```

| 配置 | 默认值 | 规则 |
| --- | --- | --- |
| `totalTimeoutMs` | `60000` | 从请求开始计算，覆盖所有尝试与重试等待；进度永不重置总预算。 |
| `requestTimeoutMs` | `60000` | 每次尝试开始时计时的单次预算。 |
| `resetTimeoutOnProgress` | `false` | 启用后，当前尝试的进度只重置单次预算。 |
| `maxRetries` | `0` | 额外尝试次数；只有操作明确安全且错误符合条件时才生效。 |
| `retryDelayMs` | `0` | 每次重试前的等待；取消和总超时仍然生效。 |

超时必须为正整数毫秒，次数和等待必须为非负整数，均不得超过 `2147483647`。取消或任意一种超时会立即退出 pending，并中止当前尝试的 `AbortSignal`，即使未完成工作忽略信号也不会继续加载。信号通过 `callServerTool` 转为 MCP 取消通知，服务端处理器接收 SDK 的取消信号。取消无法撤销已提交的业务操作。迟到的结果、错误和进度会被忽略；重试使用新信号并保留请求 ID。Agent 桥只会为构建时列入 `retrySafeTools` 的工具重试单次请求超时；工具错误、宿主取消和总超时均不重试。Agent 消息不能启用重试。生成的页面打开工具永不重试。

包导出 `RequestLifecycle`、`RequestLifecycleError`、`AgentToolBridge`、`resolveRequestPolicy` 及对应 TypeScript 类型，可用于后续服务端处理器或开发工具。使用同一个生命周期包裹未完成工作：

```js
const requests = new RequestLifecycle({ requestTimeoutMs: 15000 });
const handle = requests.start(async ({ signal, progress }) => {
  progress({ stage: 'fetching' });
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}, { signal: callerSignal });
const result = await handle.result; // 失败、取消或超时会 reject
```

该 API 必须同时提供 `retrySafe: true`、`shouldRetry(error)` 判断函数和正数 `maxRetries` 才能重试。状态观察回调抛出异常不会改变请求结算。通过 `buildPlugin().requestPolicy`、生成工具的 tools/list `_meta.requestPolicy` 或 `requests.policy` 检查默认及构建配置；通过 `requests.inspect()` 检查活跃请求，通过 `handle.snapshot()` 检查终态。生成的工具响应通过 `_meta.request` 返回请求 ID、终态和实际策略；安全条件禁用重试时，单个请求快照的 `maxRetries` 为 0。确定性测试覆盖超时与竞态，真实 Ink WASM 浏览器测试覆盖 Agent 消息、进度、重试、取消传播和迟到响应隔离。

## 运行时 API 速查

集成到其他工具时可以使用底层 API。普通页面开发通常直接使用 `postMessage`。

| API | 行为 |
| --- | --- |
| `new RequestLifecycle(policy?)` | 管理活跃请求，解析并冻结默认策略。 |
| `start(operation, options?)` | 返回 `RequestHandle`；operation 接收 `requestId`、`attempt`、`signal` 和 `progress(value)`。 |
| `options.requestId`、`options.signal`、`options.policy` | 指定唯一活跃 ID、外部取消信号和单次请求策略。 |
| `options.retrySafe`、`options.shouldRetry`、`options.onChange` | 显式重试安全标记、重试判断和快照观察回调。 |
| `handle.result` | 操作结果 Promise，失败、取消或超时时拒绝。 |
| `handle.snapshot()` | 当前或终态 `RequestSnapshot`，包含解析后的有效策略。 |
| `handle.cancel(reason?)` | 取消该 handle。 |
| `requests.inspect()` | 仅返回当前活跃请求；检查终态时保留 handle。 |
| `requests.cancel(id, reason?)` | 取消活跃请求，ID 不存在时返回 false。 |
| `requests.cancelAll(reason?)` | 取消全部活跃请求。 |
| `new AgentToolBridge({ policy?, retrySafeTools?, callTool, send })` | 把页面消息连接到宿主调用实现和生命周期消息接收函数。 |
| `bridge.receive(message)` | 处理调用或取消消息，返回是否识别该消息。 |
| `bridge.cancelAll(reason?)`、`bridge.lifecycle` | 取消未完成任务或检查其生命周期。 |

页面 bridge 禁止在整个界面生命周期中复用 ID；单独使用 `RequestLifecycle` 则拒绝空 ID 或当前活跃的 ID。导出类型包括 `RequestPolicy`、`RequestState`、`RequestSnapshot`、`RequestContext`、`RequestOptions`、`RequestHandle`、`AgentToolRequest` 和 `ToolBridgeOptions`。

---

[文档目录](../README.zh-CN.md) · 上一篇：[带类型的业务工具](business-tools.zh-CN.md) · 下一篇：[公开元数据](metadata.zh-CN.md)
