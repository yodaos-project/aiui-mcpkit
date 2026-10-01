# 选择客户端

[English](clients.md) | 简体中文 · [文档目录](../README.zh-CN.md)

先按[环境准备](../getting-started/installation.zh-CN.md)构建示例，再进行以下操作。把所有 `/absolute/path/...` 占位路径替换为实际路径，保留客户端其他配置。注册服务只是让客户端能够连接，测试界面前还要确认当前会话已发现工具。

**能调用 MCP 工具，不等于能展示界面。** 客户端还需要支持 MCP Apps UI。当前构建使用 **stdio**：由客户端启动本地 Node.js 进程，通过标准输入和输出与它通信。

| 客户端 | 接入方式 | 当前可预期的效果 |
| --- | --- | --- |
| Codex 桌面版 | 安装本地插件 | 已观察到 Counter 内联界面；全屏经过浏览器测试 |
| Codex CLI | 本地插件或直接注册 MCP | 安装与终端工具调用；图形界面使用桌面版 |
| Claude Desktop | 配置本地 MCP 服务 | 官方列为 MCP Apps 宿主；本项目界面尚未实测 |
| VS Code / Copilot Chat | 工作区 MCP 配置 | 官方文档提供 MCP Apps 支持；本项目界面尚未实测 |
| 其他本地 MCP Apps 客户端 | 按客户端格式配置 stdio | 需要兼容的 UI 沙箱和资源大小限制 |
| 远程或仅支持 HTTP 的客户端 | 额外提供 HTTP 服务传输层 | MCPKit 目前不生成此类服务 |

## Codex 桌面版

按照[示例教程](../getting-started/quickstart.zh-CN.md)安装本地插件，再在桌面版中打开。入口位置、本地工具能否用于当前对话，取决于应用版本和对话类型。详见官方[本地插件安装指南](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually)。

## Codex CLI

CLI 用于安装插件和调用工具。安装后开启一个新的 CLI 会话，让它调用 `open_counter`。打开工具会返回文字响应；操作图形界面需要使用桌面版。

如果只需要直接连接 MCP 服务，可以用下面的命令**替代**插件安装命令：

```sh
codex mcp add aiui-counter -- node /absolute/path/to/aiui-mcpkit/dist/examples/counter/dist/server.mjs
```

选择一种注册方式，避免出现重复工具。详见官方 [MCP 配置指南](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。

## Claude Desktop

Claude Desktop 位于官方 [MCP Apps 宿主列表](https://modelcontextprotocol.io/extensions/apps/overview)中，SDK 也提供[本地 stdio 接入说明](https://github.com/modelcontextprotocol/ext-apps#with-mcp-clients)。生成的服务遵循这套连接方式，完整界面仍需要在 Claude Desktop 中实测。

构建示例后，把下面的配置合并到 `claude_desktop_config.json`。将占位路径替换为仓库的绝对路径，并保留已有服务配置：

```json
{
  "mcpServers": {
    "aiui-counter": {
      "command": "node",
      "args": ["/absolute/path/to/aiui-mcpkit/dist/examples/counter/dist/server.mjs"]
    }
  }
}
```

macOS 的配置位置是 `~/Library/Application Support/Claude/claude_desktop_config.json`，Windows 是 `%APPDATA%\Claude\claude_desktop_config.json`。如果 Claude 找不到 Node.js，把 `node` 替换为可执行文件的绝对路径。重启 Claude Desktop 后，在提供该服务的界面中调用 `open_counter`。详见[本地服务配置指南](https://modelcontextprotocol.io/docs/develop/connect-local-servers)。

Codex marketplace 命令不会安装 Claude 扩展。MCPKit 目前不生成 `.mcpb` 扩展，也不提供网页或手机连接器所需的 HTTPS 服务。这些接入方式见 [Claude 连接器说明](https://support.claude.com/en/articles/11725091-when-to-use-desktop-and-web-connectors)。

## VS Code 与其他客户端

对于 VS Code，将上面的 `mcpServers` 配置放入工作区根目录的 `.mcp.json`。通过 **MCP: List Servers** 启动服务，然后在 Copilot Chat 中调用 `open_counter`。版本与设置要求见官方 [VS Code MCP 指南](https://code.visualstudio.com/docs/agent-customization/mcp-servers)。

其他客户端可以先查阅 [MCP Apps 宿主列表](https://modelcontextprotocol.io/extensions/apps/overview)，再按自己的配置格式注册 `node` 和 `dist/server.mjs` 的绝对路径。接入自己的 Agent 时，替换示例的服务路径，并使用实际配置的打开工具名称。

OpenAI 的侧栏入口属于客户端专用能力。其他宿主可以展示标准应用视图，但展开控件可能不同。

## 按顺序检查连接

1. 确认配置指向的 `dist/server.mjs` 存在，Node 版本为 22+。
2. 通过客户端的 MCP 控制入口启动或重载，检查启动错误。
3. 查看工具发现结果：Counter 服务应提供 `open_counter` 和 `open_countdown`。
4. 用 `{ "initialCount": 5, "label": "Demo" }` 调用 `open_counter`。
5. 有文字结果却没有界面时，检查 Apps 支持、MIME 协商、资源大小限制和 WASM 权限。
6. 页面主动调用还要单独检查 `serverTools` 能力与工具权限。

VS Code 工作区根目录的 `.mcp.json` 使用可移植的 `mcpServers` 格式；`.vscode/mcp.json` 使用不同的顶层 `servers` 键，不能把一种格式原样复制到另一种文件。当前支持的配置位置见 [VS Code 官方指南](https://code.visualstudio.com/docs/agent-customization/mcp-servers)。

测试 stdio 服务时不要期待 localhost URL。执行 `node .../dist/server.mjs` 后它会等待协议输入，通常由客户端自行启动进程。连接或渲染失败时见[故障排查](troubleshooting.zh-CN.md)。

---

[文档目录](../README.zh-CN.md) · 上一篇：[ESM 构建接入](esm-build.zh-CN.md) · 下一篇：[开发迭代](development.zh-CN.md)
