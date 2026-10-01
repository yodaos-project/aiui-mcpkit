# AIUI MCPKit

**让 AIUI Agent 在 AI 客户端里成为可点击、可操作的应用。**

MCPKit 将 [AIUI Agent](https://github.com/yodaos-project/AIUI) 页面、Ink WebAssembly 运行时与本地 MCP 服务打包在一起。兼容 MCP Apps 的客户端可以展示交互界面，AI 使用工具返回的数据，用户直接操作按钮和状态。

[English](README.md) · [完整文档与教程](docs/README.zh-CN.md) · [快速开始](docs/getting-started/quickstart.zh-CN.md)

## 能做什么

- 从页面 schema 生成 MCP 工具，按工具打开对应页面。
- 用 TypeScript handler 实现业务工具，生成输入/输出类型并验证运行时结果。
- 处理进度、取消、超时和受控重试。
- 配置公开元数据、自定义 UI 资源，检查最终协议内容。
- 从 ESM API 构建完整插件目录，支持 Codex 插件安装或客户端直接连接 stdio 服务。

## 快速体验

需要 **Node.js 22+**、Git，以及支持 MCP Apps 的客户端。以下命令在终端执行：

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
npm ci
npm run build:examples
```

使用支持插件命令的 Codex CLI 安装示例：

```sh
codex plugin marketplace add ./dist/examples
codex plugin add ink-counter@aiui-mcpkit-examples
codex plugin add business-demo@aiui-mcpkit-examples
```

重启桌面宿主并确认工具已进入当前会话。让客户端以 `{ "initialCount": 5, "label": "Demo" }` 调用 `open_counter`，点击 **+ ADD ONE** 后应变成 6。

完整步骤、业务示例和预期结果见[快速开始](docs/getting-started/quickstart.zh-CN.md)。Claude Desktop、VS Code 和其他客户端见[接入指南](docs/guides/clients.zh-CN.md)。

## 文档与教程

| 你想做什么 | 从这里开始 |
| --- | --- |
| 第一次接触 MCP / AIUI | [认识 MCPKit](docs/getting-started/overview.zh-CN.md) · [准备环境](docs/getting-started/installation.zh-CN.md) |
| 写第一个可操作页面 | [创建第一个 Agent](docs/getting-started/first-agent.zh-CN.md) |
| 给 AI 提供工具和业务数据 | [页面工具](docs/guides/page-tools.zh-CN.md) · [业务工具](docs/guides/business-tools.zh-CN.md) |
| 接入构建系统或查 API | [ESM 接入](docs/guides/esm-build.zh-CN.md) · [构建 API](docs/reference/build-api.zh-CN.md) |
| 更新插件或定位问题 | [开发迭代](docs/guides/development.zh-CN.md) · [故障排查](docs/guides/troubleshooting.zh-CN.md) |
| 确认兼容性或测量性能 | [协议兼容性](docs/reference/compatibility.zh-CN.md) · [性能基准](docs/reference/benchmarks.zh-CN.md) |

[查看全部文档](docs/README.zh-CN.md)，包括元数据、请求生命周期和页面消息参考。

## 开发与贡献

```sh
npm run build:examples
npx playwright install chromium
npm run typecheck
npm test
```

项目当前生成本地 stdio 服务，显示 UI 需要 Apps/WASM 支持。实际宿主验证范围见[兼容性说明](docs/reference/compatibility.zh-CN.md)，贡献流程与 benchmark 检查见[贡献指南](docs/contributing.zh-CN.md)。

[提交 Issue](https://github.com/yodaos-project/aiui-mcpkit/issues) · [探索 AIUI](https://github.com/yodaos-project/AIUI)
