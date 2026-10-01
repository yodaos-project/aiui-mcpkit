# 页面消息与结果格式

[English](messages.md) | 简体中文 · [文档目录](../README.zh-CN.md)

编写 Ink 页面的 `onLoad`、`onMessage` 和 `postMessage` 时查阅本篇。完整实现见[业务页面](../../examples/business/pages/order/index.ink)。下面是经 Apps 通道传递的 MCPKit 页面消息，不是直接写入服务 stdin 的 JSON-RPC 请求。

## 初始输入与结果

`onLoad(query)` 接收启动参数。标量是字符串，对象和数组是 JSON 字符串，按 schema 转换。例如 `Number(query.quantity)` 转换声明为数值的输入，`JSON.parse(query.options)` 解码声明为对象的输入。

初次业务结果通过 `onMessage(event)` 的 `event.data` 送达：

```js
{
  type: 'mcpkit:tool-result',
  structuredContent: { total: 40 },
  uiOnly: { stockRemaining: 98 },
  isError: false,
  // 按实际情况提供 error 和 request
}
```

失败时处理 `isError` 和 `error`，不要假定一定存在 `structuredContent`。早于 WASM 启动的结果会缓存后再交给页面。`uiOnly` 是客户端可见的展示数据，不是保密存储。

## 从页面发起工具调用

```js
this.postMessage({
  type: 'mcpkit:call-tool',
  requestId: 'quote-1',
  name: 'quote_order',
  arguments: { quantity: 2 },
});
```

宿主需要 `serverTools` 能力和目标工具的访问权限。ID 非空且在界面生命周期内唯一。缺少或复用 ID 时消息被忽略；工具名或参数无效会返回 `invalid_request`，不会发起实际操作。

使用同一 ID 取消：

```js
this.postMessage({ type: 'mcpkit:cancel-tool', requestId: 'quote-1' });
```

## 观察请求状态

`event.data.type === 'mcpkit:tool-state'` 表示生命周期消息。公共字段为 `requestId`、`state`、`attempt` 和 `policy`。

| 状态 | 额外字段 | 界面操作 |
| --- | --- | --- |
| `pending` | 可选 `progress`；正常 attempt 从 1 开始。 | 显示加载，仅更新对应 ID 的进度。 |
| `ready` | `result`，完整 MCP 工具结果。 | 停止加载，读取 `result.structuredContent` 和 `result._meta?.uiOnly`。 |
| `error` | `error: { code, message }`。 | 停止加载，显示失败信息。 |
| `cancelled` | `error: { code, message }`。 | 停止加载，显示取消状态。 |

无效请求的 attempt 为 0。进度达到 total 不等于成功，仍需等待 `ready`。`request_timeout`、`total_timeout`、`tool_error` 和 `invalid_request` 属于生命周期失败代码；`INVALID_OUTPUT` 等业务结果代码属于 `_meta.businessError`，两者不是同一命名空间。

并发请求按 ID 保存状态。宿主取消、界面关闭和页面替换会取消未完成请求；迟到的进度和结果不能让已取消或替换的尝试重新成功。策略和重试配置见[请求生命周期](../guides/tool-lifecycle.zh-CN.md)。

## 模型可见与 UI-only 数据

| Handler 返回字段 | MCP 结果位置 | 接收方 |
| --- | --- | --- |
| `content` | `content` | AI 和客户端；文字总结或支持的内容块。 |
| `structuredContent` | `structuredContent` | AI 和客户端；按输出 schema 验证。 |
| `uiOnly` | `_meta.uiOnly` | 客户端和界面；不进入模型上下文。 |

预期的 `BusinessToolError` 返回 `isError: true`、文字 `CODE: message`、`_meta.businessError`，以及可选 `_meta.uiOnly` 详情，不提供成功用的 `structuredContent`。意外异常仅公开通用 `INTERNAL_ERROR`。Handler 契约见[业务工具](../guides/business-tools.zh-CN.md)。

---

[文档目录](../README.zh-CN.md) · 上一篇：[构建 API](build-api.zh-CN.md) · 下一篇：[协议兼容性](compatibility.zh-CN.md)
