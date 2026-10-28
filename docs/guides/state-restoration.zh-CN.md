# 恢复具有明确作用域的 App 状态

[English](state-restoration.md) | 简体中文 · [文档目录](../README.zh-CN.md)

在 inline 与 fullscreen 之间切换时，存活的 App 会保留状态；销毁 View 则销毁其运行域。要在新 View 中重建状态，需要显式配置恢复适配器，并接入宿主或应用拥有的存储。恢复能力可选，MCPKit 不假设每个 MCP Apps 宿主都有持久化 API。

## 哪些状态可以保存

| 状态 | 归属与生命周期 |
| --- | --- |
| 请求、信号、定时器、渲染对象、显示模式 | 临时状态，重建时重新初始化，不保存。恢复不会重放业务操作。 |
| 模型可见状态 | 通过 Action 返回值或上下文 API 明确发布；保存快照不会自动发布给模型。 |
| 选择、草稿、经过校验的结果缓存、导航 | 应用选择的 JSON 投影，保存与恢复前均需校验。保存路由和数据，不序列化运行时或整个导航栈。 |

[Business App](../../examples/business/app.js) 按[目录契约](../../examples/business/state-contract.js)保存目录、私有备注和当前页面。`catalog_state` Action 不返回私有备注。恢复完成后才处理新工具结果，因此新的搜索可以更新结果，同时保留选择、备注和详情页。重建恢复最小路由；如果恢复的详情页没有上一页栈项，目录会显式返回搜索页。结果缓存仅用于展示；真正执行业务操作前，应重新校验价格、权限和可用性。

## 在可信侧绑定存储

每个存储能力绑定四个非空标识：`userId`、`conversationId`、`applicationId`、`instanceId`。`applicationId` 必须等于构建时的插件 `name`。可信宿主或后端提供身份，并决定重建的 View 是否属于同一逻辑实例。新卡片通常获得新的实例标识；复用资源 URI 不赋予访问其他实例的权限。

作用域字符串用于命名空间，不等于身份认证。宿主或后端负责认证授权，每个 View 只能拿到已经绑定的 `ScopedSnapshotStore`。不要向 App 暴露可绑定任意作用域的工厂，也不要从工具参数、Page 消息、查询字符串、浏览器存储或模型提供的用户标识取得权限。持久化后端必须在每次读、写、删除时执行授权。

`@yodaos-pkg/aiui-mcpkit/state` 的 `createMemorySnapshotStore()` 是宿主侧参考存储。工厂仅留在可信宿主，`factory.bind(trustedScope)` 返回不可变的能力。只要该工厂仍存活，就能跨 View 销毁保留数据；宿主进程或页面重启后数据消失。需要重启恢复时，请用认证后的持久服务实现 `ScopedSnapshotStore`。

## 配置浏览器适配器

```js
await buildPlugin({
  source: 'examples/business', name: 'business-demo',
  worker: { name: 'business' },
  applications: { catalog: { page: 'pages/catalog/index' } },
  restoration: { adapter: './host/restoration.ts' },
});
```

适配器是浏览器模块，路径相对构建调用者的工作目录解析，最终打包到 `view.html`。模块必须导出 `createRestoration(context)`，且位于输出目录之外。代码和打包常量均公开，凭据应保留在可信服务端。联网适配器还需配置 `uiCsp.connectDomains` 并取得宿主许可。

下面展示接入结构；`openBoundStore` 是应用自己实现的认证宿主桥，**不是** MCPKit API：

```ts
import type { RestorationAdapter } from '@yodaos-pkg/aiui-mcpkit/state';
import { catalogStateContract } from '../examples/business/state-contract.js';
import { openBoundStore } from './authenticated-host-bridge.js';

export const createRestoration: RestorationAdapter = async context => {
  // 宿主桥认证调用者，并分配用户、聊天和实例权限。
  // applicationId 仅用于核对预期应用身份，不是权限凭证。
  const store = await openBoundStore(context.applicationId, context.signal);
  if (!store) return undefined; // 宿主不支持：继续普通临时 UI。
  return { ...catalogStateContract, store };
};
```

完整的跨域测试接入见 [port-adapter.js](../../tests/fixtures/state/port-adapter.js) 和[可信宿主](../../tests/state-browser.test.mjs)。它核对消息来源和窗口，以所属 iframe 而非请求中的身份声明绑定作用域，再传递 MessagePort 能力。测试使用模拟身份和内存存储；部署前必须接入真实宿主认证。标准示例构建有意不启用这个测试适配器。

## 公开快照契约

浏览器侧从 `@yodaos-pkg/aiui-mcpkit/state` 导入；根包也为 Node 调用方导出这些类型和辅助函数。

| 契约 | 字段或方法 |
| --- | --- |
| `RestorationContext` | `applicationId`、`initialPage`、生命周期 `signal` |
| `RestorationBinding` | `store`、正整数 `dataVersion`、`validate(data, page)`、可选 `migrate(payload, from, to)` |
| `SnapshotPayload` | `{ page, data }`；页面必须注册于 `app.json`，data 必须是 JSON 对象 |
| `AgentSnapshot` | `{ formatVersion: 1, dataVersion, scope, payload }` |
| `SnapshotRecord` | `{ revision: string, snapshot }` |
| `ScopedSnapshotStore` | 只读 `scope`；`read({signal})`、`write(snapshot, {expectedRevision, signal})`、`remove({expectedRevision, signal})` |
| `createSnapshotSession(binding, options)` | 每个 View 一个会话，提供 `restore()`、`save(payload)`、`close()`；选项包含预期 `applicationId`、允许的 `pages` 和可选 `timeoutMs`（默认 5000） |

记录不存在时，写入和删除的预期版本为 `null`。存储必须原子比较版本：只接受匹配的 `expectedRevision`，每次成功写入返回新的非空版本；删除后也应避免复用旧版本。并发的旧 View 会失败，不覆盖新 View。读写采用独立 JSON 副本。会话串行保存、冻结作用域，遇到存储失败或冲突后禁用后续写入。非法应用数据在写入前被拒绝。

投影与封装限制为 256 KiB UTF-8 JSON，嵌套深度不超过 64。仅接受普通 JSON 值，不接受函数、信号、循环引用、数组空洞、访问器、symbol、非有限数字或原型操作键。应用验证器还应严格限制字段、长度及页面与数据的一致性。内存存储将包含 revision 的整条记录也限制为同样大小，因此应为元数据留出余量。

## 先恢复，再接收新结果

View 在启动 Ink 前初始化适配器并读取快照。适配器初始化以及每次存储、迁移操作均有五秒期限。存储必须在提交前遵守中止信号；后端若忽略取消，MCPKit 无法撤销已提交的远程写入。

Page 将恢复消息交给所属 App，握手顺序如下：

1. Page 在 onShow 中挂接 App 后发送 `{ type: 'mcpkit:state-connect' }`。
2. View 发送 `{ type: 'mcpkit:restore-state', restoreId, supported, snapshot? }`；`snapshot` 是经过验证的 `{page, data}`，不含身份或存储凭据。
3. App 应用投影后发送 `{ type: 'mcpkit:state-ready', restoreId }`。
4. 状态变更时发送 `{ type: 'mcpkit:state-save', restoreId, page, data }`。
5. View 回复 `{ type: 'mcpkit:state-status', restoreId, status, code? }`，不回传快照内容。

随机 `restoreId` 将消息绑定到本次启动，旧标识会被忽略。只有确认恢复的启动才能保存；五秒内没有确认时，正常工具结果继续传递，但保存仍被禁用。Page 在消息中增加身份字段不能改变存储作用域。状态消息在调试日志之前被消费，不进入模型上下文；App 仍能通过自身 Action 发布数据，应明确选择公开投影。

每次有意义的变化都应建立检查点。写入未完成时状态为 `saving`，只有最新提交的检查点完成后才发出 `saved`；它不代表后续变化也已保存。MCP teardown 会在销毁 View 前排空已排队的保存。`pagehide`、进程突然退出和崩溃不能保证最后一次未确认的编辑完成。跨宿主生命周期恢复还需要持久化后端。

## 版本、失败和不支持恢复的宿主

封装格式版本为 1，应用投影单独使用 `dataVersion`。用户、聊天、应用或实例不匹配会被拒绝。旧数据必须显式实现 `migrate(payload, from, to)`；MCPKit 校验迁移结果，用读到的版本提交后才使用。更高的数据版本、未知封装格式、损坏数据和迁移失败均拒绝恢复，不覆盖旧记录。授权用户可以通过所属存储的 `remove` 和当前 revision 主动重置记录，没有静默删除的降级行为。

没有适配器或适配器返回 `undefined` 时，普通临时 UI 继续工作。读取或初始化失败时拒绝恢复，继续正常 UI，且不覆盖现有记录。写入失败会报告错误并停止会话后续写入。诊断仅提供错误码，不暴露后端消息或私有数据。

View 的 `body[data-restoration]` 可为 `unavailable`、`empty`、`restored`、`ready`、`saving`、`saved`、`rejected`、`error`；失败增加 `data-restoration-error`，例如 `SCOPE_MISMATCH`、`VERSION_UNSUPPORTED`、`INVALID_DATA`、`CONFLICT`、`TIMEOUT`、`RESTORE_NOT_HANDLED`。中间状态可能短暂出现，持久化检查应以写入确认作为边界。

Counter 有意保持临时状态，不再从应用级 `wx` 存储恢复无作用域的计数，也不导入旧缓存。共享目录示例展示完整的显式恢复协议。

## 验证边界

[验收记录](../validation/state-restoration.md)覆盖真实 Ink/WASM 重建、草稿输入、选择与导航恢复、显示模式、隔离、迁移、冲突及无可用存储的情况。测试使用应用拥有的测试宿主，不是 Codex Desktop 持久化验收。MCPKit 没有通用的 Codex/Claude 快照存储；生产环境需要宿主或认证后的应用接入，并在目标环境另行验收。
