# AIUI MCPKit

**让你的 AIUI Agent 在 AI 客户端里变成可点击、可操作的应用。**

AI 对话除了返回文字，还可以展示带按钮、实时状态的页面。使用 AIUI MCPKit，你可以把这样的界面放进 AI 客户端，并在用户打开全屏时展示更多内容。

用 [AIUI Agent](https://github.com/yodaos-project/AIUI) 编写界面，再交给 MCPKit 打包。构建产物包含界面、运行时，以及连接兼容客户端所需的 MCP 服务。

[English](README.md) · [体验示例](#体验示例) · [创建自己的 Agent](#创建自己的-agent) · [接入 ESM 库](#接入-esm-库) · [选择客户端](#选择客户端) · [参与贡献](#参与贡献)

## 为什么使用 MCPKit？

- **让用户直接操作界面。** 从 Counter 计数器开始，再用同一套打包流程构建自己的 Agent 页面。
- **根据展示空间调整内容。** 内联展示核心信息，全屏展示更多操作或详情。宿主的显示模式对应 Agent 的 `_current` 和 `_blank` 目标。
- **直接接入已有构建工具。** 从 `@yodaos-pkg/aiui-mcpkit` 导入 `buildPlugin()` 即可使用，ESM API 同时提供 TypeScript 类型声明。
- **交付一个完整的插件目录。** Agent 源码、JavaScript 和压缩的 WebAssembly 都已打包。生成的服务需要 Node.js，但无需另外安装 npm 依赖。
- **在兼容客户端复用服务。** 为 Codex 生成插件安装元数据，其他本地 MCP Apps 客户端可以直接连接生成的服务。

第一次接触这些名词？**AIUI Agent** 是你编写的应用；**MCP** 让 AI 客户端连接工具；**MCP Apps** 让这些工具还能提供交互界面；**MCPKit** 负责把它们打包到一起。

## 体验示例

先运行一个现成的例子，再决定要写什么。这份教程会构建 Counter 计数器，并安装到 **Codex 桌面版**。

### 1. 准备工具

安装 [Node.js](https://nodejs.org/en/download) **22 或更新版本**（自带 npm）、[Git](https://git-scm.com/downloads)、Codex 桌面版，以及支持 `codex plugin` 命令的 Codex CLI。下面的命令都在终端中执行。

使用 Claude Desktop 或 VS Code？完成第 2 步后，直接跳到[对应客户端的接入说明](#选择客户端)。

### 2. 下载并构建

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
npm ci
npm run build:example
```

完成后，Counter 插件位于 `dist/examples/counter`。下一步继续在当前仓库目录中执行。

### 3. 安装到 Codex

```sh
codex plugin marketplace add ./dist/examples/counter
codex plugin add ink-counter@ink-counter-local
```

第一条命令注册本地插件目录，第二条安装 Counter。请按示例复制插件标识，它们需要与生成的元数据一致。

首次安装后重启 Codex 桌面版，从插件的界面入口打开 **AIUI MCPKit Counter**。在已提供本地工具的 Codex 对话中，也可以让它调用 `open_counter`。

### 4. 试着操作

Counter 采用 AIUI 单绿设计。点击 **+ ADD ONE**，计数就会变化。在支持全屏的宿主中展开界面，还可以看到会话统计、最近操作记录和更多控制按钮。

[示例源码](examples/counter/ink/pages/counter/index.ink) 展示了页面如何处理状态、调整布局。Counter 的内联界面已经在 Codex 桌面版中观察到，全屏行为通过浏览器测试环境验证。

## 创建自己的 Agent

示例跑通后，就可以换成自己的页面。最小项目结构如下：

```text
my-agent/
└── agent/
    ├── app.json
    └── pages/
        └── home.ink
```

`app.json` 定义应用名称和页面列表：

```json
{
  "name": "My Agent",
  "pages": ["pages/home"]
}
```

`pages/home.ink` 定义第一个界面：

```html
<page>
  <view>
    <text>Hello from AIUI Agent</text>
  </view>
</page>
```

`app.json` 中的页面路径不带 `.ink` 后缀。需要按钮和状态管理时，可以参考完整的 [Counter 页面](examples/counter/ink/pages/counter/index.ink)。

在 MCPKit 仓库中运行本地构建脚本。把 `/path/to/my-agent` 换成自己项目的实际路径：

```sh
npm run build
node scripts/build-plugin.mjs /path/to/my-agent/agent \
  --name my-agent \
  --out /path/to/my-agent/dist/plugin
```

源码和输出目录需要分开，两者不能互相包含。这个脚本用于在仓库内调试；包对外提供的集成入口是 [ESM 库](#接入-esm-库)。

将自己的插件安装到 Codex：

```sh
codex plugin marketplace add /path/to/my-agent/dist/plugin
codex plugin add my-agent@my-agent-local
```

安装后重新加载桌面宿主。自己的 Agent 默认通过 `open_app` 工具打开。其他客户端可以[直接连接生成的服务](#选择客户端)。

## 接入 ESM 库

如果你在开发打包工具或自动构建流程，可以直接从 JavaScript 调用 MCPKit，无需启动 CLI 子进程。

要使用当前仓库中的包，先在 MCPKit 仓库运行 `npm pack`。它会构建库并生成 `yodaos-pkg-aiui-mcpkit-0.1.0.tgz`。然后在自己的 Node.js 项目中安装这个文件：

```sh
npm install /absolute/path/to/aiui-mcpkit/yodaos-pkg-aiui-mcpkit-0.1.0.tgz
```

在自己的项目中创建 `build-agent.mjs`：

```js
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

const result = await buildPlugin({
  source: './agent',
  name: 'my-agent',
  outputDir: './dist/plugin',
  version: '1.0.0',
});

console.log(result.outputDir);
console.log(result.files.view);
```

运行 `node build-agent.mjs` 即可打包。相对路径基于执行命令时所在的目录解析。返回结果包含插件身份、绝对输出目录、marketplace 名称和生成文件的路径。

API 导出 `BuildPluginOptions` 和 `BuildPluginResult` 类型。错误通过 Promise rejection 返回，不输出日志、不退出进程、不修改工作目录。这也是 AIX 等工具的集成入口；`aix pack --target mcp-apps` 计划在 AIX 中单独实现。

## 选择客户端

**能调用 MCP 工具，不等于能展示界面。** 客户端还需要支持 MCP Apps UI。当前构建使用 **stdio**：由客户端启动本地 Node.js 进程，通过标准输入和输出与它通信。

| 客户端 | 接入方式 | 当前可预期的效果 |
| --- | --- | --- |
| Codex 桌面版 | 安装本地插件 | 已观察到 Counter 内联界面；全屏经过浏览器测试 |
| Codex CLI | 本地插件或直接注册 MCP | 安装与终端工具调用；图形界面使用桌面版 |
| Claude Desktop | 配置本地 MCP 服务 | 官方列为 MCP Apps 宿主；本项目界面尚未实测 |
| VS Code / Copilot Chat | 工作区 MCP 配置 | 官方文档提供 MCP Apps 支持；本项目界面尚未实测 |
| 其他本地 MCP Apps 客户端 | 按客户端格式配置 stdio | 需要兼容的 UI 沙箱和资源大小限制 |
| 远程或仅支持 HTTP 的客户端 | 额外提供 HTTP 服务传输层 | MCPKit 目前不生成此类服务 |

### Codex 桌面版

按照[示例教程](#体验示例)安装本地插件，再在桌面版中打开。入口位置、本地工具能否用于当前对话，取决于应用版本和对话类型。详见官方[本地插件安装指南](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually)。

### Codex CLI

CLI 用于安装插件和调用工具。安装后开启一个新的 CLI 会话，让它调用 `open_counter`。打开工具会返回文字响应；操作图形界面需要使用桌面版。

如果只需要直接连接 MCP 服务，可以用下面的命令**替代**插件安装命令：

```sh
codex mcp add aiui-counter -- node /absolute/path/to/aiui-mcpkit/dist/examples/counter/dist/server.mjs
```

选择一种注册方式，避免出现重复工具。详见官方 [MCP 配置指南](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。

### Claude Desktop

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

### VS Code 与其他客户端

对于 VS Code，将上面的 `mcpServers` 配置放入工作区根目录的 `.mcp.json`。通过 **MCP: List Servers** 启动服务，然后在 Copilot Chat 中调用 `open_counter`。版本与设置要求见官方 [VS Code MCP 指南](https://code.visualstudio.com/docs/agent-customization/mcp-servers)。

其他客户端可以先查阅 [MCP Apps 宿主列表](https://modelcontextprotocol.io/extensions/apps/overview)，再按自己的配置格式注册 `node` 和 `dist/server.mjs` 的绝对路径。接入自己的 Agent 时，替换示例的服务路径，并使用实际配置的打开工具名称。

OpenAI 的侧栏入口属于客户端专用能力。其他宿主可以展示标准应用视图，但展开控件可能不同。

## 修改、构建、再体验

修改 Counter 的[页面](examples/counter/ink/pages/counter/index.ink)后，运行：

```sh
npm run update:example
```

它会重新构建示例，并替换 Codex 已安装 Counter 插件中的 `view.html`。打开一个**新的 Counter 卡片**来请求更新后的界面。已经打开的卡片保留当前内容；宿主如果缓存了资源，仍可能需要重启。

脚本使用 `$CODEX_HOME`（默认 `~/.codex`），检查对应版本和 `local` 缓存目录。也可以自己指定安装目录：

```sh
npm run update:example -- --plugin-dir /absolute/path/to/installed/plugin
```

这个快捷操作只更新 Counter 界面。修改服务或 manifest 后，需要重新安装并加载插件。对于 Claude Desktop 等直接配置服务的客户端，在已注册的路径重新构建插件，再通过客户端重新加载服务。

## 构建参考

### 生成的文件

```text
plugin/
├── plugin.json                       # Plugin name and display metadata
├── mcp.json                          # Plugin-host stdio configuration
├── view.html                         # Agent interface and embedded runtime
├── dist/server.mjs                   # Bundled MCP server
└── .agents/plugins/marketplace.json  # Local Codex installation catalog
```

服务提供打开工具，以及 MIME 类型为 `text/html;profile=mcp-app` 的 `ui://` HTML 资源。宿主把资源加载到应用视图中，并将显示模式变化传递给 Agent。生成的 `mcp.json` 中，`${PLUGIN_ROOT}` 由插件宿主解析；手动配置其他客户端时需要使用真实路径。

### API 与辅助脚本参数

| ESM 参数 | 本地脚本参数 | 默认值 |
| --- | --- | --- |
| `source` | `[source]` | API 必填；脚本默认为当前目录 |
| `name` | `--name` | 必填 |
| `outputDir` | `--out` | `dist/<name>` |
| `title` | `--title` | `app.json` 名称，其次为插件名称 |
| `description` | `--description` | 根据显示名称生成 |
| `tool` | `--tool` | `open_app` |
| `page` | `--page` | `app.json` 中的第一个页面，不带 `.ink` |
| `version` | `--version` | `0.1.0` |

插件名称以小写字母开头，仅包含小写字母、数字或连字符。工具名称由 1–128 个字母、数字、下划线或连字符组成。运行 `node scripts/build-plugin.mjs --help` 查看脚本用法。如果省略 `[source]`，请把 `--out` 设在当前目录之外，确保源码与输出目录分开。

### 当前支持范围

UI 宿主需要允许编译 WebAssembly。嵌入的 HTML 约为 10 MB，也需要留意宿主的资源大小限制。源码按 UTF-8 读取，目前不支持打包二进制资源。

自动测试覆盖打包、MCP 工具与资源响应，以及浏览器运行时。它们不能证明所有桌面宿主都完整兼容，也不能保证账号连接后的工具访问权限或资源缓存行为。

## 参与贡献

欢迎体验示例、接入新的宿主，或改进构建 API。[提交问题](https://github.com/yodaos-project/aiui-mcpkit/issues)时，请附上客户端版本、构建命令和复现步骤；Claude Desktop 和其他 MCP Apps 宿主的实测反馈尤其有帮助。

| 命令 | 用途 |
| --- | --- |
| `npm run build` | 构建 ESM 库、类型声明和运行时模板 |
| `npm run build:example` | 打包 Counter 示例 |
| `npm run update:example` | 替换 Codex 已安装的 Counter 界面 |
| `npm run start:example` | 启动生成的 stdio MCP 服务 |
| `npm run typecheck` | 检查 TypeScript 类型 |
| `npm test` | 运行打包、MCP 和浏览器测试 |

提交代码改动前运行：

```sh
npm run build:example
npx playwright install chromium
npm run typecheck
npm test
```

浏览器测试在 MCP Apps `AppBridge` 测试环境中运行真实 Agent，覆盖输入、状态连续性、显示模式和禁止网络访问的 CSP。可以通过 `CHROMIUM_PATH` 指定已有 Chromium，也支持可用的 `/usr/bin/chromium`。修改文档时请保持中英文 README 一致。

[查看源码](https://github.com/yodaos-project/aiui-mcpkit) · [反馈问题](https://github.com/yodaos-project/aiui-mcpkit/issues) · [了解 AIUI](https://github.com/yodaos-project/AIUI)
