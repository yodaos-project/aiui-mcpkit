# AIUI MCPKit

[English](README.md)

这是一个最小可行性原型：通过 [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) 展示由 **Ink Web 0.18 + WASM 真正渲染**的可点击计数器。视图默认 inline，支持向具备能力的宿主请求 fullscreen，再返回 inline。布局以宿主返回的实际模式为准。此项目暂时只有一个示例，不是完整框架。

## 在支持本地插件的桌面宿主加载

在运行桌面宿主的**同一台电脑**安装 Node.js 22+，并使用支持本地插件 marketplace 与 MCP Apps 的宿主版本。在有权访问此私有仓库的电脑上从干净克隆开始：

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
```

**桌面 GUI 路径（无需 shell 中有 `codex` 命令）：**在支持仓库插件的桌面宿主中把此目录作为本地项目打开，重启应用，在 Plugins 中查找 **AIUI MCPKit**。已提交的 [仓库 marketplace](.agents/plugins/marketplace.json) 指向[完整插件包](plugins/aiui-mcpkit/)。[OpenAI 本地插件说明](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually)明确给出了 ChatGPT 桌面版的仓库 marketplace 与重启流程；并非所有 Codex 桌面版本的同一路径都经过本项目验证。

**可选的 Codex CLI 路径：**安装桌面应用不代表终端的 PATH 中已有 `codex`。如果命令存在，先检查当前版本支持 `plugin` 子命令：

```sh
codex plugin --help
codex plugin marketplace add .
codex plugin add aiui-mcpkit@aiui-mcpkit-local
```

如果找不到 `codex`，可走 GUI 路径，或按 [OpenAI 官方 Codex CLI 安装说明](https://developers.openai.com/codex/cli)单独安装；如果 `codex plugin --help` 不可用，先更新 CLI。重启桌面应用，在 Plugins 中启用 **AIUI MCPKit**，然后输入“打开 AIUI 计数器”。`open_counter` 工具提供交互视图。点击 **+ Add one**、**Fullscreen**、**Inline** 检查效果。宿主不声明 fullscreen 能力时按钮禁用；宿主拒绝切换时保持其确认的模式。桌面宿主可能把 fullscreen 显示为侧栏，而非占满整个显示器。

[mcp.json](plugins/aiui-mcpkit/mcp.json) 使用 `${PLUGIN_ROOT}` 下的 `dist/server.mjs` 启动本地 stdio MCP 服务。已构建的插件包不需 npm 安装、网页服务、隧道、凭据或外部资源请求。纯浏览器版 ChatGPT 不能直接启动这个本地 stdio 包。如果当前 ChatGPT 版本没有本地插件 marketplace 或 MCP App 视图，请换用支持它们的桌面版/Codex GUI；本仓库尚未在真实 ChatGPT 宿主验证。

## 开发与验证

```sh
npm ci
npm run typecheck
npm run build
npm test
```

`npm run build` 将 `.ink` 页面和压缩后的非共享浏览器 WASM 内嵌进单个本地 HTML 资源，同时将 Node MCP 服务打包到 `plugins/aiui-mcpkit/`。修改源码后应重新构建并重新安装。`npm test` 需要 `/usr/bin/chromium`，通过 MCP Apps `AppBridge` 测试宿主实际运行 WASM、画布输入、尺寸变化、接受/拒绝/不支持的模式请求、切换后的状态，以及禁止外部连接的 CSP；另有 stdio 工具与资源测试。这是测试宿主，不等同于 ChatGPT 桌面验证。

Ink 页面在 [ink/pages/counter/index.ink](ink/pages/counter/index.ink)。可用时通过 Ink 的 `wx` 存储保存计数；切换模式时保留同一个视图并调整 viewport。MCP 服务 stdout 仅输出协议数据。UI 资源不声明外部连接或资源域名；JS、Ink 资源和 WASM 均在本地。当前 HTML 正文为 9,571,548 字节，完整 stdio `resources/read` JSON 响应行为 9,610,758 字节。没有查到 ChatGPT 桌面版针对此资源公布的大小上限，因此仍需在真实宿主确认能否接收。宿主的沙箱 CSP 也必须允许本地 WebAssembly 编译；测试宿主允许 `wasm-unsafe-eval`。

## 验证边界

- 已在云端 Linux 环境通过 `npm run typecheck`、`npm run build`、`npm test`（4 项），并用隔离的 Codex CLI 配置完成本地 marketplace 安装。
- 尚需在真实 ChatGPT 桌面版/Codex GUI 核对插件发现、视图位置、实际 CSP/资源上限与模式切换。没有在用户 Mac 上安装或测试。仓库已提交构建好的完整插件包，本地安装**不需要**先运行 `npm ci` 或 `npm run build`。
- Claude Desktop 和其他 MCP Apps 宿主可作为后续目标；本版本未测试其兼容性。

参考：[MCP Apps 规范](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx)、[OpenAI 插件打包与本地 marketplace](https://developers.openai.com/plugins/build/plugins)、[Ink Web SDK](https://www.npmjs.com/package/@yodaos-pkg/ink)。
