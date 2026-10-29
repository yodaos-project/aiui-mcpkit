# 返回第一个业务结果

[English](first-business-tool.md) | 简体中文 · [学习路线](../README.zh-CN.md)

**这一课的结果：** 创建一个演示报价工具，两个商品返回 **CNY 40**，并在界面中显示同一份结果。先完成[页面工具](page-tools.zh-CN.md)与[客户端接入](clients.zh-CN.md)。本课使用普通 Node.js 服务端函数，不需要外部服务、API Key 或 Worker。

页面工具用来打开界面，**业务工具**还会执行服务端函数、返回结构化数据。MCPKit 校验输入与输出，再把结果交给助手和界面。

## 1. 创建独立的小应用

保留之前的 Counter，在仓库根目录创建：

```text
my-quote/
├── app.json
├── pages/
│   └── quote.ink
└── mcp-server/
    └── handlers.ts
```

将以下完整内容保存为 `my-quote/app.json`：

```json
{
  "name": "My Quote",
  "pages": ["pages/quote"]
}
```

## 2. 声明输入、输出和界面

将以下完整内容保存为 `my-quote/pages/quote.ink`：

```html
<script type="application/json" def>
{
  "tool": "calculate_total",
  "navigationBarTitleText": "My Quote",
  "description": "Calculate a demo quote at CNY 20 per item.",
  "schema": {
    "data": {
      "type": "object",
      "properties": { "quantity": { "type": "integer", "minimum": 1, "maximum": 100 } },
      "required": ["quantity"],
      "additionalProperties": false
    },
    "output": {
      "type": "object",
      "properties": {
        "quantity": { "type": "integer" },
        "total": { "type": "integer" },
        "currency": { "type": "string", "enum": ["CNY"] }
      },
      "required": ["quantity", "total", "currency"],
      "additionalProperties": false
    }
  }
}
</script>

<script setup>
export default {
  data: { quantity: 0, total: 0, currency: 'CNY', status: 'Waiting for a tool result' },
  onMessage(event) {
    const message = event.data;
    if (message.type !== 'mcpkit:tool-result') return;
    if (message.isError) {
      this.setData({ status: 'The calculation failed' });
      return;
    }
    this.setData({ ...message.structuredContent, status: 'Ready' });
  },
};
</script>

<page>
  <view class="screen">
    <text>My quote</text>
    <text>Quantity: {{quantity}}</text>
    <text>{{currency}} {{total}}</text>
    <text>{{status}}</text>
  </view>
</page>

<style>
.screen {
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  background-color: #000000;
  color: #40ff5e;
}
</style>
```

`schema.data` 与上一课一样描述输入，`schema.output` 描述成功时返回的业务结果。`onMessage()` 通过 `event.data` 收到结果，`setData()` 将它显示出来。

## 3. 编写计算函数

将以下完整内容保存为 `my-quote/mcp-server/handlers.ts`：

```ts
export const handlers = {
  calculate_total: async ({ quantity }: { quantity: number }) => {
    const total = quantity * 20;
    return {
      content: [{ type: 'text', text: 'Total: CNY ' + total }],
      structuredContent: { quantity, total, currency: 'CNY' },
    };
  },
};
```

`handlers.ts` 是默认的服务端模块。参数类型 `{ quantity: number }` 表示 `quantity` 是数字，后面还可以接入生成的契约类型。`calculate_total` 这个键必须与页面的 `tool` 名一致。`content` 是可读摘要，`structuredContent` 必须符合 `schema.output`。

## 4. 构建并接入客户端

在仓库根目录运行：

```sh
node scripts/build-plugin.mjs ./my-quote --name my-quote --out ./dist/my-quote
```

如果使用 Codex 插件方式：

```sh
codex plugin marketplace add ./dist/my-quote
codex plugin add my-quote@my-quote-local
```

其他客户端按[客户端接入](clients.zh-CN.md)配置，服务路径使用 `dist/my-quote/dist/server.mjs` 的绝对路径。重新加载宿主，确认能发现 `calculate_total`。

将以下**对话提示词**发给助手：

```text
用 { "quantity": 2 } 调用 calculate_total。
```

**预期结果：** 返回 `{ "quantity": 2, "total": 40, "currency": "CNY" }`，界面显示数量 2、CNY 40 和 Ready。只支持文本的 MCP 客户端仍能收到结果，但没有交互视图。

普通浏览器监听预览只显示布局，不会执行这次服务端调用，因此会停留在“Waiting for a tool result”。业务执行需要在连接好的客户端中验证。

## 5. 检查一次失败

让助手传入 `{ "quantity": 0 }`，输入 schema 会在调用处理函数前拒绝它。如果处理函数返回的数据不符合 `schema.output`，MCPKit 也会拒绝这份成功结果。

**完成检查：** 正常调用返回 CNY 40，错误输入被拒绝，助手和界面使用同一份服务端结果。本例不会真实下单。

## 用到时再增加复杂度

- 在处理函数中调用外部 API。凭据保留在服务端环境变量中；`mcp-server/` 不会进入 UI 素材包。
- 添加 TypeScript 类型时，使用生成的 `dist/my-quote/tools.d.ts`，见[业务工具执行方式](business-tools.zh-CN.md#node-handler-与校验时机)。
- 需要计算按钮、加载与取消状态时，读[请求生命周期](tool-lifecycle.zh-CN.md)。
- 需要可选 Worker 执行方式时，读[业务工具](business-tools.zh-CN.md)。

**下一步：** [发送消息或选中上下文](agent-session.zh-CN.md)，或[处理加载与错误](tool-lifecycle.zh-CN.md)。
