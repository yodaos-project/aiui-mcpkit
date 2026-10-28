# 多工具共享一个 App

[English](shared-agent.md) | 简体中文 · [文档目录](../README.zh-CN.md)

Business Demo 提供搜索、商品详情和选择共享目录。Worker Action 查询并校验演示商品，App Action 更新原有的实时界面。不购买商品，无需示例专用 MCP server。

![全屏目录保留已选的包](../assets/shared-agent-desktop-detail.png)

## 独立注册 UI

```js
await buildPlugin({
  source: 'examples/business', name: 'business-demo',
  worker: { name: 'business' },
  applications: { catalog: { page: 'pages/catalog/index' } },
});
```

页面 JSON `script def` 可以使用非空 `tools` 数组替代单个 `schema`。每项分别声明 `tool`、`description` 和 `schema.data`/`schema.output`。在外层定义或单项中设置 `application: "catalog"`，即可绑定已注册 App。注册页必须在 `app.json.pages` 中；契约可以声明在其他已注册页面中，不决定共享 UI 的路由。

`search_catalog`、`inspect_catalog_product`、`select_catalog_product` 共用 `ui://business-demo/applications/catalog.html`，只注册一个资源。每项契约独立校验，Worker Action 使用对应工具名。完整源码见[契约](../../examples/business/pages/catalog/index.ink)和 [Worker](../../examples/business/workers/business.js)。

## 更新原有 App

在仓库根目录构建并更新已安装 Business Demo：

```sh
npm run build:examples
node scripts/update-examples.mjs --example business
```

重载 MCP 服务或桌面宿主，重新打开 View。先调用 `search_catalog({"query":"travel"})` 打开目录，再使用该 View 的 **实时 App 工具**：

| 工具 | 效果 |
| --- | --- |
| `catalog_search({query})` | 更新搜索结果，不退出详情页、不清除选择 |
| `catalog_inspect({sku})` | 在同一 App 打开详情，保留搜索和选择 |
| `catalog_select({sku})` | 更新选择，不跳转、不购买 |
| `catalog_state({})` | 读取所属实例的编号、路由、搜索、详情、选择及修订号 |

这些工具是 [app.js](../../examples/business/app.js) 中的 `ModelContext.defineAction()` 方法，通过 `getAgent().callTool()` 调用 Worker 业务工具，再将结果应用到所属 App。宿主需要将 View 工具路由给模型；多个目录同时打开时，还需选择正确的 View。它们不属于服务端工具发现列表。不要用另一个服务端入口调用来定位旧卡片，宿主可能为其创建新 View。

宿主将后续输入和结果投递到同一个共享 View 时，MCPKit 保留 bundle、导航栈及 App Action，并通过含 `tool`、`input` 的结果事件投递数据。普通页面工具仍使用原有重启语义。共享 View 忽略其他 App 路由的结果。宿主结果通知没有调用编号，无法可靠区分参数相同的重叠通知；并发更新应使用实时 App Action，示例会忽略较早搜索的迟到结果。

宿主提供浏览器 WebMCP 时，View 也会将实时 Ink 注册表投影到 `document.modelContext`（或旧版 navigator 注册表），浏览器 Agent 因而可以发现并调用同一实例的 Action。注册随工具变化及销毁撤销，未变化的 App 工具在页面导航时保持可用。不支持浏览器 API 的宿主保留 MCP Apps 路由，两种路径都不复制 Worker 或业务实现。

目录通过 `_blank` 样式适配展开后的空间：内容居中，放大商品信息，并独立展示选择摘要。窄视口改为纵向面板及操作，较矮视口使用紧凑布局，内嵌卡片保留紧凑商品网格。切换模式或调整尺寸不重置 App 状态。

## 状态归属与隔离

每个 View 拥有独立 App realm。App 保存导航相关状态、搜索结果、详情及选择；页面在显示时挂接，在隐藏或卸载时撤下，返回搜索页时刷新。共享状态不放进模块单例、浏览器存储或无界面 Worker，Worker 不保存用户选择。

新卡片、View、用户和聊天不会自动加入已有实例。即使资源 URI 和服务进程相同，UI 状态仍独立。关闭 View 会销毁 App 并取消实时调用。默认情况下，这种持久性仅限 View 生命周期。需要在支持的宿主中重建时，目录已接入可选的[作用域快照协议](state-restoration.zh-CN.md)，也支持私有草稿；必须提供可信存储适配器，不实现账号认证，也不假设桌面宿主支持持久化。

## 验收

`tests/shared-agent-browser.test.mjs` 使用真实 stdio 服务、Ink WASM、两个同时打开的 View 和另一个浏览器页面，覆盖资源去重、独立契约、搜索/详情/选择、新数据保留状态、返回导航、迟到结果、选择失败、销毁与隔离。`tests/metadata.test.mjs` 覆盖契约绑定到其他 UI 页面及非法注册。

目标客户端需记录版本、SDK 和真实调用：搜索 travel、查看包详情、选择包、停留详情时搜索 lamp，再读取状态。实例编号应相同，详情和选择仍是包，搜索已更新为 lamp。返回搜索页，打开第二个目录，确认其没有选择。浏览器 bridge 测试不证明桌面宿主已向模型路由实时工具；结果见[验收记录](../validation/shared-agent-2026-10-28.md)。
