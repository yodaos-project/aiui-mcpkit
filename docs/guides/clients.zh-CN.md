# 把应用连接到 AI 客户端

[English](clients.md) | 简体中文 · [学习路线](../README.zh-CN.md)

**目标：** 让助手发现工具、调用它，并显示界面。先完成[浏览器快速开始](../getting-started/quickstart.zh-CN.md)；[页面工具](page-tools.zh-CN.md)会准备好自己的应用。下面只需要选择你正在使用的客户端。

客户端启动一个本地 Node.js 服务，服务提供工具；支持 **MCP Apps 与 WASM** 的客户端还能显示界面。普通 MCP 支持可以返回数据，但不一定显示 UI。各客户端能力不同：本项目已在 Codex Desktop 观察到 Counter 内联界面，Claude Desktop 和 VS Code 仍需针对本项目验证实际 UI。

## 1. 构建可以安装的示例

先按 Ctrl+C 停止正在运行的监听，在仓库根目录执行：

```sh
npm run build:examples
```

这会在 `dist/examples/` 生成六个插件。先用 Counter，它不需要 Worker 宿主。插件构建和浏览器监听预览使用不同的输出目录。

客户端要求绝对路径时，可以先打印仓库位置：

```sh
node -p "process.cwd()"
```

在该位置后追加 `/dist/examples/counter/dist/server.mjs`。下面的 `/absolute/path/to/aiui-mcpkit` 都要替换成真实仓库位置。Windows 的 JSON 路径可以使用 `/`，也可以将每个反斜杠转义为 `\\`。

## 2. 选择一种连接方式

### Codex Desktop

先确认终端可以运行 `codex plugin --help`，然后在仓库根目录执行：

```sh
codex plugin marketplace add ./dist/examples
codex plugin add ink-counter@aiui-mcpkit-examples
```

第一行注册本地插件目录，第二行安装 Counter。重启桌面宿主，使用能暴露该插件工具的新对话或会话。具体客户端操作见官方[插件安装指南](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually)。

<details>
<summary>Codex CLI，或直接注册 MCP 服务</summary>

也可以选择下面的直接注册方式，同一个插件不必重复安装：

```sh
codex mcp add aiui-counter -- node /absolute/path/to/aiui-mcpkit/dist/examples/counter/dist/server.mjs
```

注册后启动新会话。CLI 能调用工具并显示文本结果，交互界面请用图形化 Apps 宿主。见 [MCP 配置](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。

</details>

### Claude Desktop

按官方[本地服务接入指南](https://modelcontextprotocol.io/docs/develop/connect-local-servers)，打开客户端的 Developer 设置及配置文件。把以下条目合入 `mcpServers`，保留已有服务：

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

macOS 文件位置为 `~/Library/Application Support/Claude/claude_desktop_config.json`，Windows 为 `%APPDATA%\Claude\claude_desktop_config.json`。替换示例路径，保存后重启 Claude Desktop。找不到 Node.js 时，将 `command` 改为 Node 可执行文件的绝对路径。

### VS Code

在命令面板运行 **MCP: Add Server**，选择 **Command (stdio)**，输入 `node` 以及上面的服务绝对路径。使用未重复的服务 ID，例如 `aiui-counter`，选择当前环境支持的配置位置，再通过客户端的 MCP 控件启动服务。

VS Code 有不同配置格式与运行环境，请按[当前接入指南](https://code.visualstudio.com/docs/agent-customization/mcp-servers)选择配置位置。仓库根目录 `.mcp.json` 等可移植格式使用 `mcpServers`，VS Code 格式的 `.vscode/mcp.json` 使用 `servers`，用引导流程可以避免混用。显示界面还取决于该环境是否开启 MCP Apps 支持。

## 3. 先检查发现，再调用工具

检查当前会话的工具列表，找到 `open_counter` 和 `open_countdown`。安装成功不等于当前会话已经加载工具。

把以下**对话提示词**发给助手，不要在终端执行：

```text
用 { "initialCount": 5, "label": "Demo" } 调用 open_counter。
```

**预期结果：** Counter 从 **5** 开始，点击 **+ ADD ONE** 后变成 **6**。如果只有数据没有界面，确认宿主支持 Apps 和 WASM。本地预览能运行，不代表任意客户端都能显示它。

还可以让助手以 `{ "start": 8, "step": 2 }` 调用 `open_countdown`，点击按钮后从 8 变成 6。每个新 View 都有自己的状态。

## 连接自己的应用

完成[创建自己的应用](../getting-started/first-agent.zh-CN.md)后，在仓库根目录构建：

```sh
node scripts/build-plugin.mjs ./my-agent --name my-agent --out ./dist/my-agent
```

Codex 插件方式：

```sh
codex plugin marketplace add ./dist/my-agent
codex plugin add my-agent@my-agent-local
```

直接注册方式则把客户端服务路径改为 `dist/my-agent/dist/server.mjs` 的绝对路径，替换示例服务。一个插件保留一种连接方式即可。

完成页面工具教程后，以 `{ "initialCount": 5 }` 调用 `open_my_counter`；还没添加页面 schema 时，默认调用 `open_app`，参数为 `{}`。之后修改源码，按[开发迭代](development.zh-CN.md)重新构建、更新安装副本，再重载服务并打开新 View。

## 遇到问题时

- **没有工具：** 检查服务绝对路径和客户端日志，再重载 MCP 连接或会话。
- **手动启动服务没有输出：** stdio 在等待协议输入，不会提供 localhost 地址，通常由客户端代为启动。
- **有数据没有 UI：** 检查 Apps/WASM 支持和客户端沙箱限制，见[兼容性](../reference/compatibility.zh-CN.md)。
- **构建后仍是旧界面：** 源码、产物、安装副本是三份不同文件，按[构建诊断](build-diagnostics.zh-CN.md)检查。

MCPKit 生成本地 stdio 服务；只接受 HTTP 的连接器需要另外实现传输层。全屏、消息和实时 View 工具是否可用，由宿主决定。更深入的问题见[故障排查](troubleshooting.zh-CN.md)。

**完成检查：** 当前客户端会话能看到目标工具、调用得到预期数据，并且兼容的 Apps 宿主能打开可操作界面。

**下一步：** [返回第一个业务结果](first-business-tool.zh-CN.md)。
