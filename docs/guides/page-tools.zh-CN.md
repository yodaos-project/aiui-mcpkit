# 为每个页面定义工具

[English](page-tools.md) | 简体中文 · [文档目录](../README.zh-CN.md)

**目标：** 把 AI 请求转换为带验证参数的页面。先完成[第一个 Agent](../getting-started/first-agent.zh-CN.md)。下方 weather 示例是可完整替换的 `.ink` 文件，用来显示客户端传入的城市，不会查询真实天气 API。

## 按步骤添加带参数页面

1. 在 Agent 源码中创建 `pages/weather/index.ink`，粘贴下面完整的 weather 页面。
2. 向 `app.json.pages` 添加 `"pages/weather/index"`；仍需内部导航时保留 `"pages/home"`。
3. 重新构建，同步已安装副本，重载 MCP 服务或宿主。
4. 确认工具列表出现 `show_weather`，输入包含必填字符串 `city`。
5. 用 `{ "city": "Hangzhou" }` 调用，页面应显示 `Hangzhou`。

```json
{
  "name": "My Agent",
  "pages": ["pages/home", "pages/weather/index"]
}
```

只要有页面声明 `schema.data`，工具发现就使用页面工具列表，而非兜底 `open_app`。本例的 `pages/home` 仍可用于导航，但没有公开 opener；想让两个页面都可被调用，需要分别声明 schema。

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

## 理解参数验证

| 调用参数 | 预期行为 |
| --- | --- |
| `{ "city": "Hangzhou" }` | 打开天气页面并显示该城市。 |
| `{}` | 拒绝：缺少必填 `city`。 |
| `{ "city": 123 }` | 拒绝：传入数字，而非字符串。 |
| `{ "city": "Hangzhou", "debug": true }` | 拒绝：`additionalProperties` 为 false。 |

`required` 决定字段是否必须存在，`type` 决定允许什么值。JSON Schema 中声明 `default` 并不能替代页面或 handler 中的默认值逻辑。可选标量参数在转换前先判断 `query.field === undefined`，空字符串与缺少参数不是一回事。

页面工具验证输入，但不执行服务端业务逻辑。可信计算、凭据或服务调用应使用[业务工具](business-tools.zh-CN.md)。页面事件格式见[请求与结果消息](../reference/messages.zh-CN.md)。

---

[文档目录](../README.zh-CN.md) · 上一篇：[创建第一个 Agent](../getting-started/first-agent.zh-CN.md) · 下一篇：[带类型的业务工具](business-tools.zh-CN.md)
