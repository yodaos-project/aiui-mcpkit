# 为应用添加工具参数

[English](page-tools.md) | 简体中文 · [学习路线](../README.zh-CN.md)

**这一课要添加：** 一个接受起始计数的工具 `open_my_counter`。先完成[创建自己的应用](../getting-started/first-agent.zh-CN.md)，保留 `my-agent/app.json` 不变。命令在仓库根目录执行。

工具是助手可以调用的命名操作。**输入 schema** 用来说明可以接收哪些 JSON 参数。MCPKit 读取页面中的声明，生成工具注册与参数校验。

## 1. 替换页面

用 Ctrl+C 停止监听，将 `my-agent/pages/home.ink` **完整替换**为：

```html
<script type="application/json" def>
{
  "tool": "open_my_counter",
  "navigationBarTitleText": "My counter",
  "description": "Open my counter at the requested starting value.",
  "schema": {
    "data": {
      "type": "object",
      "properties": {
        "initialCount": { "type": "integer", "minimum": 0, "maximum": 100 }
      },
      "required": ["initialCount"],
      "additionalProperties": false
    }
  }
}
</script>

<script setup>
export default {
  data: { count: 0 },
  onLoad(query) {
    this.setData({ count: Number(query.initialCount) });
  },
  increment() {
    this.setData({ count: this.data.count + 1 });
  },
};
</script>

<page>
  <view class="screen">
    <text class="title">My first app</text>
    <text class="count">{{count}}</text>
    <button class="control" bindtap="increment">+ ADD ONE</button>
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
.title {
  font-size: 20px;
}
.count {
  font-size: 40px;
}
.control {
  padding: 8px 16px;
  background-color: #000000;
  color: #40ff5e;
  border-width: 1px;
  border-style: solid;
  border-color: #40ff5e;
}
</style>
```

新增内容只有两部分：JSON `script def` 声明，以及 `onLoad(query)`。

## 2. 带起始值预览

在仓库根目录运行：

```sh
node scripts/build-plugin.mjs ./my-agent --name my-agent --out ./dist/my-agent --watch --input '{"initialCount":5}'
```

打开终端输出的预览地址，计数从 **5** 开始，点击一次变为 **6**。`--input` 为本地预览提供启动参数，此时还没有让 AI 调用工具。

## 3. 读懂工具声明

| 字段 | 含义 |
| --- | --- |
| `tool` | 客户端发现的名称：`open_my_counter`。 |
| `description` | 告诉助手什么时候使用这个工具。 |
| `schema.data` | 参数的 JSON Schema。 |
| `type: "integer"`、`minimum`、`maximum` | 只接受 0 到 100 的整数。 |
| `required` | 调用必须带上 `initialCount`。 |
| `additionalProperties: false` | 拒绝未声明的参数。 |

真实服务会在返回成功前验证参数。Ink 将标量启动参数提供为字符串，因此用 `Number(query.initialCount)` 转换后再保存到页面状态。对象、数组会以 JSON 字符串传入，需要按声明解析。

## 4. 在客户端验证

完成[连接自己的应用](clients.zh-CN.md#连接自己的应用)后，让助手以 `{ "initialCount": 5 }` 调用 `open_my_counter`。以下是**工具输入**，不是终端命令：

| 输入 | 服务端预期行为 |
| --- | --- |
| `{ "initialCount": 5 }` | 从 5 打开计数器。 |
| `{}` | 拒绝：缺少必填参数。 |
| `{ "initialCount": "5" }` | 拒绝：字符串不是整数。 |
| `{ "initialCount": -1 }` | 拒绝：小于最小值。 |

**完成检查：** 预览从 5 开始；连接后，客户端能发现 `open_my_counter`，合法输入成功，不合法输入被拒绝。

## 之后添加更多页面时

已注册页面中，只有声明 `schema.data` 的页面会成为公开工具。添加声明后，会替代默认的 `open_app`，并不是工具意外丢失。其他已注册页面仍可用于应用内导航。

没有页面声明 schema 时，MCPKit 提供 `open_app`。已声明 schema 的页面如果没有显式 `tool`，会使用 `open_` 加完整页面路径，并把不支持的字符替换为 `_`。建议显式命名，并保证名称唯一。`navigationBarTitleText` 设置标题；路径和命名规则详见[构建 API](../reference/build-api.zh-CN.md)。

**下一步：** [连接 AI 客户端](clients.zh-CN.md)，然后[返回业务结果](first-business-tool.zh-CN.md)。
