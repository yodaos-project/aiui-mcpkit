# 修改、重建、迭代

[English](development.md) | 简体中文 · [文档目录](../README.zh-CN.md)

**前置条件：** Node 22+ 和已安装的仓库依赖。更新已安装插件还需要接入客户端。以下命令在仓库根目录执行。

## 本地监听与自动刷新

```sh
npm run watch:examples -- counter --input '{"initialCount":5}'
# 或：npm run watch:examples -- business
```

打开输出中的本机 URL。Agent 编辑会触发完整构建，成功后通过真实 MCP Apps bridge 和 Ink/WASM 自动替换预览 iframe。这些独立插件位于 `dist/watch/<example>`，不会更新已安装的 marketplace 副本。在浏览器打开 URL 无需浏览器自动化依赖。预览仅提供启动参数与显示上下文；业务或宿主工具服务仍需要集成测试宿主。

自己的 Agent 先构建库，再从任意工作目录运行辅助 CLI：

```sh
node /path/to/aiui-mcpkit/scripts/build-plugin.mjs ./agent --name my-agent --watch \
  --out ./dist/my-agent --port 4173 --input '{"recordId":"42"}'
```

`--no-preview` 仅监听与构建，不启动预览服务。Ctrl+C/SIGTERM 停止轮询并等待丢弃正在执行的构建。监听器管理整个输出目录，该目录必须为空或包含同名的已构建插件；其他文件应放在别处。`typesFile` 必须位于输出目录内，以便声明和产物一起发布。

ESM API 提供相同流程，不输出日志、不更改工作目录：

```js
import { watchPlugin } from '@yodaos-pkg/aiui-mcpkit';
const watcher = await watchPlugin({
  source: './agent', name: 'my-agent', outputDir: './dist/my-agent',
  preview: { input: { recordId: '42' }, displayMode: 'fullscreen' },
  pollInterval: 200, debounce: 100,
  watchPaths: ['./shared'], // 可选的外部文件或目录
  onEvent(event) {
    console.log(event.sequence, event.phase, event.build?.id, event.diagnostics);
  },
});
console.log(watcher.previewUrl, watcher.state);
// await watcher.rebuild(); // 完整重建，等待队列中的编辑处理结束
// await watcher.close();
```

`watchPlugin()` 在首次构建尝试后返回，首次失败也保留会话以便修复后恢复。`state` 和 `onEvent` 提供独立快照。阶段为 `building`、`ready`、`failed`、`superseded`、`closed`。`sequence` 标识构建尝试；`build.id` 始终标识最近成功发布的产物。诊断包含源码路径，并在可用时提供行列号。失败后的首次成功标记为 `recovered: true`。浏览器状态栏和 CLI JSON 事件展示相同信息。

内容轮询覆盖编辑器原子保存、文件新增与删除，`debounce` 在启动前合并编辑。构建串行写入暂存目录，发布前发现源码或依赖变化就丢弃旧尝试。失败或过时构建保留成功产物与运行中的预览；成功后整代替换输出，包括 Worker 文件。发现的 esbuild 本地传递依赖也会纳入监听；首次成功前需要监听的外部文件或目录通过 `watchPaths` 指定。`node_modules` 中的依赖包变化需要显式重建或重启。修改库的 `src/` 后，执行 `npm run build` 并重启监听器，加载更新的 ESM 和运行时模板。

### 刷新动作与状态

| 变更 | 本地预览 | 外部宿主动作 |
| --- | --- | --- |
| 页面、CSS、图片、App 代码或浏览器适配器 | 加载新 View | 更新安装副本、重载 MCP 连接以刷新构建元数据，再打开新卡片 |
| 服务端 handler、其导入模块或 Worker 代码（含可能的共享 JS/JSON 依赖） | 加载新 View | 更新安装副本、重启 MCP 服务端，再打开新卡片 |
| `app.json` 或页面工具 schema、元数据 | 加载新 View | 更新安装副本、重载插件或 MCP 连接、重新发现工具与资源，再打开新卡片 |

每次成功的新构建都会重载本地 iframe。**App/Page 内存状态与导航重置**，重新发送配置的启动参数。同一预览源的浏览器存储保留；显式配置的恢复适配器仍可按自身作用域恢复状态。此流程不保留运行中的模块状态。构建失败时当前预览及其状态继续运行。

成功后的 `state.action` 为 `reload-view`、`restart-server` 或 `refresh-manifest`，构建中和失败时为 `none`；`hostSteps` 提供手动步骤。监听器不会重启真实宿主的 stdio 连接、复制安装副本或绕过宿主缓存。更新后将实际服务响应的 `_meta.mcpkit.build.id` 和已加载 View 标记与成功构建 ID 比较。新卡片仍过时时，通过[构建诊断](build-diagnostics.zh-CN.md)检查连接与宿主资源缓存。本地刷新不能证明桌面客户端或模型行为。

## 选择正确的更新路径

| 接入方式 | 修改源码后怎么做 |
| --- | --- |
| Codex 安装的仓库示例 | `npm run update:examples`，重载宿主或服务，打开新卡片。 |
| 直接注册的示例服务 | `npm run build:examples`，重载服务，打开新界面。 |
| 自己的 Agent | 重新执行辅助脚本或 ESM 构建，同步或重装已安装副本，重载并打开新界面。 |
| 修改库或运行时源码 | 打包前先构建库；`build:examples` 会完成两者。 |

修改 handler schema 后，先重新生成类型声明再检查类型。已打开的界面可能在重载服务后仍保留旧代码，验证新构建时打开新卡片。

修改 [Counter 页面](../../examples/counter/pages/counter/index.ink)、[业务页面](../../examples/business/pages/order/index.ink) 或其 [Worker Action](../../examples/business/workers/business.js)，然后运行：

```sh
npm run update:examples
```

该命令在共享 marketplace 中重建全部示例，为每个已安装插件更新 `view.html`、`dist/server.mjs`、`plugin.json`、`mcp.json` 和 `build.json`，并同步 Business Demo 的 `worker-app/`。重载 MCP 服务端或桌面宿主，并打开**新卡片**以使用更新后的界面和 Worker Action。已有卡片保留当前视图。业务调用需要服务进程通过 PATH 或 `INK_WORKER_BIN` 找到 `ink-worker`。

脚本使用 `$CODEX_HOME`，默认为 `~/.codex`，检查 `plugins/cache/aiui-mcpkit-examples` 下对应版本及 `local` 目录。未安装的示例会跳过；一个都未安装时会报错。更新自定义安装路径中的单个示例：

```sh
npm run update:examples -- --example business --plugin-dir /absolute/path/to/installed/business-demo
```

未指定 `--example` 时，`--plugin-dir` 指向 marketplace 缓存目录，其中包含 `ink-counter/<version-or-local>` 和 `business-demo/<version-or-local>`。直接配置 MCP 的客户端在重建后会获得注册路径中的新服务端文件，需要通过客户端重载服务端。

在终端启动单个 stdio 服务端时，使用 `npm run start:examples`，默认选择 Counter，或使用 `npm run start:examples -- business`。同一 marketplace 中的插件各自保留独立服务端。

运行 `npm run diagnose:examples -- --example counter --plugin-dir /absolute/path/to/installed/ink-counter`，可在不修改文件的情况下比较源码、构建和安装字节。实际服务与视图 ID、缓存诊断及 URI 升级规则见[构建诊断](build-diagnostics.zh-CN.md)。更新助手不会重启服务或清理宿主缓存。

---

[文档目录](../README.zh-CN.md) · 上一篇：[客户端接入](clients.zh-CN.md) · 下一篇：[故障排查](troubleshooting.zh-CN.md)
