# Agent 会话与实时工具

[English](agent-session.md) | 简体中文 · [文档目录](../README.zh-CN.md)

MCPKit 使用已发布的 Ink SDK `0.20.0-daily.20261027171530`。运行 `npm ci` 后重新构建插件即可，不再需要本地构建 Ink SDK。更新已安装副本后，需要重载服务并重新打开 View。

## 选择 API

| 目标 | API | 宿主要求 |
| --- | --- | --- |
| 点击按钮发送用户消息 | `getApp().getAgent().conversation.sendMessage()` | 文本消息能力 |
| 将选中数据发布为模型上下文 | `agent.provideContext()` | 结构化上下文能力 |
| 让模型读取或修改当前 App/Page | `ModelContext.defineAction()` | View 工具发现、调用及模型路由 |
| 运行时注册或撤销工具 | `getApp().modelContext.registerTool()` | 同上 |
| 从页面调用服务端业务工具 | `agent.callTool()` | Server tool 调用能力 |
| 列出或读取宿主资源 | `agent.listResources()` / `readResource()` | Server resources 能力 |

生成的 View 在 MCP Apps 握手完成后绑定 provider。不支持的操作抛出 `NotSupportedError`；宿主明确拒绝消息时抛出 `NotAllowedError`。

## 发送消息，并提供读取当前选择的工具

用下面完整的 `.ink` 文件替换[第一个 Agent](../getting-started/first-agent.zh-CN.md)中的页面，保留 `app.json.pages` 中对应路由。本例沿用兜底的 `open_app` 入口。按钮显式发布上下文，再发送用户消息；`get_selection` 工具读取同一个 Page 实例。

```html
<script setup>
export default {
  data: { selectedSku: 'DEMO', status: '', sending: false },
  getSelection: ModelContext.defineAction({
    name: 'get_selection',
    description: '读取当前页面选中的商品',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute() {
      return { selectedSku: this.data.selectedSku };
    },
  }),
  async sendSelection() {
    if (this.data.sending) return;
    this.setData({ sending: true, status: '' });
    try {
      const agent = getApp().getAgent();
      const value = { selectedSku: this.data.selectedSku };
      if (this.selection) {
        await this.selection.update(value);
      } else {
        this.selection = await agent.provideContext({
          key: 'selection', description: '当前选中的商品', value,
        });
      }
      await agent.conversation.sendMessage({
        role: 'user',
        content: [{ type: 'text', text: '请介绍商品 ' + value.selectedSku + '。' }],
      });
      this.setData({ status: '宿主已接收消息' });
    } catch (error) {
      this.setData({ status: error.name + ': ' + error.message });
    } finally {
      this.setData({ sending: false });
    }
  },
  onUnload() { this.selection?.dispose(); },
};
</script>
<page>
  <text>当前商品：{{selectedSku}}</text>
  <button bindtap="sendSelection">询问这个商品</button>
  <text>{{status}}</text>
</page>
```

打开页面并点击按钮，宿主应收到用户消息，以及包含 description 和 value 的 `structuredContent.contexts.selection`。宿主若已将 View 工具纳入模型路由，让模型调用 `get_selection`，预期得到 `{ "selectedSku": "DEMO" }`。消息成功仅表示宿主确认接收，何时请求模型和展示回复由宿主决定。单独发布上下文不会发送消息或触发推理，App/Page 状态也不会自动发布。

相同的 `ModelContext.defineAction()` 可用于 `app.js` 默认导出的自有方法，此时 `this` 指向 App；在 Page 中则指向 Page。工具名需显式声明，并在当前 App/Page 注册表中唯一。Page Action 隐藏时撤下，显示时恢复；卸载会取消其待完成调用。需要所属实例的 `this` 时，使用示例中的 `execute()` 方法写法。

这些实时工具通过 MCP Apps View 的 `tools/list` 和 `tools/call` 提供，不会自动变成生成的服务端工具，也不出现在 `buildPlugin().tools` 中；后者记录构建时的页面入口和业务工具。需要在 View 打开前可调用的工具，使用[页面工具](page-tools.zh-CN.md)或[服务端业务工具](business-tools.zh-CN.md)。Worker Action 注册表与实时 App 独立，MCPKit 的原生 Worker 适配仍需外部 `ink-worker` 可执行文件。

## 动态注册与撤销工具

在已启动的 App/Page 业务方法中运行，保存控制器以便稍后撤销：

```javascript
const registration = new AbortController();
await getApp().modelContext.registerTool({
  name: 'calculate_total',
  description: '按每件 20 计算指定数量的总价',
  inputSchema: {
    type: 'object', properties: { quantity: { type: 'integer', minimum: 1 } },
    required: ['quantity'], additionalProperties: false,
  },
  execute(input, { signal }) {
    signal.throwIfAborted();
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new TypeError('quantity must be a positive integer');
    }
    return { total: input.quantity * 20 };
  },
}, { signal: registration.signal });
// 稍后，不再提供这个工具时：
registration.abort();
```

宿主会收到工具列表变化通知。动态注册属于 App，即使在 Page 中注册，也应在适当时机显式撤销。注册信号控制工具是否继续可用，回调信号控制某一次调用的取消。实时工具的 `inputSchema` 描述参数，业务参数仍需在回调中校验；生成的服务端页面/业务工具继续由 MCPKit 校验 schema。

## 调用宿主工具与资源

在已启动的 App/Page 方法中使用，工具名和资源 URI 应替换为宿主实际提供的值：

```javascript
const agent = getApp().getAgent();
const result = await agent.callTool('check_stock', { sku: 'DEMO' });
if (result.isError) console.error(result.content);
else console.log(result.structuredContent ?? result.content);
const page = await agent.listResources();
const contents = await agent.readResource('demo:stock');
```

工具业务失败通过 `isError` 返回，传输或权限错误会抛出异常。Provider 仅传递约定的 UI 元数据，资源内容可包含文本或二进制 blob。当前不声明远端工具列表代理和远端列表变化事件。Ink 的 `conversation.sendCard()` / `updateCard` 需要专用宿主渲染器，本适配器暂不支持。

真实 WASM 浏览器测试覆盖点击发送消息、上下文更新、App/Page Action、动态注册与撤销、列表变化、调用取消、宿主拒绝和资源访问。目标客户端是否实际向模型路由 View 工具、模型是否消费发布的上下文，仍需单独交互验证。

---

[文档目录](../README.zh-CN.md) · [协议兼容性](../reference/compatibility.zh-CN.md)
