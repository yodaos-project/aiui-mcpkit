# 运行时集成与 Agent Worker

[English](runtime-integration.md) | 简体中文 · [学习路线](../README.zh-CN.md)

**适用场景：** 要部署 Worker 宿主，或实现与 Ink 运行时的集成。

**开始前：** 普通服务端函数从[第一个业务工具](first-business-tool.zh-CN.md)开始；可选 Worker 方式先看[业务工具配置](business-tools.zh-CN.md)。本篇是实现与部署契约。

本篇介绍 [Agent 会话示例](agent-session.zh-CN.md)背后的运行时契约、无界面业务执行和部署要求。

## Agent 会话与实时工具

MCPKit 固定使用已发布的 Ink SDK `0.20.0-daily.20261027171530`。生成的 View 通过 `setAgentProvider()` 将 `getApp().getAgent()` 连接到 MCP Apps，提供上下文发布、显式用户消息、工具调用和资源列表/读取。原有消息式页面继续工作。

能力来自已完成的宿主握手，不支持的操作会拒绝。当前适配器支持文本内容，发布上下文前检查结构化内容能力，仅传递约定的 UI 元数据，并将 `isError` 工具结果保留为业务结果。

`getApp().modelContext` 是独立的 App 级 WebMCP draft 工具接口。通过全局 `ModelContext.defineAction()` 标记 App/Page 默认导出的方法，或使用 `registerTool()` 动态注册。使用 `getTools()` 发现工具，向 `executeTool()` 传入发现的工具对象，返回值为 JSON 文本。

`ModelContext` 是 Ink 提供的全局接口对象，无须 import 或 App 实例；不存在独立的全局 `defineAction`。Action 显式声明工具名，可以与方法名不同，返回值仍是普通可调用方法，模型调用时的 `this` 绑定所属实例。Page Action 随显示、隐藏和卸载启停；Worker 默认导出的方法使用相同的声明方式，但注册表独立。App 方法可使用 `this.modelContext`，Worker 仅获得受限的 App 句柄，不执行 `app.js`。

Agent 会话提供 `provideContext`、`conversation.sendMessage`、`callTool`、`listResources` 和 `readResource`。上下文条目按 key 和句柄独立管理，更新汇总到 `structuredContent.contexts`，不自动发布 App/Page 状态。Provider 重绑定会关闭旧会话，公开环境独立位于不可变的 `App.environment`。

实时 App 工具通过 MCP Apps View 的工具列表/调用接口映射到原 App 回调，宿主需支持 View 工具并将其纳入 LLM 路由。该路径与无界面 Worker 独立。Provider 复用 Ink SDK 中按 operation 区分的请求类型，分支可直接收窄 payload。

上下文确认接收不代表后续模型轮次已经消费。MCP Apps 通知没有 invocation ID，本地 revision 仅表示顺序，不能证明重叠调用之间的关联。当前不声明远端 server-tool 列表代理和列表变化通知；实时 App 注册表的变化另行通知。

## 通过 Worker 执行业务工具

Manifest 声明的 Agent Worker 可以替代手写的 `mcp-server/handlers.ts`，作为生成业务工具的执行入口：

```javascript
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

await buildPlugin({
  source: '/absolute/path/to/agent',
  name: 'worker-business',
  outputDir: '/absolute/path/to/output',
  worker: { name: 'business' },
});
```

`worker.name` 必须对应 `app.json.agentWorkers` 中的条目。页面原有的 `tool` 名称先匹配 Worker 中 `getApp().modelContext` 注册的工具，再匹配 Worker 默认导出对象 `operations` 的自有函数。输入/输出 schema 继续由注册的 `.ink` 页面提供，并由生成的 MCP 服务校验；`worker` 和 `handlers` 互斥。

## 部署原生执行宿主

生成的服务将应用打包到 `worker-app/`，通过 JSON Lines 启动真实 Ink `ink-worker` 可执行文件。部署时将它放入 PATH，或通过 `INK_WORKER_BIN` 指定路径。在 Ink 仓库中构建：

```sh
cargo build -p ink-script --bin ink-worker
```

`INK_WORKER_CONFIGURATION` 可指定私有的运行时 JSON 配置文件，配置仅通过操作上下文中不可变的 `configuration` 提供，不会嵌入 View HTML。

仓库的 [Business Demo](../../examples/business/workers/business.js) 全部通过 `ModelContext.defineAction()` 实现工具，无需单独的 Handler 模块。生成的 `worker-app/` 需要随服务一同部署。

## Worker 执行契约

在 manifest 声明的 Worker 中，通过 `ModelContext.defineAction({ name: '<工具名>', execute })` 方法或自有 `operations['<工具名>']` 函数实现每个页面业务工具。名称必须对应注册页面的 `tool`，schema 校验和响应封装由生成的 MCP 适配器负责。完整代码见 [Worker 示例](business-tools.zh-CN.md#实现-action)。

具名操作接收 `(input, { requestId, signal, reportProgress, configuration })`，显式返回可异步完成的 JSON 结果。页面业务工具返回 `{ content, structuredContent, uiMetadata? }`，适配器校验输出，并将 `uiMetadata` 转为 `_meta.uiOnly`。进度通过 `reportProgress({ value, total?, message? })` 上报。

注册的 `ModelContext.defineAction()` 回调接收执行 `signal`，不提供仅属于 operation 的 `configuration` 和 `reportProgress`。显式业务失败可返回 `{ isError: true, businessError: { code, message }, uiMetadata? }`，由 MCPKit 转换为标准业务错误；未预期的异常保持私有。Worker 源码也会进入 View 资源，不应在源码中嵌入私有配置。

Worker 在真实 Ink 模块加载器和执行环境中运行，支持定时器和 Promise，不创建 Page 或渲染器。当前路径不提供 Node API、`process.env` 和 `fetch`；需要 Node 依赖或网络访问的业务逻辑使用 [Node Handler](business-tools.zh-CN.md#node-handler-与校验时机)。Worker 私有配置通过 operation 上下文中不可变的 `configuration` 读取。

同一执行会话的调用共享 Worker 状态，关闭时释放；它与 UI `open` 触发的 Worker generation 独立。取消按请求处理，并依赖业务实现协作。

Ink 仓库的 `fixtures/agents/host-business` 提供报价/库存示例。Page 使用 `getApp().getAgent().callTool()`，生成的服务调用与模型触发时相同的 Worker 操作。选择商品仅发布 `selectedSku`，发送对话消息是单独的显式操作。

## 验证

分别验证 Provider、真实 Ink/WASM 浏览器、通过 `ink-worker` 的生成 MCP 服务，以及真实客户端/模型交互。原生 Worker 集成测试需要：

```sh
INK_WORKER_BIN=/absolute/path/to/ink-worker npm test
```

浏览器测试宿主确认接收，不代表生产模型消费了上下文；后者需要独立记录。

运行 `npm ci` 即可安装已发布的 Web 运行时，不再需要本地构建或链接 Ink Web SDK。宿主服务浏览器测试为必跑项；Business Demo 调用和原生 Worker 测试需通过 PATH 或 `INK_WORKER_BIN` 找到 `ink-worker`。消息、上下文、声明式 Action 和动态注册示例见 [Agent 会话与实时工具](agent-session.zh-CN.md)。依赖固定完整版本号，避免浮动 dist-tag 选中较旧的运行时。

验证基线为 Node.js 22.21.1 和上述固定版本的 SDK，部署要求 Node.js 22+。原生部署另需实现 JSON Lines 调用契约的 Ink `ink-worker` 可执行文件；npm SDK 不会安装它。生成的完整 `worker-app/`、服务、UI 和 manifest 需一起部署。仓库 CI 使用 `INK_WORKER_BIN="$PWD/scripts/ink-worker-wasm.mjs" npm test`，通过公开 SDK 的真实 QuickJS/WASM 宿主执行，无需私有 Ink 源码，也不在 Node 中求值 Worker 模块。原生桌面执行另见[验收记录](../validation/candidate-selection-2026-10-28.md)。两条路径都不向 Worker 代码提供 Node 网络 API。Handler 构建期、启动期和调用期的检查见[业务工具](business-tools.zh-CN.md#node-handler-与校验时机)。

## 对话卡片

运行时的 `agent.conversation.sendCard()` 需要专用宿主渲染器。返回的句柄支持 `update()`，不提供移除接口，保留策略由宿主对话管理。当前 MCP Apps 适配器不声明 `conversation.sendCard` 和 `conversation.updateCard`，也不会将卡片转换为用户消息。

---

[学习路线](../README.zh-CN.md) · [协议兼容性](../reference/compatibility.zh-CN.md)

**按需继续：** [核对协议与客户端边界](../reference/compatibility.zh-CN.md)。
