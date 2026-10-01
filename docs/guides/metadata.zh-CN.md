# 配置和检查公开元数据

[English](metadata.md) | 简体中文 · [文档目录](../README.zh-CN.md)

**前置条件：** 已能构建的 Agent 和 [ESM API](esm-build.zh-CN.md)。这些进阶选项用于定制工具发现元数据，第一篇教程不需要使用。选项与结果类型见[构建参考](../reference/build-api.zh-CN.md)。

## 先做一个小改动

从 `resourceMetadata: { ui: { prefersBorder: false } }` 开始，重新构建，传入 Apps 能力进行检查，在各资源的 `_meta.ui` 中确认该值。宿主决定是否采纳展示偏好。再按下面完整示例添加公开的扩展命名空间或自定义资源。

使用 `toolMetadata`（按已发现的工具名索引）、`resourceMetadata`（所有资源的默认元数据）和 `uiResources`，无需修改运行时模板即可配置协议元数据。这些选项属于 ESM `buildPlugin()` API：

```js
const result = await buildPlugin({
  source: './my-agent', name: 'my-agent',
  toolMetadata: {
    open_app: {
      ui: { resourceUri: 'ui://my-agent/custom.html' },
      'openai/ui': { entrypoints: [{ type: 'thread' }] },
      'example/display': { theme: 'green' },
    },
  },
  resourceMetadata: { ui: { prefersBorder: false } },
  uiResources: [{
    uri: 'ui://my-agent/custom.html', name: 'Custom dashboard',
    html: '<!doctype html><html><body>My custom View</body></html>',
    _meta: { ui: { csp: { connectDomains: ['https://api.example.com'] } } },
  }],
});
const clientCapabilities = {
  extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } },
};
console.log(JSON.stringify(result.inspectProtocol(clientCapabilities), null, 2));
```

页面定义的工具应使用 `<script def>` 声明的名称，替换示例中的 `open_app`。示例 HTML 是静态占位；自定义交互 View 需自行实现 MCP Apps 宿主通道。生成的 AIUI View 仍以原始 URI 注册，`result.tools` 反映最终工具到资源的引用。

| 规则 | 行为 |
| --- | --- |
| 对象合并 | 默认值与作者对象递归合并。资源的顺序为框架默认值 → `resourceMetadata` → 自定义资源的 `_meta`。 |
| 替换 | 作者的标量、数组和 `null` 替换默认值，数组不拼接。已知 Apps 字段须满足类型和位置要求（CSP/权限属于资源，资源引用/可见性属于工具），因此拒绝 `ui: null`。宿主扩展对象作为公开 JSON 保留。 |
| 框架/协议所有权 | 作者 `_meta` 不可设置 `requestPolicy`、`mcpkit`、`aiui`、`request`、`uiOnly`、`businessError` 或 `io.modelcontextprotocol/*`。冲突直接拒绝，不静默丢弃。 |
| 资源引用 | `ui.resourceUri` 或旧版 `ui/resourceUri` 可选择任何已注册的生成/自定义资源，最终归一为同一 URI。拒绝冲突引用、未注册 URI、非规范 URI、URI 凭据/查询/片段和重复资源 URI。自定义资源要求非空名称与 HTML，使用 `text/html;profile=mcp-app`。 |
| 客户端能力 | `inspectProtocol()` 默认模拟无 Apps 能力的客户端。支持界面的客户端收到 UI 元数据和宿主入口；其他客户端省略 `ui`、`ui/resourceUri` 和 `openai/ui`，保留其他公开扩展及正常文字降级行为。 |
| JSON 验收 | 仅接受有限数值、无循环的普通 JSON。拒绝函数、undefined、BigInt、非有限数值、稀疏数组、访问器、symbol、自定义原型、`toJSON` 和原型污染键；在写输出前检查。诊断指出字段，不回显被拒绝的值。 |

`inspectProtocol(capabilities)` 返回独立 JSON 快照，包括准确的 `tools/list` 条目、`resources/list` 条目（包含最终 `_meta`）和 `mcp.json` 连接描述。资源读取使用相同元数据。检查与真实发现共用序列化器，测试在两个协议时期中与真实客户端逐项比对。JSON-RPC 外层和 SDK 添加的响应级元数据不属于条目快照；调试时须传入与客户端一致的 Apps 能力。修改检查快照或 `result.tools` 不改变生成的服务端。

元数据、HTML 和 schema 是作者显式提供的公开内容，凭据应保留在服务端 handler/环境变量中。检查接口不加载 handler 代码、`.env`、进程环境、资源 HTML 或私密源码路径。元数据递归拒绝常见凭据/配置字段名：`password`、`secret`、`token`、`apiKey`、`authorization`、`credentials`、`env`、`headers` 及 access/refresh/client-secret 变体。这项保护不能识别藏在任意字符串中的凭据，因此只应提供公开值。无效元数据在创建或替换输出前失败，保留已有构建产物。

---

[文档目录](../README.zh-CN.md) · 上一篇：[请求生命周期](tool-lifecycle.zh-CN.md) · 下一篇：[ESM 构建接入](esm-build.zh-CN.md)
