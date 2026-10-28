# 检查请求与 Agent 数据流

[English](inspector.md) | 简体中文 · [文档目录](../README.zh-CN.md)

构建插件时启用开发面板，再在 MCP Apps 宿主中打开 View，点击右下角 **Inspector**。生产构建应移除此选项。

```js
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

await buildPlugin({
  source: './agent', name: 'my-agent',
  inspector: { maxEvents: 500, redactKeys: ['customerId', 'accountNumber'] },
  requestPolicy: { requestTimeoutMs: 15000, totalTimeoutMs: 60000 },
});
```

`inspector: true` 使用默认配置。仓库辅助脚本支持 `node scripts/build-plugin.mjs ./agent --name my-agent --inspector`。默认关闭；`maxEvents` 是 1–5000 的整数，默认 500；`redactKeys` 为内置规则补充不区分大小写的字段名。配置错误会在写入产物前拒绝。自定义 `uiResources` HTML 不会自动注入面板。

## 调用并跟踪请求

宿主声明 `serverTools` 时，下拉列表显示构建时生成的服务端工具；同时显示当前 App/Page 的实时工具。导航或动态注册后点击刷新。查看输入 schema，填写 JSON 对象后点击 **Call tool**。操作会真实执行，可以改变应用或业务状态。

服务端调用与页面调用复用同一个 `AgentToolBridge` 和 `RequestLifecycle`。实时工具在原 App 中执行，宿主、WebMCP 和 Inspector 调用使用同一个生命周期封装。面板不会模拟结果或另建 App。**Cancel request** 只中止选定的待完成请求，其他请求继续。每个请求的 `tool.state` 或 `view-tool.state` 包含实际生效的超时、进度重置和重试配置。实时工具不自动重试；服务端调用只有超时且处于构建时 `retrySafeTools` 名单才重试，规则与[请求生命周期](tool-lifecycle.zh-CN.md)一致。取消不能撤销已提交的操作。

通过 **Request ID** 精确过滤。例如 `quote-1` 的链路包含 `tool.input`、等待/进度/终态 `tool.state` 和 `agent.delivery`。浏览器和服务端标识不同，因此 `tool.server-link` 单独保留实际服务端请求 ID。宿主传入结果含 `_meta.request.requestId` 时，`agent.tool-result` 使用该服务端 ID。MCP Apps 的输入、部分输入和取消通知不带调用 ID，明确显示为 **uncorrelated**。Inspector 不根据时间猜测因果，也不会复用无关请求 ID。

直接通过 `getApp().getAgent()` 发起的操作使用 `host:[session,realm,id]` 标识；记录展示真实适配器超时（120 秒）、无适配器重试，以及 Ink 的取消信号。上下文写入串行执行：取消可阻止尚未发送的写入，已发送的写入仍等待确认，保持顺序。面板区分适配器设置与可配置的页面/实时工具生命周期，不把适配器超时当作 Ink 内部超时。

## 关联应用事件与数据绑定

运行时记录 canvas 交互类型，不收集输入文字、按键或私有页面状态。应用可以发送可选诊断消息，把用户操作和已应用的绑定关联到相同请求 ID：

```js
// 页面方法中，在真正的 mcpkit:call-tool 消息之前：
this.postMessage({
  type: 'mcpkit:inspect', kind: 'user-event', name: 'calculate',
  requestId: this.requestId,
});

// 应用该请求结果并调用 setData() 后：
this.postMessage({
  type: 'mcpkit:inspect', kind: 'binding', name: 'total',
  requestId: result.requestId, visibility: 'public', value: this.data.total,
});
```

[订单示例](../../examples/business/pages/order/index.ink)实现了这个流程。绑定消息只记录应用选定的投影，不拦截每次 `setData()`，也不读取整个 App/Page。没有 `visibility: 'public'` 时，即便开发模式也会省略值；此标记只控制诊断采集，不会发布模型上下文。对已知的跨请求关系，可发送 `kind: 'link'`、`requestId` 与 `relatedRequestId` 显式关联，框架不会推断。`AgentInspectionMessage` 导出此消息类型；关闭 Inspector 时忽略这些消息。

## 检查模型上下文与隐私边界

**Model context and privacy boundary** 中的 `model-context.sent` 在真正调用 `app.updateModelContext()` 时记录，已经经过排队和版本检查，展示脱敏后的实际载荷。被新版本覆盖的待发送快照记录为 `model-context.skipped`，不会被当成已发送。上下文替换、显式清空和 realm 释放走同一观察路径。`model-context.acknowledged` 仅表示宿主确认接收；`modelConsumptionVerified: false` 明确说明它不能证明后续模型使用了上下文。拒绝或失败记为 `model-context.failed`。

只有应用显式选择的上下文投影会发送。Inspector 不扫描 App/Page 私有状态、不采集 UI-only 值、不插入诊断上下文，也不把轨迹发布给模型。工具结果中的 `_meta`、`uiOnly` 和 `uiMetadata` 在进入缓存前脱敏。诊断消息的 `visibility` 不改变模型可见边界。真实上下文发布和模型验收要求见 [Agent 会话](agent-session.zh-CN.md)。

## 导出与启动诊断

**Export redacted JSON** 下载本地 `mcpkit-inspector/1` 格式轨迹，包含所有保留事件，不受当前过滤条件影响；**Clear trace** 清空已保留事件。不会自动上传、写入浏览器存储或发布给宿主。事件有数量上限，进入缓存前生成快照；过长值、过深结构会截断。

内置规则过滤凭据类字段、私有/UI 元数据、Bearer/Basic 凭据、URL 用户信息和查询参数值，以及常见凭据赋值；工具文本中的 JSON 也会递归处理。使用 `redactKeys` 补充业务敏感字段。脱敏是启发式规则，无法识别无标记文本中的任意秘密；分享前仍应检查公开文本与导出内容。脱敏只影响诊断，不修改真实参数、结果或模型上下文。

面板和浏览器监听器在宿主握手及 WASM 加载前初始化：

| 事件 | 处理方向 |
| --- | --- |
| `diagnostic.host` | 检查 Apps 初始化及宿主能力。 |
| `diagnostic.bundle`、`diagnostic.agent` | 检查打包清单、页面路径及运行时版本。 |
| `diagnostic.wasm` | 检查 WASM 编译权限、gzip 支持及 Ink 版本。 |
| `diagnostic.browser`、`diagnostic.promise` | 检查失败的浏览器操作和请求轨迹。 |
| `diagnostic.csp` | 对比被拦截的指令/URI、宿主 CSP 和 `uiCsp`。 |
| `diagnostic.resource` | 检查失败的浏览器资源 URL、响应、CORS 和资源域名。 |

宿主完全禁止脚本时，Inspector 也无法运行。Ink guest 或宿主内部没有暴露的错误需要其日志或显式诊断消息，浏览器不能自动读取。HTML 本身未加载时使用宿主/浏览器开发者工具。自动测试使用真实 Ink WASM View、真实 stdio 业务服务以及浏览器 CSP/资源失败，不代表所有桌面宿主均已验证。运行 `npm run build:examples` 后，再运行 `node --test tests/inspector.test.mjs tests/host-provider.test.mjs tests/inspector-browser.test.mjs` 可复现。
