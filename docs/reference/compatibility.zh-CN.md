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

运行 `npm run build:examples`、`npm run typecheck` 和 `npm test` 执行兼容性套件，包括 `tests/protocol.test.mjs`。CI 在每个拉取请求中执行这些检查。这是上述能力的验收覆盖，不代表完整 MCP 规范认证。MCPKit 不提供 HTTP 传输、授权、多轮输入、订阅和缓存策略；工具/资源列表为静态。桌面宿主的全屏和工具访问行为仍需在对应宿主中验证。

---

[文档目录](../README.zh-CN.md) · 上一篇：[页面消息](messages.zh-CN.md) · 下一篇：[性能基准](benchmarks.zh-CN.md)
