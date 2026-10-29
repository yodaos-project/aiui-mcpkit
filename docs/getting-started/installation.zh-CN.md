# 准备开发环境

[English](installation.md) | 简体中文 · [学习路线](../README.zh-CN.md)

**目标：** 准备第一个浏览器预览需要的工具。macOS、Linux、Windows 均可，Node.js 需要 22 或更新版本。

## 1. 安装必需工具

| 工具 | 用途 | 在终端中检查 |
| --- | --- | --- |
| [Node.js 22+](https://nodejs.org/en/download) | 运行构建脚本；自带安装依赖的 npm。 | `node --version` 和 `npm --version` |
| [Git](https://git-scm.com/downloads) | 下载项目。 | `git --version` |
| 浏览器与文本编辑器 | 显示预览、编辑文件。 | 使用你熟悉的浏览器和编辑器即可。 |

**终端**是输入命令的窗口：macOS 可以用“终端”，Linux 可以用终端应用，Windows 可以用 PowerShell。编辑器内置的终端也可以。将 shell 代码块逐行粘贴到这里执行。

运行：

```sh
node --version
npm --version
git --version
```

Node 应显示 `v22` 或更高的主版本。如果安装后提示找不到命令，关闭终端重新打开，再试一次。

## 2. 下载项目

先进入你平时保存项目的目录，然后运行：

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
npm ci
```

`cd` 表示进入项目文件夹，`npm ci` 会按锁文件安装依赖。等它正常结束后再继续。

已经下载过项目？直接在该文件夹打开终端，执行 `npm ci`，跳过 clone。教程中的**仓库根目录**指包含 `package.json`、`scripts/`、`examples/`、`docs/` 的这一层目录；没有特别说明时，命令都在这里执行。

**完成检查：** 版本检查正常，`npm ci` 成功结束。接着做[快速开始的第 2 步](quickstart.zh-CN.md#2-打开预览)。

## 用到时再安装其他工具

| 之后要做的事 | 额外需要什么 |
| --- | --- |
| 在 AI 对话中使用应用 | 支持 MCP Apps 与 WASM 的客户端，见[客户端接入](../guides/clients.zh-CN.md)。 |
| 安装 Codex 插件 | 提供 `codex plugin --help` 命令的 Codex CLI。 |
| 自动验证浏览器效果 | Playwright 与 Chromium，见[预览验证](../guides/preview-verification.zh-CN.md)。 |
| 使用可选的 Agent Worker 执行方式 | 已配置的 Worker 宿主，见[业务工具](../guides/business-tools.zh-CN.md)。 |

第一个预览不需要 AI 账号、API Key、插件安装、原生 Worker 或 Rust 工具链。

**下一步：** [在浏览器中打开 Counter](quickstart.zh-CN.md#2-打开预览)。安装失败时，先看[故障排查](../guides/troubleshooting.zh-CN.md)。
