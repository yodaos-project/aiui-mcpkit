# 修改、重建、迭代

[English](development.md) | 简体中文 · [文档目录](../README.zh-CN.md)

**前置条件：** 已构建的示例和已接入的客户端。以下命令在仓库根目录执行。

## 选择正确的更新路径

| 接入方式 | 修改源码后怎么做 |
| --- | --- |
| Codex 安装的仓库示例 | `npm run update:examples`，重载宿主或服务，打开新卡片。 |
| 直接注册的示例服务 | `npm run build:examples`，重载服务，打开新界面。 |
| 自己的 Agent | 重新执行辅助脚本或 ESM 构建，同步或重装已安装副本，重载并打开新界面。 |
| 修改库或运行时源码 | 打包前先构建库；`build:examples` 会完成两者。 |

修改 handler schema 后，先重新生成类型声明再检查类型。已打开的界面可能在重载服务后仍保留旧代码，验证新构建时打开新卡片。

修改 [Counter 页面](../../examples/counter/pages/counter/index.ink)、[业务页面](../../examples/business/pages/order/index.ink) 或其[处理器](../../examples/business/mcp-server/handlers.ts)，然后运行：

```sh
npm run update:examples
```

该命令在共享 marketplace 中重建两个示例，并为每个已安装插件更新 `view.html`、`dist/server.mjs`、`plugin.json` 和 `mcp.json`。重载 MCP 服务端或桌面宿主，并打开**新卡片**以使用更新后的界面和处理器。已有卡片保留当前视图。

脚本使用 `$CODEX_HOME`，默认为 `~/.codex`，检查 `plugins/cache/aiui-mcpkit-examples` 下对应版本及 `local` 目录。未安装的示例会跳过；一个都未安装时会报错。更新自定义安装路径中的单个示例：

```sh
npm run update:examples -- --example business --plugin-dir /absolute/path/to/installed/business-demo
```

未指定 `--example` 时，`--plugin-dir` 指向 marketplace 缓存目录，其中包含 `ink-counter/<version-or-local>` 和 `business-demo/<version-or-local>`。直接配置 MCP 的客户端在重建后会获得注册路径中的新服务端文件，需要通过客户端重载服务端。

在终端启动单个 stdio 服务端时，使用 `npm run start:examples`，默认选择 Counter，或使用 `npm run start:examples -- business`。同一 marketplace 中的两个插件各自保留独立服务端。

---

[文档目录](../README.zh-CN.md) · 上一篇：[客户端接入](clients.zh-CN.md) · 下一篇：[故障排查](troubleshooting.zh-CN.md)
