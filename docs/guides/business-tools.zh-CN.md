# AgentWorker 中的业务工具

[English](business-tools.md) | 简体中文 · [文档目录](../README.zh-CN.md)

[Business Demo](../../examples/business) 将 `quote_order`、`check_stock`、`find_products` 全部实现为 [workers/business.js](../../examples/business/workers/business.js) 中的 `ModelContext.defineAction()` 方法。页面负责展示和发布用户选择的上下文。MCPKit 生成协议服务，示例无需手写服务端 Handler。

## 声明并构建 Worker

在 `app.json.agentWorkers` 中注册：

```json
{ "name": "business", "script": "workers/business.js", "trigger": { "type": "open" }, "lifetime": "foreground" }
```

构建时选择相同的 Worker 名称：

```js
await buildPlugin({
  source: './agent', name: 'business-demo',
  outputDir: './dist/business-demo',
  worker: { name: 'business' },
  typesFile: './agent/.mcpkit/tools.d.ts',
});
```

仓库的[示例构建脚本](../../scripts/build-examples.mjs)已选择该适配器。注册页面仍声明工具名、描述、输入 `schema.data` 和成功输出 `schema.output`，用于公开 MCP 契约和页面路由；Worker 实现相应工具名的逻辑。详见[页面工具](page-tools.zh-CN.md)。

## 实现 Action

下面展示基本模式，链接的 Worker 包含三个工具的完整实现：

```js
export default {
  available: 100,
  checkStock: ModelContext.defineAction({
    name: 'check_stock', description: 'Check demo stock',
    execute(input, { signal }) {
      signal.throwIfAborted();
      if (input.sku !== 'DEMO') return {
        isError: true,
        businessError: { code: 'UNKNOWN_SKU', message: 'Use demo SKU DEMO.' },
        uiMetadata: { knownSku: 'DEMO' },
      };
      return {
        content: [{ type: 'text', text: '100 demo items available.' }],
        structuredContent: { sku: input.sku, available: this.available },
      };
    },
  }),
};
```

Ink 将 `this` 绑定到 Worker 实例。Action 接收执行 `signal`；示例的异步报价会在取消时清除定时器。Worker 注册表独立于 UI，可在打开 View 前执行，不使用 Node 模块、`process.env`、Page 或渲染器。

| Worker 返回 | MCP 返回 | 可见范围 |
| --- | --- | --- |
| `content` | `content` | 模型可见内容 |
| `structuredContent` | `structuredContent` | 经过校验的成功数据，也发送给 UI |
| `uiMetadata` | `_meta.uiOnly` | UI 展示数据 |
| `isError: true` 与 `businessError: { code, message }` | `isError`、`_meta.businessError` 和标准错误文本 | 显式业务失败，不携带成功输出 |

显式失败可通过 `uiMetadata` 携带 UI-only 详情。格式错误的失败结果和未预期的 Worker 异常转换为通用 `INTERNAL_ERROR`，不发布异常消息或堆栈。生成的服务校验输入和输出 schema。`ToolInputs`、`ToolOutputs`、`BusinessHandlers` 类型仍可用于应用集成；JavaScript Worker 由运行时校验约束。

原生宿主独立的 `operations` 接口提供 `requestId`、`configuration` 和 `reportProgress`。这些仅属于 operation 的字段不在 `ModelContext.defineAction()` 回调上下文中；本例全部使用声明式 Action。详见[运行时集成](runtime-integration.zh-CN.md)。

## 运行与部署

在 Ink 仓库构建原生宿主：

```sh
cargo build -p ink-script --bin ink-worker
```

将 `ink-worker` 放入 MCP 服务进程的 PATH，或通过该进程的 `INK_WORKER_BIN` 指定绝对路径。桌面应用的环境可能不同于终端。生成的 `worker-app/` 需与 `view.html`、`dist/server.mjs` 和 manifest 一同部署；`update:examples` 会同步这些产物。

仓库开发或 CI 没有原生可执行文件时，可在 `npm ci` 后将 `INK_WORKER_BIN` 指向 `scripts/ink-worker-wasm.mjs` 的绝对路径。这个通用宿主通过公开 SDK 的真实 Ink QuickJS/WASM 执行 Action，与桌面验收中使用的原生宿主分开记录。

在 MCPKit 仓库运行：

```sh
npm run build:examples
INK_WORKER_BIN=/absolute/path/to/ink-worker npm test
INK_WORKER_BIN=/absolute/path/to/ink-worker npm run start:examples -- business
```

调用 `quote_order({ "quantity": 2, "coupon": "DEMO10" })`，得到 CNY 36 和库存 98；调用 `check_stock({ "sku": "DEMO" })` 得到库存 100；调用 `find_products({ "query": "travel" })` 得到两项候选结果。模型上下文闭环见[候选选择](candidate-selection.zh-CN.md)。无效优惠码返回 `INVALID_COUPON`，未知 SKU 返回 `UNKNOWN_SKU`；不符合 schema 的输入不会进入 Worker。**CALCULATE** 和 **CANCEL** 调用、取消同一个 Worker Action，不创建订单。

## UI 结果与隐私

初始结果以 `{ type: 'mcpkit:tool-result', structuredContent, uiOnly, isError, error, request }` 交给 `onMessage(event)`；后续 `mcpkit:tool-state` 成功消息在 `result` 中携带完整响应。[订单页面](../../examples/business/pages/order/index.ink)处理两种结果并关联请求。详见[消息](../reference/messages.zh-CN.md)和[生命周期](tool-lifecycle.zh-CN.md)。

Worker 源码随应用打包，也进入浏览器 View，不能放置凭据。供应商标签是公开演示数据，以 UI 元数据返回。UI-only 数据排除在模型可见结果之外，但宿主及用户仍可访问。选择页面仅显式投影选中字段到上下文。

## Node Handler 与校验时机

Node Handler 在生成的 MCP 服务进程中执行，可以使用 Node.js API、环境变量和外部服务。未配置 `worker` 时使用此适配器；Worker 执行方式见 [Worker 配置](runtime-integration.zh-CN.md#通过-worker-执行业务工具)。

没有 `schema.output` 的页面打开工具不需要 Handler。声明了 `schema.output` 的业务工具必须有执行实现，无论是否显示 UI。工具名、说明和输入/输出 schema 来自注册的 `.ink` 页面。

Node 适配器默认从 `<source>/mcp-server/handlers.ts` 读取导出的 `handlers`，也可通过 `buildPlugin({ ..., handlers: '/absolute/path/to/handlers.ts' })` 指定其他模块。使用生成类型：

```ts
import type { BusinessHandlers } from '../.mcpkit/tools.js';

export const handlers = {
  check_stock: async ({ sku }, { signal, progress }) => {
    signal.throwIfAborted();
    progress({ progress: 1, total: 1 });
    return { content: [], structuredContent: { sku, available: 100 } };
  },
} satisfies BusinessHandlers;
```

该片段假设只有 `check_stock` 一个业务工具；实际应用需实现生成的全部 `BusinessHandlers` 成员。`mcp-server/` 只放计算、查询和服务调用。MCP 注册与传输、校验、取消/进度转发及结果封装由生成框架负责，Handler 无需导入 MCP SDK。服务端模块、传递依赖及凭据不进入 UI 资源。`_meta.uiOnly` 是宿主和用户可访问的展示数据，不能作为秘密存储。

| 时机 | 检查与失败行为 |
| --- | --- |
| 构建期，创建或替换产物前 | 校验页面契约，按打包器既有的扩展名/index 规则解析所选 Handler 模块。模块无法解析时，错误包含路径及受影响的业务工具名。打包依赖，但不执行应用代码。失败保留已有产物和类型声明。 |
| 服务启动期，连接或发现工具前 | 执行打包后的模块，检查导出 `handlers` 中每个业务工具是否为自有函数。映射/成员缺失、继承成员或非函数均报 `Missing business handler: <tool>`。这类动态检查明确留到启动期。 |
| 调用期 | 执行前校验输入，返回成功结果前校验输出。无效结果与执行失败均返回错误，业务工具不会静默降级为页面打开工具。 |

Worker 构建要求 `worker.name` 对应 manifest 条目，且不能同时配置 `handlers`。宿主可执行文件是否可用、初始化与操作查找在调用时启动宿主后检查；构建或工具列表成功不代表 Worker 已就绪。宿主或操作缺失会使调用失败，不回退到 Node 执行或伪造成功。

---

[文档目录](../README.zh-CN.md)
