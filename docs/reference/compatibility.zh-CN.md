# 协议兼容性

[English](compatibility.md) | 简体中文 · [文档目录](../README.zh-CN.md)

目标已发布 MCP 规范为 **2026-07-28**。运行时依赖固定为 `@modelcontextprotocol/server`、`client`、`core` **2.2.0**，以及 `@modelcontextprotocol/ext-apps` **2.0.3**。界面契约采用已发布的 [MCP Apps 2026-01-26 规范](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)；**View** 是包含 AIUI 运行时的 Apps iframe。不声明草案契约支持。

| 能力 | 支持范围与验证方式 |
| --- | --- |
| 当前 MCP 的 stdio 通道 | `serveStdio` 支持 `2026-07-28`：`server/discover`、逐请求协议与能力元数据、工具发现/调用、资源列表/读取。测试固定该版本，避免降级掩盖失败。 |
| 旧版 MCP 的 stdio 通道 | 同一服务接受 `initialize` 和 `notifications/initialized`。测试覆盖 `2024-11-05`、`2025-03-26`、`2025-06-18`、`2025-11-25`；原有 SDK **1.31.0** 客户端也继续运行回归测试。 |
| Apps/View 能力协商 | 客户端需声明 `extensions["io.modelcontextprotocol/ui"].mimeTypes` 包含 `text/html;profile=mcp-app`。旧版读取初始化能力；当前协议逐请求读取能力。 |
| 工具元数据与结果 | Apps 客户端获得 `_meta.ui.resourceUri`、兼容别名 `_meta["ui/resourceUri"]` 及原有 OpenAI 入口。保留原始输入/输出 JSON Schema、模型可见内容/结构化数据和 UI-only 元数据；各协议时期的线格式转换由官方 SDK 处理。 |
| 无 Apps 能力的客户端 | 工具发现省略 UI 入口元数据。页面打开工具返回参数和明确的纯文本说明；业务 handler 仍执行并返回数据，同时提示界面不可用。发现和已执行结果通过 `_meta.mcpkit.ui` 标明 `available` 或 `unavailable`。仍允许显式读取 UI 资源。 |
| View/宿主通道 | 保留 Apps `ui/initialize` 握手、工具输入/结果/取消通知及宿主上下文变更。View 声明内联/全屏；真实 Ink WASM 浏览器测试覆盖宿主模式限制、业务渲染、调用和取消。 |
| 进度与取消 | 协议测试覆盖两个协议时期的进度通知与客户端取消；现有回归验证 handler 中止、超时和迟到结果隔离。 |
| Ink 运行时 | 依赖与 lockfile 固定已发布的 SDK `0.20.0-daily.20261027171530`。生成的 View 通过 `setAgentProvider()` 安装带类型的 provider，不再需要本地链接 SDK。 |
| 用户消息与上下文 | 宿主声明文本消息能力时，`getApp().getAgent().conversation.sendMessage()` 发送用户文本；支持结构化上下文时，`provideContext()` 及其 update/dispose 句柄发布具名条目。宿主拒绝会抛错；确认接收不代表后续模型轮次已消费数据。 |
| 实时 App/Page 工具 | `ModelContext.defineAction()` 和 `App.modelContext.registerTool()` 通过 View 的 `tools/list`、`tools/call` 暴露当前实例回调，支持列表变化通知和单次取消。宿主需将 View 工具纳入模型路由。Page Action 随可见性和生命周期启停；动态注册属于 App，显式撤销或 App 关闭时移除。 |
| 远端工具与资源 | 协商后，Agent 会话可调用宿主 server tools、列出和读取 server resources；覆盖进度、业务失败结果、文本及二进制资源。当前不声明远端工具列表代理和远端列表变化事件。 |
| 对话卡片 | Ink 提供 API，但当前 MCP Apps 适配器不声明发送/更新卡片能力，需要专用宿主渲染器。 |

运行 `npm run build:examples`、`npm run typecheck` 和 `npm test` 执行兼容性套件，包括 `tests/protocol.test.mjs` 和必跑的真实 WASM 宿主服务测试。CI 在每个拉取请求中执行这些检查。这是上述能力的验收覆盖，不代表完整 MCP 规范认证。MCPKit 不提供 HTTP 传输、授权、多轮输入、订阅和缓存策略；生成的服务端工具/资源列表为静态，实时 View 工具列表可动态变化。原生 Worker 集成另需 `INK_WORKER_BIN`。桌面宿主的全屏、View 工具路由和真实模型消费上下文仍需在对应宿主中验证。用法见 [Agent 会话与实时工具](../guides/agent-session.zh-CN.md)。

---

[文档目录](../README.zh-CN.md) · 上一篇：[页面消息](messages.zh-CN.md) · 下一篇：[性能基准](benchmarks.zh-CN.md)
