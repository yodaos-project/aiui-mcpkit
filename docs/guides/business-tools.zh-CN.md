# 带类型的业务工具

[English](business-tools.md) | 简体中文 · [文档目录](../README.zh-CN.md)

**目标：** 提供带类型的服务端操作，让 AI 和界面共同使用结果。先读[页面工具](page-tools.zh-CN.md)。下方片段展示契约和 handler；需要能直接运行的按钮与结果界面时，请从完整[业务示例](../../examples/business)开始。

## 从可运行的项目开始

1. 按[快速开始](../getting-started/quickstart.zh-CN.md)构建并安装 `business-demo`。
2. 查看 [`app.json`](../../examples/business/app.json)，认识已注册的报价页和库存页。
3. 查看 [`pages/order/index.ink`](../../examples/business/pages/order/index.ink)：`schema.data` 声明输入，`schema.output` 声明报价结果。
4. 查看 [`mcp-server/handlers.ts`](../../examples/business/mcp-server/handlers.ts)：`handlers` 对象按工具名称提供实现。
5. 先修改一个公开展示文案，运行 `npm run update:examples`，重载宿主并打开新报价卡片。
6. 再修改 handler 逻辑，重新构建，同时检查结构化工具结果和页面显示。

自己的项目需要在 `app.json.pages` 注册业务页面，为每个带 `schema.output` 的页面提供 handler，按下方示例设置 `typesFile`，先构建再检查类型。TypeScript 的 `../.mcpkit/tools.js` 类型导入解析到生成的 `.d.ts`，无需编写该类型模块的 JavaScript 实现。使用 `import type`，让它在打包时消失。

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

Ink 页面通过 `onMessage(event)` 接收模型初次调用的结果，消息形状为 `{ type: 'mcpkit:tool-result', structuredContent, uiOnly, isError, error, request }`；结果先于 WASM 启动到达时也会保留并投递。Agent 主动调用使用[请求生命周期](tool-lifecycle.zh-CN.md)协议，成功的 `mcpkit:tool-state` 消息在 `result` 中携带完整结果。初始结果渲染读取 `event.data.structuredContent` 和 `event.data.uiOnly`。UI 专用数据仍可被客户端访问，不能放入凭证。

业务失败返回 `isError: true`、文本内容 `CODE: message` 和 `_meta.businessError: { code, message }`，省略 `structuredContent`，避免客户端按成功输出 schema 校验错误结果。`BusinessToolError(code, message, details?)` 暴露显式代码与消息，可选详情放入 `_meta.uiOnly`。内置代码包括 `INVALID_INPUT`、`INVALID_OUTPUT`、`INTERNAL_ERROR`、`CANCELLED`、`REQUEST_TIMEOUT` 和 `TOTAL_TIMEOUT`。无效输入不执行处理器，无效输出不会返回成功。意外异常使用通用 `INTERNAL_ERROR` 消息，生命周期元数据也不暴露原异常文本或堆栈。业务错误令请求进入 `error`，默认不会重试。

处理器及配置可以放在项目根目录的 `mcp-server/` 下。构建器从 UI 内容中排除 `mcp-server/`、`dist/`、`.mcpkit/`、`.git/`、`node_modules/`、`.env` 文件和服务端的传递导入；其余资源属于公开 UI 内容。处理器代码只打包到 `dist/server.mjs`，环境变量在服务端运行时读取。处理器可以从根包或 `/tools` 导入运行时辅助 API；`buildPlugin` 等打包 API 应在构建脚本中使用。

运行完整的[业务示例](../../examples/business)：

```sh
npm run build:examples
npm run start:examples -- business
```

将该服务端注册到 MCP Apps 客户端。调用 `quote_order`，参数为 `{ "quantity": 2 }`，可选 `"coupon": "DEMO10"`；或调用 `check_stock`，参数为 `{ "sku": "DEMO" }`。报价页面显示结构化总价和 UI 专用库存数据，**CALCULATE** 调用真实处理器，**CANCEL** 中止请求。两个工具分别打开 `app.json.pages` 中的报价和库存页面。示例使用确定性的演示数据，不会下单。`npm run typecheck` 检查带类型的示例，并验证错误输入/输出赋值确实被拒绝；MCP 和真实 Ink WASM 浏览器测试覆盖工具发现、契约、错误、服务端代码隔离、渲染、调用和取消。

## 正确处理两种结果消息

最初由 AI 调用得到的结果，与页面后续主动调用得到的结果，外层格式不同。把下面的方法加入页面的 `export default` 对象，并按输出 schema 调整字段：

```js
onMessage(event) {
  const message = event.data;
  if (message.type === 'mcpkit:tool-result') {
    this.setData({ total: message.structuredContent?.total ?? 0 });
  } else if (message.type === 'mcpkit:tool-state' && message.state === 'ready') {
    this.setData({ total: message.result.structuredContent?.total ?? 0 });
  }
}
```

这是渲染逻辑片段，不是完整页面。完整业务页面还会关联请求 ID、在错误或取消时停止加载，并展示失败消息，见[消息参考](../reference/messages.zh-CN.md)和[请求生命周期](tool-lifecycle.zh-CN.md)。

## 配置应该放在哪里

凭据留在服务端，由 handler 从环境变量读取。`uiOnly` 表示不进入模型上下文，不代表对宿主或用户保密。元数据、schema 描述和界面资源都是公开内容，不应通过它们传递 token。

调用远程服务时，把 handler 的 `signal` 传给 `fetch(url, { signal })` 或其他真正支持中断的 API。仅发送取消消息无法撤销已经完成的副作用。服务日志使用 stderr，避免向 stdout 输出调试文字，因为 stdout 用于 MCP 协议消息。

---

[文档目录](../README.zh-CN.md) · 上一篇：[页面工具](page-tools.zh-CN.md) · 下一篇：[请求生命周期](tool-lifecycle.zh-CN.md)
