# 准备开发环境

[English](installation.md) | 简体中文 · [文档目录](../README.zh-CN.md)

本教程从本地仓库开始，确保你能构建库并运行全部示例，不依赖“npm 上已经发布这个版本”的假设。命令在终端中执行，不是输入到 AI 对话框。会创建文件、编辑 JSON 就可以开始。

## 需要哪些工具

| 工具 | 用途 | 检查命令 |
| --- | --- | --- |
| Node.js **22 或更新版本**与 npm | 构建项目、运行生成的服务 | `node --version`、`npm --version` |
| Git | 下载仓库 | `git --version` |
| 文本编辑器 | 编辑 `app.json`、`.ink` 和 handler | 任意编辑器；后续 TypeScript 支持会有帮助 |
| MCP 客户端 | 调用工具；显示界面还需支持 Apps | 见[客户端接入](../guides/clients.zh-CN.md) |
| 支持插件命令的 Codex CLI | 仅 Codex 插件安装路径需要 | `codex plugin --help` |
| Playwright 的 Chromium | 仅浏览器测试和 benchmark 需要 | 按[贡献指南](../contributing.zh-CN.md)安装 |

从 [Node.js](https://nodejs.org/en/download) 和 [Git](https://git-scm.com/downloads) 安装对应工具。安装后仍提示找不到命令时，重新打开终端。桌面应用的 `PATH` 可能与终端不同，必要时使用 Node 可执行文件的绝对路径。

## 下载并安装依赖

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
node --version
npm ci
npm run build:examples
```

`npm ci` 按锁文件安装依赖；`build:examples` 先构建 ESM 库，再构建两个示例。后续教程默认继续在仓库根目录执行命令。

完成后应有这些目录：

```text
aiui-mcpkit/
├── dist/                         # 构建后的库和示例
│   └── examples/
│       ├── counter/
│       ├── business/
│       └── .agents/plugins/marketplace.json
├── examples/                     # 可以编辑的示例源码
├── scripts/                      # 仓库开发辅助脚本
└── docs/                         # 当前文档
```

`.agents` 在某些文件管理器中属于隐藏目录，普通列表看不到并不代表构建失败。

## 分清三个目录

- **源码目录：** 编辑 `examples/counter/` 或你自己的 Agent 目录。
- **构建目录：** 构建器生成 `dist/examples/counter/`，重新构建会替换产物，应修改源码。
- **已安装插件目录：** 客户端可能把产物复制到缓存。只重新构建不会同步那份缓存，详见[开发迭代](../guides/development.zh-CN.md)。

## 在自己的 Node 项目中使用

Agent 不必放在本仓库里。先用 `npm pack` 生成本地包，在自己的项目安装 tarball，再从 ESM 脚本调用 `buildPlugin()`。完整文件和操作见 [ESM 接入](../guides/esm-build.zh-CN.md)。仓库辅助脚本不是全局安装的 CLI。

## 完成检查

`npm run build:examples` 正常结束，而且 `dist/examples/counter/dist/server.mjs` 存在，就可以继续[运行示例](quickstart.zh-CN.md)。安装和启动异常请查[故障排查](../guides/troubleshooting.zh-CN.md)。

---

[文档目录](../README.zh-CN.md) · 上一篇：[认识 MCPKit](overview.zh-CN.md) · 下一篇：[运行示例](quickstart.zh-CN.md)
