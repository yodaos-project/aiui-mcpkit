# 录制与回放 Agent 交互

[English](interaction-replay.md) | 简体中文 · [文档索引](../README.zh-CN.md)

从全新的开发 View 开始录制，在 Inspector 中导出经过授权的测试数据，再在隔离浏览器中执行同样的输入和画布操作。回放校验公开状态断言、实际发出的工具请求和显式模型上下文。截图是补充证据，不能替代语义断言。

## 从启动开始录制

```js
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

await buildPlugin({
  source: './agent', name: 'my-agent',
  inspector: {
    redactKeys: ['customerId', 'accountNumber'],
    recording: {
      maxSteps: 1000,
      allow: {
        input: ['/quantity'],
        result: ['/content', '/structuredContent'],
        state: ['/quantity', '/total', '/expanded'],
        context: ['/structuredContent'],
        toolInput: ['/quantity'],
        toolResult: ['/content', '/structuredContent'],
      },
    },
  },
});
```

录制时使用合成业务数据。JSON Pointer 显式授权对应字段及其整个子树的导出；空指针 `''` 授权整个通道，也支持标量值。默认白名单为空。内置凭证/UI metadata 过滤和 `redactKeys` 对授权字段仍然生效。`/structuredContent` 会授权其下所有业务字段，混合公私数据时应使用更细的指针。数组元素使用 `/candidates/0/sku` 等数字路径。未授权值在保留前替换为 `[MCPKIT: EXPORT NOT AUTHORIZED]`，实际参数与业务执行不受影响。

重新构建并打开**全新的 View**。录制在宿主握手和首次工具输入之前开始，稍后打开 Inspector 不会丢失之前的步骤。完成选择、展开和显示模式切换，随后点击 **Inspector → Export interaction recording** 下载本地 JSON。不会自动上传或持久化。**Clear trace** 仅清除 Inspector 诊断，不清除独立录制。生产构建省略 `inspector`。

仅开发构建提供的 `window.__mcpkitInteractions.snapshot()` 和 `.export()` 返回同一份记录，便于浏览器自动化。公开的 `InteractionRecorder` 可订阅 `Inspector`，使用 `.dispose()` 取消订阅。它观察实际桥接/Provider 事件，不会自行调用业务工具。

## 提供语义状态检查点

应用重要状态变化后，通过现有 Inspector 契约发送主动选择的公开投影：

```js
this.postMessage({
  type: 'mcpkit:inspect', kind: 'binding', name: 'order',
  visibility: 'public',
  value: {
    quantity: this.data.quantity,
    total: this.data.total,
    expanded: this.data.expanded,
  },
});
```

`visibility: 'public'` 允许诊断观察，录制白名单另外授权导出。私有 binding 消息不被收集，不扫描 App/Page 状态，也不挂接所有 `setData()`。没有开发面板的构建也能在回放中观察这些公开消息。模型上下文仍由正常的 `provideContext()` API 发布，回放检查排队和版本检查之后实际发出的 `updateModelContext()` 载荷。记录完整需要宿主确认，但确认不证明后续模型轮次消费了上下文。

每个异步操作后，等待状态/上下文检查点，再执行下一动作或导出。尚未完成的工具调用、上下文确认会使 `complete` 为 false。超限时标记不完整，不丢弃开头。录制与 Inspector 分别使用 `maxSteps` 和 `maxEvents` 限制。

## 通过预览验证器回放

```js
import { readFile } from 'node:fs/promises';
import { verifyPlugin, validateInteractionRecord } from '@yodaos-pkg/aiui-mcpkit';

const replay = JSON.parse(await readFile('./fixtures/order.json', 'utf8'));
validateInteractionRecord(replay);
const result = await verifyPlugin({
  pluginDir: './dist/my-agent', replay,
  timeouts: { business: 5000 },
  screenshotPath: './test-results/order-replay.png',
});
if (!result.usable) throw new Error(JSON.stringify(result.diagnostics));
console.log(result.replay);
// {status:'passed', completedSteps:..., checks:{state:..., toolRequests:..., modelContext:...}}
```

Playwright/Chromium 安装见[预览验证](preview-verification.zh-CN.md)。仓库 CLI 使用同一个 API：

```sh
npm run verify:plugin -- ./dist/my-agent \
  --replay ./fixtures/order.json \
  --screenshot ./test-results/order-replay.png
```

初始页面、视口、缩放和显示模式来自记录，不能同时传 input/page/viewport/mode/scale 覆盖值。需要确定性数据注入时，修改 JSON 副本中的 `tool-input`、`tool-result`、mock 结果，并同步修改对应状态/上下文断言。包含脱敏/截断占位符的记录在启动浏览器前被拒绝，须显式替换为合成测试值，不会回退到内存中的私有数据或真实服务。

每个服务端请求必须与下一条 mock 的名称、参数严格一致，对象属性顺序不影响匹配。支持 `mcpkit:call-tool` 和 Ink `getAgent().callTool()` 两条路径。缺失或不匹配的 mock 返回错误，多余未消费 mock 也导致失败。所有服务端调用均使用 mock，包括写操作及标记为只读的调用；不会启动生成的 MCP 服务端或无头 Worker。上下文仅在本地确认，对话消息被阻止。独立浏览器上下文阻断外部 HTTP、网络写入、WebSocket 和 service worker。这是可信 Agent 代码的开发回归工具，不是恶意代码的操作系统沙箱。

每个状态/上下文断言消费该通道的下一条实际发布，并要求结构精确相等；多出的未断言输出也会失败。至少需要一个语义断言。`REPLAY_FAILED` 标明失败步骤或不匹配输出，诊断消息不暴露实际业务值。失败仍可保留诊断截图。成功回放无需 `readyWhen` 即可通过业务检查；如同时提供 `readyWhen`，它仍是额外必需条件。可在相同浏览器、运行时和测试数据下继续比较返回的 PNG。

## 版本 1 格式与边界

`InteractionRecord` 包括 `format: 'mcpkit-interactions'`、`version: 1`、`complete`、环境字段（`page`、`viewport`、`deviceScaleFactor`、`displayMode`）、`steps` 和 `mocks`。未知版本、非法路由/尺寸/坐标/消息结构在执行前被拒绝。

| 步骤 | 含义 |
| --- | --- |
| `tool-input` / `input` | 宿主启动/更新参数，首个步骤必须为输入 |
| `tool-result` / `result` | 注入宿主结果，排除私有 metadata |
| `click` / `x`, `y` | 画布内 CSS 坐标，通过真实浏览器指针事件执行 |
| `display-mode` / `mode` | 经宿主桥接切换 `inline` 或 `fullscreen` |
| `assert-state` / `name`, `value` | 精确匹配下一条公开 binding |
| `assert-context` / `value` | 精确匹配下一条出站模型上下文 |

Mock 按调用顺序存储为 `{name, input, result}`；结果包含 MCP `content` 和可选 `structuredContent`/`isError`。共享 App 的宿主结果可保留显式授权的 `result.invocation`（`page`、`query`、`tool`），回放时重建 `_meta.aiui`，其余 metadata 不导出。

版本 1 支持固定视口下的点击选择/展开和宿主显示模式切换。键盘/文本输入、拖动、滚轮、粘贴/拖放、部分输入、取消、直接 live tool 调用、重试、资源操作和对话发送会标记记录不完整，避免静默回放不同场景。不虚拟化任意时钟、随机数、网络时序和动画；应提供稳定公开投影及确定性测试数据。UI-only 私有结果和持久化恢复状态不是回放数据来源。本地浏览器测试证明状态/协议/渲染行为，不代表所有桌面客户端兼容或实际模型消费。

运行 `npm run build:examples`，再执行 `node --test tests/interactions.test.mjs tests/interactions-browser.test.mjs` 可复现完整回放及失败检查。浏览器用例录制选择、展开、全屏和宿主结果，回放两次、比较画布，并覆盖错误状态/上下文/mock 及被阻断的网络写入。

[文档索引](../README.zh-CN.md) · [Inspector](inspector.zh-CN.md) · [预览验证](preview-verification.zh-CN.md)
