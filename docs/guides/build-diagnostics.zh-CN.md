# 构建标识与旧视图诊断

[English](build-diagnostics.md) | 简体中文 · [学习路线](../README.zh-CN.md)

**适用场景：** 源码已保存并重建，客户端却仍显示旧应用或旧工具定义。

**开始前：** 先看[源码、构建与安装副本的更新流程](development.zh-CN.md)。build ID 是生成版本的指纹，先比较各份副本，再处理缓存。

每次构建生成 `build.json` 和由内容决定的 SHA-256 构建 ID，覆盖源码、打包后的运行时与依赖、配置以及服务端和视图载荷。相同输入构建到不同输出目录时 ID 相同；源码、配置或运行时变化会产生新 ID。插件 `version` 仍是单独指定的发布版本，不要求时间戳或 Git 仓库。

## 逐层检查

| 层次 | 证据 |
| --- | --- |
| 源码与构建产物 | `result.build`、`result.files.build` 或 `build.json`。`inspectBuild(directory, true)` 比较源码与依赖哈希、源码文件的新增删除以及产物字节。 |
| 安装文件 | `inspectBuild(installedDirectory)` 按安装目录的 `build.json` 校验文件哈希。只复制清单不足以证明更新成功。 |
| 运行中的服务 | 实际 `tools/list`、`resources/list`、工具结果和资源内容的 `_meta.mcpkit.build`。必须观察客户端响应；新启动的 stdio 进程不能证明客户端原进程的版本。 |
| 返回的 HTML | 生成资源的 `resources/read` 内容包含 `_meta.mcpkit.viewBuildId`，从实际 HTML 提取。更新不完整时，它可能与服务进程的 ID 不同。 |
| 已加载的生成视图 | `document.querySelector('meta[name="mcpkit-build-id"]').content` 或 `document.body.dataset.mcpkitBuildId`。收到工具结果后，`mcpkitServerBuildId` 和 `mcpkitBuildState`（`current`/`mismatch`）比较该响应和当前文档；之前为 `unknown`。 |

这些标记不会在业务界面显示开发信息。自定义 `uiResources[].html` 原样返回：响应包含服务构建信息；除非作者提供构建标记，否则 `viewBuildId` 为 `null`，已加载文档的诊断由作者管理。本地来源路径和哈希只写入 `build.json`；MCP 和生成 HTML 仅公开构建身份，不包含源码路径或内容。来源路径敏感时应将清单留在本地。

`inspectBuild()` 是一致性检查，不是签名或防篡改证明。安装目录的预期修改（例如 `mcp.json` 的环境变量覆盖）也会被报告为产物变化，更新前先检查差异。

## 运行诊断

先构建库和示例，再执行只读诊断；该命令不会重新构建或更新安装目录：

```sh
npm run diagnose:examples -- --example counter --plugin-dir /absolute/path/to/installed/ink-counter
```

不传 `--plugin-dir` 时检查 `$CODEX_HOME/plugins/cache/aiui-mcpkit-examples`（默认 `~/.codex`）中的当前版本和 `local` 目录。其他注册方式，包括旧的 `ink-counter-local` 市场，需要传入实际安装路径。两个位置同时存在时分别检查。默认位置未安装会明确报告；显式路径错误会失败。

传入从实际桌面工具响应和文档读取的 ID：

```sh
npm run diagnose:examples -- --example counter \
  --plugin-dir /absolute/path/to/installed/ink-counter \
  --server-build SERVER_ID --view-build VIEW_ID --existing-card
```

仅在实际打开新卡片后使用 `--new-card`。两者都不传时，旧视图的原因保持未知。缺少观察值会报告 `SERVER_NOT_OBSERVED` / `VIEW_NOT_OBSERVED`，不能据此断言缓存。脚本不会连接或重启桌面服务。

自建 Agent 使用相同 API：

```js
import { inspectBuild, diagnosePlugin } from '@yodaos-pkg/aiui-mcpkit';
console.log(await inspectBuild('./dist/my-agent', true));
console.log(await diagnosePlugin({
  buildDir: './dist/my-agent', installedDir: '/absolute/path/to/installed/my-agent',
  serverBuildId: 'observed-server-id', viewBuildId: 'observed-document-id', newCard: true,
}));
```

## 按证据处理

| 诊断 | 下一步 |
| --- | --- |
| `REBUILD_REQUIRED` | 从变化后的源码或依赖重新构建；没有诊断清单的旧产物也需要重建。 |
| `BUILD_ARTIFACTS_MODIFIED` | 重新生成不一致的产物，不要只复制 `build.json`。 |
| `INSTALL_UPDATE_REQUIRED` | 更新实际配置的安装目录，包括 UI、服务、清单和 Worker 文件。 |
| `SERVER_RELOAD_REQUIRED` | 更新磁盘文件后重载客户端 MCP 连接或服务。 |
| `EXISTING_CARD` | 打开新卡片。旧视图保留原来的文档和运行中 App。 |
| `VIEW_STALE` | 先检查新卡片，再判断原因。 |
| `HOST_CACHE_SUSPECTED` | 服务和文件一致，但新卡片文档不同。检查重复注册和客户端缓存、重载行为。这只是推测，不能证明宿主缓存内部状态。 |
| `SOURCE_UNAVAILABLE` | 当前机器无法访问原始来源路径。在源码机器验证或重建；仍可校验安装文件字节。 |
| `CURRENT` | 源码、产物以及所有已提供的观察值一致；未提供的桌面观察值不会被当作已验证。 |

`npm run update:examples` 先重建、校验再复制，最后写入 `build.json`，让部分更新仍可被检测。单独运行 `node scripts/update-examples.mjs` 会拒绝过期源码或产物。更新助手不会清理宿主缓存、替换运行中的 App 或重启宿主。[桌面更新实验](../validation/build-diagnostics-2026-10-28.md)记录实际观察和限制。

## 稳定资源 URI 与升级

生成地址不随构建 ID 或发布版本变化：

- 回退入口：`ui://<plugin-name>/app.html`。
- 页面工具：`ui://<plugin-name>/<tool-name>.html`。
- 共享 App：`ui://<plugin-name>/applications/<application-id>.html`。
- 显式 `toolMetadata` / `uiResources` 使用作者提供的原始地址。

不会在地址附加哈希、版本或查询参数。引入诊断保留现有引用和 `ui/resourceUri` 别名。没有构建标记的旧安装、旧视图仍可使用；诊断将证据标记为旧版或未观察，不会推测 ID。

重命名插件、工具、application 或删除资源会改变公共地址。兼容升级应在增加新入口时保留原标识和资源；作者管理的 HTML 可用 `uiResources` 保留旧地址，通过 `toolMetadata` 选择新入口。生成 App 应继续注册原工具或 application，作为迁移期间的旧路由。必须移除旧地址时，先记录旧、新 URI 映射，更新客户端或插件注册，重载发现并打开新卡片。框架无法迁移或强制刷新已有卡片。新 ID 用于识别构建，不负责使宿主缓存失效，也不代表语义 API 兼容性。

**按需继续：** [按现象继续排查](troubleshooting.zh-CN.md)。
