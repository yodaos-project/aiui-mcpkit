# AIUI MCPKit

**让你的 AIUI Agent 在 AI 客户端里变成可点击、可操作的应用。**

AI 对话除了返回文字，还可以展示带按钮、实时状态的页面。使用 AIUI MCPKit，你可以把这样的界面放进 AI 客户端，并在用户打开全屏时展示更多内容。

用 [AIUI Agent](https://github.com/yodaos-project/AIUI) 编写界面，再交给 MCPKit 打包。构建产物包含界面、运行时，以及连接兼容客户端所需的 MCP 服务。

[English](README.md) · [体验示例](#体验示例) · [创建自己的 Agent](#创建自己的-agent) · [接入 ESM 库](#接入-esm-库) · [选择客户端](#选择客户端) · [协议兼容性](#协议兼容性) · [参与贡献](#参与贡献)

## 为什么使用 MCPKit？

- **让用户直接操作界面。** 从 Counter 计数器开始，再用同一套打包流程构建自己的 Agent 页面。
- **根据展示空间调整内容。** 内联展示核心信息，全屏展示更多操作或详情。宿主的显示模式对应 Agent 的 `_current` 和 `_blank` 目标。
- **直接接入已有构建工具。** 从 `@yodaos-pkg/aiui-mcpkit` 导入 `buildPlugin()` 即可使用，ESM API 同时提供 TypeScript 类型声明。
- **交付一个完整的插件目录。** Agent 源码、JavaScript 和压缩的 WebAssembly 都已打包。生成的服务需要 Node.js，但无需另外安装 npm 依赖。
- **在兼容客户端复用服务。** 为 Codex 生成插件安装元数据，其他本地 MCP Apps 客户端可以直接连接生成的服务。

第一次接触这些名词？**AIUI Agent** 是你编写的应用；**MCP** 让 AI 客户端连接工具；**MCP Apps** 让这些工具还能提供交互界面；**MCPKit** 负责把它们打包到一起。

## 体验示例

先运行一个现成的例子，再决定要写什么。这份教程会构建 Counter 计数器，并安装到 **Codex 桌面版**。

### 1. 准备工具

安装 [Node.js](https://nodejs.org/en/download) **22 或更新版本**（自带 npm）、[Git](https://git-scm.com/downloads)、Codex 桌面版，以及支持 `codex plugin` 命令的 Codex CLI。下面的命令都在终端中执行。

使用 Claude Desktop 或 VS Code？完成第 2 步后，直接跳到[对应客户端的接入说明](#选择客户端)。

### 2. 下载并构建

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
npm ci
npm run build:examples
```

完成后，Counter 和业务插件分别位于 `dist/examples/counter` 与 `dist/examples/business`，共享的 marketplace 位于 `dist/examples/.agents/plugins/marketplace.json`。下一步继续在当前仓库目录中执行。

### 3. 安装到 Codex

```sh
codex plugin marketplace add ./dist/examples
codex plugin add ink-counter@aiui-mcpkit-examples
codex plugin add business-demo@aiui-mcpkit-examples
```

第一条命令注册共享的本地插件目录，后两条分别安装 Counter 和业务示例。请按示例复制插件标识，它们需要与生成的元数据一致。

首次安装后重启 Codex 桌面版，从插件的界面入口打开 **AIUI MCPKit Counter**。在已提供本地工具的 Codex 对话中，也可以让它调用 `open_counter`。

### 4. 试着操作

Counter 采用 AIUI 单绿设计。点击 **+ ADD ONE**，计数就会变化。在支持全屏的宿主中展开界面，还可以看到会话统计、最近操作记录和更多控制按钮。

示例还提供了两个通过页面配置定义的工具。可以让客户端调用：

```text
open_counter({ "initialCount": 5, "label": "Demo" })
open_countdown({ "start": 8, "step": 2 })
```

`open_counter` 打开 Counter 页面，初始值为 5，标题为 “Demo”；点击 **+ ADD ONE** 后变成 6。两个参数均可选，省略 `initialCount` 时恢复已保存的计数。`open_countdown` 打开独立的 Countdown 页面，初始值为 8，每次点击减 2，最低为 0。`start` 必填，`step` 在页面逻辑中默认为 1。缺失 `start`、负数初始计数或非正数步长会被 MCP 服务端拒绝。

两个工具均在各自页面的 `<script def>` 中声明，通过 `onLoad(query)` 接收参数。浏览器测试使用真实 Ink WASM 验证页面选择、初始状态和按钮交互。如果之前从 `ink-counter-local` 安装 Counter，请按上面的命令注册共享 marketplace 并重新安装。后续使用 `update:examples` 同步已安装的两个插件及其服务端，再重载宿主刷新工具列表。

[Counter 源码](examples/counter/pages/counter/index.ink) 展示状态管理和自适应布局；[Countdown 源码](examples/counter/pages/countdown/index.ink) 展示带必填参数的第二个工具。Counter 的内联界面已经在 Codex 桌面版中观察到，全屏行为和页面工具示例通过浏览器测试环境验证。

## 创建自己的 Agent

示例跑通后，就可以换成自己的页面。最小项目结构如下：

```text
my-agent/
├── app.json
└── pages/
    └── home.ink
```

`app.json` 定义应用名称和页面列表：

```json
{
  "name": "My Agent",
  "pages": ["pages/home"]
}
```

`pages/home.ink` 定义第一个界面：

```html
<page>
  <view>
    <text>Hello from AIUI Agent</text>
  </view>
</page>
```

`app.json` 中的页面路径不带 `.ink` 后缀。需要按钮和状态管理时，可以参考完整的 [Counter 页面](examples/counter/pages/counter/index.ink)。

在 MCPKit 仓库中运行本地构建脚本。把 `/path/to/my-agent` 换成自己项目的实际路径：

```sh
npm run build
node scripts/build-plugin.mjs /path/to/my-agent \
  --name my-agent \
  --out /path/to/my-agent/dist/plugin
```

项目根目录直接包含 `app.json` 和 `pages/`；输出可以放在项目的 `dist/` 下，构建器会排除输出目录。输出目录不能等于或包含源码目录。这个脚本用于在仓库内调试；包对外提供的集成入口是 [ESM 库](#接入-esm-库)。

将自己的插件安装到 Codex：

```sh
codex plugin marketplace add /path/to/my-agent/dist/plugin
codex plugin add my-agent@my-agent-local
```

安装后重新加载桌面宿主。自己的 Agent 默认通过 `open_app` 工具打开。其他客户端可以[直接连接生成的服务](#选择客户端)。

### 为每个页面定义工具

在 `app.json.pages` 注册的页面中，通过 `.ink` 文件的 JSON `<script def>` 声明工具。MCPKit 将 `description` 用作工具描述，将 `schema.data` 用作 MCP 输入参数 schema：

```html
<script type="application/json" def>
{
  "tool": "show_weather",
  "navigationBarTitleText": "天气",
  "description": "展示指定城市的天气。",
  "schema": {
    "data": {
      "type": "object",
      "properties": { "city": { "type": "string", "description": "城市名称" } },
      "required": ["city"],
      "additionalProperties": false
    }
  }
}
</script>

<script setup>
export default {
  data: { city: '' },
  onLoad(query) { this.setData({ city: query.city }); }
};
</script>

<page><text>{{city}}</text></page>
```

`tool` 是 MCPKit 提供的可选字段，用于指定工具名称。不填写时，使用 `open_` 加完整页面路径，并将字母、数字、下划线和连字符之外的字符替换为 `_`。例如，`pages/weather/index` 对应 `open_pages_weather_index`。工具名称必须唯一。标题使用 `navigationBarTitleText`，未填写时使用页面路径。

另一个页面声明自己的 `description`、`schema.data` 和可选的 `tool` 后，就会生成第二个工具。每个工具都有独立的 UI 资源并绑定对应页面，因此调用 `show_weather` 就会打开天气页。只有声明了 `schema.data` 的页面会注册为工具，其余已注册页面仍可供内部导航使用。所有页面均未声明 schema 时，保留单个 `open_app` 入口，也可通过 `tool` / `--tool` 覆盖。启用页面工具后，`tool` / `--tool` 不会重命名这些工具，`page` / `--page` 不会覆盖它们的目标路径。

服务端先校验参数，再返回成功结果。视图接收 MCP Apps 宿主发送的完整工具参数，通过 Ink 的启动 query 传入 `onLoad(query)`。Ink 将标量暴露为字符串，将对象和数组暴露为 JSON 字符串；按需使用 `Number(query.days)` 或 `JSON.parse(query.options)`。页面工具的视图等待完整输入后再打开，确保首次加载就能收到必填参数。不支持的 schema 版本、无法解析的引用和无效的页面定义会在写入输出前令构建失败。

`buildPlugin()` 通过 `result.tools` 返回工具映射，其中包含 `name`、`title`、`description`、`page`、`inputSchema` 和 `resourceUri`。原有的 `result.tool` 返回第一个已注册工具的名称。

### 带类型的业务工具

业务工具直接在 `app.json.pages` 注册的 `.ink` 页面中声明。`script def` 的 `schema.data` 定义输入，`schema.output` 定义业务输出；构建器据此生成 MCP 工具注册信息和 TypeScript 类型，无需另写 `contracts.ts` 或重复维护 schema。没有 `schema.output` 的工具继续使用页面打开行为。

```html
<!-- pages/order/index.ink -->
<script type="application/json" def>
{
  "tool": "quote_order",
  "navigationBarTitleText": "Order quote",
  "description": "Calculate an order quote.",
  "schema": {
    "data": {
      "type": "object", "properties": { "quantity": { "type": "integer", "minimum": 1 } },
      "required": ["quantity"], "additionalProperties": false
    },
    "output": {
      "type": "object", "properties": { "total": { "type": "number" } },
      "required": ["total"], "additionalProperties": false
    }
  }
}
</script>
```

```ts
// mcp-server/handlers.ts
import { BusinessToolError } from '@yodaos-pkg/aiui-mcpkit/tools';
import type { BusinessHandlers } from '../.mcpkit/tools.js';

export const handlers: BusinessHandlers = {
  async quote_order(input, { signal, progress }) {
    if (input.quantity > 100) throw new BusinessToolError('OUT_OF_STOCK', 'Choose at most 100 items.');
    signal.throwIfAborted();
    progress({ progress: 1, total: 1, message: 'Quote calculated' });
    return {
      content: [{ type: 'text', text: `Quote: ${input.quantity * 20}` }],
      structuredContent: { total: input.quantity * 20 },
      uiOnly: { stockRemaining: 100 - input.quantity },
    };
  },
};
```

构建器默认读取项目根目录的 `mcp-server/handlers.ts`，也可以通过 `handlers` 指定其他模块。只打包处理器，不在构建阶段执行。通过 `typesFile` 将生成声明放到项目的 `.mcpkit/` 中：

```js
await buildPlugin({
  source: './order-agent', name: 'order-agent',
  outputDir: './order-agent/dist/plugin',
  typesFile: './order-agent/.mcpkit/tools.d.ts',
});
```

先构建，再运行 TypeScript 检查。生成的 `ToolInputs`、`ToolOutputs` 和 `BusinessHandlers` 检查工具名、参数和结构化输出；页面 schema 修改后重新构建即可同步类型。生成器支持嵌套对象、数组、枚举、联合类型及本地 `$ref`；无法表达的 schema 部分使用 `unknown`，运行时 JSON Schema 校验仍然生效。工具名必须唯一，业务工具要求对象类型的输入和输出 schema。构建时检查 schema，MCP tools/list 原样公布，每次调用都校验输入与成功输出。缺失处理器会在服务端连接前令启动失败。`result.tools` 中的业务工具包含 `outputSchema`，`result.files.types` 指向生成声明。

| 处理器字段 | MCP 响应 | 可见范围 |
| --- | --- | --- |
| `content` | `content` | 模型可见的摘要或内容块 |
| `structuredContent` | `structuredContent` | 按 `outputSchema` 校验的模型可见数据，也可用于渲染 |
| `uiOnly` | `_meta.uiOnly` | 仅 UI 可见，不进入模型上下文 |

Ink 页面通过 `onMessage(event)` 接收模型初次调用的结果，消息形状为 `{ type: 'mcpkit:tool-result', structuredContent, uiOnly, isError, error, request }`；结果先于 WASM 启动到达时也会保留并投递。Agent 主动调用使用[请求生命周期](#工具请求生命周期)协议，成功的 `mcpkit:tool-state` 消息在 `result` 中携带完整结果。初始结果渲染读取 `event.data.structuredContent` 和 `event.data.uiOnly`。UI 专用数据仍可被客户端访问，不能放入凭证。

业务失败返回 `isError: true`、文本内容 `CODE: message` 和 `_meta.businessError: { code, message }`，省略 `structuredContent`，避免客户端按成功输出 schema 校验错误结果。`BusinessToolError(code, message, details?)` 暴露显式代码与消息，可选详情放入 `_meta.uiOnly`。内置代码包括 `INVALID_INPUT`、`INVALID_OUTPUT`、`INTERNAL_ERROR`、`CANCELLED`、`REQUEST_TIMEOUT` 和 `TOTAL_TIMEOUT`。无效输入不执行处理器，无效输出不会返回成功。意外异常使用通用 `INTERNAL_ERROR` 消息，生命周期元数据也不暴露原异常文本或堆栈。业务错误令请求进入 `error`，默认不会重试。

处理器及配置可以放在项目根目录的 `mcp-server/` 下。构建器从 UI 内容中排除 `mcp-server/`、`dist/`、`.mcpkit/`、`.git/`、`node_modules/`、`.env` 文件和服务端的传递导入；其余资源属于公开 UI 内容。处理器代码只打包到 `dist/server.mjs`，环境变量在服务端运行时读取。处理器可以从根包或 `/tools` 导入运行时辅助 API；`buildPlugin` 等打包 API 应在构建脚本中使用。

运行完整的[业务示例](examples/business)：

```sh
npm run build:examples
npm run start:examples -- business
```

将该服务端注册到 MCP Apps 客户端。调用 `quote_order`，参数为 `{ "quantity": 2 }`，可选 `"coupon": "DEMO10"`；或调用 `check_stock`，参数为 `{ "sku": "DEMO" }`。报价页面显示结构化总价和 UI 专用库存数据，**CALCULATE** 调用真实处理器，**CANCEL** 中止请求。两个工具分别打开 `app.json.pages` 中的报价和库存页面。示例使用确定性的演示数据，不会下单。`npm run typecheck` 检查带类型的示例，并验证错误输入/输出赋值确实被拒绝；MCP 和真实 Ink WASM 浏览器测试覆盖工具发现、契约、错误、服务端代码隔离、渲染、调用和取消。

### 工具请求生命周期

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

## 接入 ESM 库

如果你在开发打包工具或自动构建流程，可以直接从 JavaScript 调用 MCPKit，无需启动 CLI 子进程。

要使用当前仓库中的包，先在 MCPKit 仓库运行 `npm pack`。它会构建库并生成 `yodaos-pkg-aiui-mcpkit-0.1.0.tgz`。然后在自己的 Node.js 项目中安装这个文件：

```sh
npm install /absolute/path/to/aiui-mcpkit/yodaos-pkg-aiui-mcpkit-0.1.0.tgz
```

在自己的项目中创建 `build-agent.mjs`：

```js
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

const result = await buildPlugin({
  source: './agent',
  name: 'my-agent',
  outputDir: './dist/plugin',
  version: '1.0.0',
});

console.log(result.outputDir);
console.log(result.files.view);
```

运行 `node build-agent.mjs` 即可打包。相对路径基于执行命令时所在的目录解析。返回结果包含插件身份、绝对输出目录、marketplace 名称和生成文件的路径。

API 导出 `BuildPluginOptions` 和 `BuildPluginResult` 类型。错误通过 Promise rejection 返回，不输出日志、不退出进程、不修改工作目录。这也是 AIX 等工具的集成入口；`aix pack --target mcp-apps` 计划在 AIX 中单独实现。

## 选择客户端

**能调用 MCP 工具，不等于能展示界面。** 客户端还需要支持 MCP Apps UI。当前构建使用 **stdio**：由客户端启动本地 Node.js 进程，通过标准输入和输出与它通信。

| 客户端 | 接入方式 | 当前可预期的效果 |
| --- | --- | --- |
| Codex 桌面版 | 安装本地插件 | 已观察到 Counter 内联界面；全屏经过浏览器测试 |
| Codex CLI | 本地插件或直接注册 MCP | 安装与终端工具调用；图形界面使用桌面版 |
| Claude Desktop | 配置本地 MCP 服务 | 官方列为 MCP Apps 宿主；本项目界面尚未实测 |
| VS Code / Copilot Chat | 工作区 MCP 配置 | 官方文档提供 MCP Apps 支持；本项目界面尚未实测 |
| 其他本地 MCP Apps 客户端 | 按客户端格式配置 stdio | 需要兼容的 UI 沙箱和资源大小限制 |
| 远程或仅支持 HTTP 的客户端 | 额外提供 HTTP 服务传输层 | MCPKit 目前不生成此类服务 |

### Codex 桌面版

按照[示例教程](#体验示例)安装本地插件，再在桌面版中打开。入口位置、本地工具能否用于当前对话，取决于应用版本和对话类型。详见官方[本地插件安装指南](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually)。

### Codex CLI

CLI 用于安装插件和调用工具。安装后开启一个新的 CLI 会话，让它调用 `open_counter`。打开工具会返回文字响应；操作图形界面需要使用桌面版。

如果只需要直接连接 MCP 服务，可以用下面的命令**替代**插件安装命令：

```sh
codex mcp add aiui-counter -- node /absolute/path/to/aiui-mcpkit/dist/examples/counter/dist/server.mjs
```

选择一种注册方式，避免出现重复工具。详见官方 [MCP 配置指南](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。

### Claude Desktop

Claude Desktop 位于官方 [MCP Apps 宿主列表](https://modelcontextprotocol.io/extensions/apps/overview)中，SDK 也提供[本地 stdio 接入说明](https://github.com/modelcontextprotocol/ext-apps#with-mcp-clients)。生成的服务遵循这套连接方式，完整界面仍需要在 Claude Desktop 中实测。

构建示例后，把下面的配置合并到 `claude_desktop_config.json`。将占位路径替换为仓库的绝对路径，并保留已有服务配置：

```json
{
  "mcpServers": {
    "aiui-counter": {
      "command": "node",
      "args": ["/absolute/path/to/aiui-mcpkit/dist/examples/counter/dist/server.mjs"]
    }
  }
}
```

macOS 的配置位置是 `~/Library/Application Support/Claude/claude_desktop_config.json`，Windows 是 `%APPDATA%\Claude\claude_desktop_config.json`。如果 Claude 找不到 Node.js，把 `node` 替换为可执行文件的绝对路径。重启 Claude Desktop 后，在提供该服务的界面中调用 `open_counter`。详见[本地服务配置指南](https://modelcontextprotocol.io/docs/develop/connect-local-servers)。

Codex marketplace 命令不会安装 Claude 扩展。MCPKit 目前不生成 `.mcpb` 扩展，也不提供网页或手机连接器所需的 HTTPS 服务。这些接入方式见 [Claude 连接器说明](https://support.claude.com/en/articles/11725091-when-to-use-desktop-and-web-connectors)。

### VS Code 与其他客户端

对于 VS Code，将上面的 `mcpServers` 配置放入工作区根目录的 `.mcp.json`。通过 **MCP: List Servers** 启动服务，然后在 Copilot Chat 中调用 `open_counter`。版本与设置要求见官方 [VS Code MCP 指南](https://code.visualstudio.com/docs/agent-customization/mcp-servers)。

其他客户端可以先查阅 [MCP Apps 宿主列表](https://modelcontextprotocol.io/extensions/apps/overview)，再按自己的配置格式注册 `node` 和 `dist/server.mjs` 的绝对路径。接入自己的 Agent 时，替换示例的服务路径，并使用实际配置的打开工具名称。

OpenAI 的侧栏入口属于客户端专用能力。其他宿主可以展示标准应用视图，但展开控件可能不同。

## 修改、重建、迭代

修改 [Counter 页面](examples/counter/pages/counter/index.ink)、[业务页面](examples/business/pages/order/index.ink) 或其[处理器](examples/business/mcp-server/handlers.ts)，然后运行：

```sh
npm run update:examples
```

该命令在共享 marketplace 中重建两个示例，并为每个已安装插件更新 `view.html`、`dist/server.mjs`、`plugin.json` 和 `mcp.json`。重载 MCP 服务端或桌面宿主，并打开**新卡片**以使用更新后的界面和处理器。已有卡片保留当前视图。

脚本使用 `$CODEX_HOME`，默认为 `~/.codex`，检查 `plugins/cache/aiui-mcpkit-examples` 下对应版本及 `local` 目录。未安装的示例会跳过；一个都未安装时会报错。更新自定义安装路径中的单个示例：

```sh
npm run update:examples -- --example business --plugin-dir /absolute/path/to/installed/business-demo
```

未指定 `--example` 时，`--plugin-dir` 指向 marketplace 缓存目录，其中包含 `ink-counter/<version-or-local>` 和 `business-demo/<version-or-local>`。直接配置 MCP 的客户端在重建后会获得注册路径中的新服务端文件，需要通过客户端重载服务端。

在终端启动单个 stdio 服务端时，使用 `npm run start:examples`，默认选择 Counter，或使用 `npm run start:examples -- business`。同一 marketplace 中的两个插件各自保留独立服务端。

## 构建参考

### 生成的文件

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

### API 与辅助脚本参数

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
| `requestPolicy` | 仅 ESM | 上述共享生命周期默认值 |
| `retrySafeTools` | 仅 ESM | `[]` |
| `handlers` | 仅 ESM | 业务工具默认使用 `<source>/mcp-server/handlers.ts` |
| `typesFile` | 仅 ESM | `<outputDir>/tools.d.ts` |

插件名称以小写字母开头，仅包含小写字母、数字或连字符。工具名称由 1–128 个字母、数字、下划线或连字符组成。运行 `node scripts/build-plugin.mjs --help` 查看脚本用法。如果省略 `[source]`，默认使用当前项目根目录；输出目录会从 UI 内容中排除。

### 当前支持范围

UI 宿主需要允许编译 WebAssembly。嵌入的 HTML 约为 10 MB，也需要留意宿主的资源大小限制。源码按 UTF-8 读取，目前不支持打包二进制资源。

自动测试覆盖打包、MCP 工具与资源响应，以及浏览器运行时。它们不能证明所有桌面宿主都完整兼容，也不能保证账号连接后的工具访问权限或资源缓存行为。

## 协议兼容性

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

## 性能基准

先运行 `npm run build`，再运行 `npm run bench`，测量四个固定的真实 Ink WASM 场景、独立的 stdio 服务端工作负载，以及包和资源体积。套件保存原始样本、截图、机器/runtime 版本和 A/B 比较结果。安装步骤与测量边界见[基准指南](benchmarks/README.zh-CN.md)；CI 仅运行正确性 smoke 检查，不设性能阈值。

## 参与贡献

欢迎体验示例、接入新的宿主，或改进构建 API。[提交问题](https://github.com/yodaos-project/aiui-mcpkit/issues)时，请附上客户端版本、构建命令和复现步骤；Claude Desktop 和其他 MCP Apps 宿主的实测反馈尤其有帮助。

| 命令 | 用途 |
| --- | --- |
| `npm run build` | 构建 ESM 库、类型声明和运行时模板 |
| `npm run build:examples` | 构建两个示例及共享 marketplace |
| `npm run update:examples` | 更新已安装示例的界面、服务端及 manifest |
| `npm run start:examples` | 启动 Counter，或用 `-- business` 选择业务示例 |
| `npm run typecheck` | 检查 TypeScript 类型 |
| `npm test` | 运行打包、MCP 和浏览器测试 |
| `npm run bench` | 测量渲染、服务端和打包基线 |

提交代码改动前运行：

```sh
npm run build:examples
npx playwright install chromium
npm run typecheck
npm test
```

浏览器测试在 MCP Apps `AppBridge` 测试环境中运行真实 Agent，覆盖输入、状态连续性、显示模式和禁止网络访问的 CSP。可以通过 `CHROMIUM_PATH` 指定已有 Chromium，也支持可用的 `/usr/bin/chromium`。修改文档时请保持中英文 README 一致。

[查看源码](https://github.com/yodaos-project/aiui-mcpkit) · [反馈问题](https://github.com/yodaos-project/aiui-mcpkit/issues) · [了解 AIUI](https://github.com/yodaos-project/AIUI)
