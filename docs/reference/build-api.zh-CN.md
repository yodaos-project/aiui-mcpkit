# 构建参考

[English](build-api.md) | 简体中文 · [文档目录](../README.zh-CN.md)

`@yodaos-pkg/aiui-mcpkit` 导出 `buildPlugin(options): Promise<BuildPluginResult>`。本篇作为 [ESM 教程](../guides/esm-build.zh-CN.md)的查阅参考，实际类型定义见 [`src/index.ts`](../../src/index.ts)。

## 路径与命名规则

所有相对路径从调用方当前工作目录解析，不是从构建脚本所在位置解析。`source` 必须包含 `app.json`。产物可以在源码内部，例如 `source/dist/plugin`，但不能等于源码目录或包含源码目录。页面路径使用相对路径、不写 `.ink`，不能包含目录穿越片段。写入产物前先验证输入 schema；打包 handler 时不会执行它。

## 生成的文件

```text
plugin/
├── plugin.json                       # Plugin name and display metadata
├── mcp.json                          # Plugin-host stdio configuration
├── view.html                         # Agent interface and embedded runtime
├── tools.d.ts                        # Generated tool and handler types
├── dist/server.mjs                   # Bundled MCP server
└── .agents/plugins/marketplace.json  # Local Codex installation catalog
```

服务提供打开工具，以及 MIME 类型为 `text/html;profile=mcp-app` 的 `ui://` HTML 资源。宿主把资源加载到应用视图中，并将显示模式变化传递给 Agent。生成的 `mcp.json` 中，`${PLUGIN_ROOT}` 由插件宿主解析；手动配置其他客户端时需要使用真实路径。

## API 与辅助脚本参数

| ESM 参数 | 本地脚本参数 | 默认值 |
| --- | --- | --- |
| `source` | `[source]` | API 必填；脚本默认为当前目录 |
| `name` | `--name` | 必填 |
| `outputDir` | `--out` | `dist/<name>` |
| `title` | `--title` | `app.json` 名称，其次为插件名称 |
| `description` | `--description` | 根据显示名称生成 |
| `tool` | `--tool` | 页面均未声明 schema 时回退为 `open_app` |
| `page` | `--page` | `app.json` 中的第一个页面，不带 `.ink` |
| `version` | `--version` | `0.1.0` |
| `requestPolicy` | 仅 ESM | [生命周期默认值](../guides/tool-lifecycle.zh-CN.md) |
| `retrySafeTools` | 仅 ESM | `[]` |
| `handlers` | 仅 ESM | 业务工具默认使用 `<source>/mcp-server/handlers.ts` |
| `typesFile` | 仅 ESM | `<outputDir>/tools.d.ts` |
| `toolMetadata` | 仅 ESM | `{}` |
| `resourceMetadata` | 仅 ESM | `{}` |
| `uiResources` | 仅 ESM | `[]` |

插件名称以小写字母开头，仅包含小写字母、数字或连字符。工具名称由 1–128 个字母、数字、下划线或连字符组成。运行 `node scripts/build-plugin.mjs --help` 查看脚本用法。如果省略 `[source]`，默认使用当前项目根目录；输出目录会从 UI 内容中排除。

## 当前支持范围

UI 宿主需要允许编译 WebAssembly。嵌入的 HTML 约为 10 MB，也需要留意宿主的资源大小限制。源码按 UTF-8 读取，目前不支持打包二进制资源。

自动测试覆盖打包、MCP 工具与资源响应，以及浏览器运行时。它们不能证明所有桌面宿主都完整兼容，也不能保证账号连接后的工具访问权限或资源缓存行为。

## 元数据选项类型

| 选项 | 类型 | 用途 |
| --- | --- | --- |
| `toolMetadata` | `Record<string, PublicMetadata>` | 按发现的工具名配置作者 `_meta`；未知工具名会被拒绝。 |
| `resourceMetadata` | `PublicMetadata` | 所有生成和自定义界面资源的作者 `_meta` 默认值。 |
| `uiResources` | `UiResource[]` | 额外 HTML 资源，每项包含 `uri`、`name`、`html`，可选 `description` 和 `_meta`。 |

`PublicMetadata` 接受普通 JSON 值。合并、保留字段、URI 验证和按客户端能力检查的规则见[公开元数据](../guides/metadata.zh-CN.md)。仓库辅助脚本没有这些选项的命令行参数。

## BuildPluginResult

| 成员 | 含义 |
| --- | --- |
| `name`、`title`、`version` | 最终插件标识和展示信息。 |
| `tool` | 第一个注册工具的名称，不一定是 `open_app`。 |
| `page` | 选定的初始页面路径，各页面工具仍保留各自路径。 |
| `tools` | 工具与页面映射，包含 `name`、`title`、`description`、`page`、`inputSchema`、最终 `resourceUri` 和业务工具可选 `outputSchema`。 |
| `outputDir` | 生成的插件目录绝对路径。 |
| `marketplaceName` | 独立目录索引名 `${name}-local`；仓库示例使用另外的共享目录索引。 |
| `requestPolicy` | 解析后的完整请求策略。 |
| `inspectProtocol(capabilities?)` | 最终工具列表项、资源列表项和连接配置的全新 JSON 快照，默认不带 Apps 能力。 |
| `files.view` | `view.html` 的绝对路径。 |
| `files.server` | `dist/server.mjs` 的绝对路径。 |
| `files.plugin`、`files.mcp` | 插件清单与客户端配置的绝对路径。 |
| `files.marketplace` | `.agents/plugins/marketplace.json` 的绝对路径。 |
| `files.types` | 生成类型声明的绝对路径，也适用于自定义 `typesFile`。 |

Promise 成功表示构建完成，不代表服务已注册、宿主已发现工具或界面已渲染。错误通过 Promise rejection 返回，API 不记录日志、不退出进程、不改变工作目录。检查或修改返回快照不会改变生成的服务。

## 公开运行时导出

| 导出 | 用途 | 指南 |
| --- | --- | --- |
| `DEFAULT_REQUEST_POLICY`、`RequestPolicy`、`RequestState`、`RequestSnapshot`、`RequestContext`、`RequestOptions`、`RequestHandle` | 生命周期默认值和 context/handle 类型。 | [请求生命周期](../guides/tool-lifecycle.zh-CN.md) |
| `BusinessToolDefinition`、`BusinessToolResult`、`BusinessToolHandler`、`businessToolExecutor`、`businessToolFailure` | 业务契约类型，以及生成服务使用的验证和错误适配器。页面作者通常使用生成的 `BusinessHandlers`。 | [业务工具](../guides/business-tools.zh-CN.md) |
| `AgentToolRequest`、`ToolBridgeOptions` | 页面请求与 bridge 配置类型。 | [请求生命周期](../guides/tool-lifecycle.zh-CN.md) |
| `BusinessToolError` | 带明确公开 code/message 和可选 UI-only 详情的预期业务失败，支持根包或 `/tools` 导入。 | [业务工具](../guides/business-tools.zh-CN.md) |
| `RequestLifecycle`、`RequestLifecycleError`、`resolveRequestPolicy` | 为异步任务添加超时、取消和重试策略。 | [请求生命周期](../guides/tool-lifecycle.zh-CN.md) |
| `AgentToolBridge` | 使用相同生命周期把页面请求关联到宿主工具调用。 | [请求生命周期](../guides/tool-lifecycle.zh-CN.md) |
| `BuildPluginOptions`、`BuildPluginResult`、`PageTool` | 构建输入、结果和工具映射。 | 本篇参考 |
| `JsonValue`、`PublicMetadata`、`UiResource`、`MetadataOptions`、`ProtocolInspection` | 元数据、资源和检查配置的类型。 | [公开元数据](../guides/metadata.zh-CN.md) |

完整 handler/context 和生命周期接口见 [`business-tools.ts`](../../src/runtime/business-tools.ts)、[`lifecycle.ts`](../../src/runtime/lifecycle.ts) 和 [`tool-bridge.ts`](../../src/runtime/tool-bridge.ts)。构建包时会生成对应 `.d.ts`。

## 打包边界

`mcp-server/`、`dist/`、`.mcpkit/`、`.git/`、`node_modules/`、`.env`/`.env.*`、实际输出目录以及 handler 的传递依赖都不作为界面资源打包。其他 UTF-8 源码资源属于公开内容。服务端代码保留在服务端 bundle 中，这不代表会自动扫描任意公开字符串中的凭据。

生成插件可在 Node 22+ 下直接执行。`view.html` 内含压缩 WASM，客户端需要允许编译并接受资源大小。添加功能时修改源码或构建配置，不要手工修改生成的服务和 HTML。

---

[文档目录](../README.zh-CN.md) · 上一篇：[故障排查](../guides/troubleshooting.zh-CN.md) · 下一篇：[页面消息](messages.zh-CN.md)
