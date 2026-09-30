# AIUI MCPKit

**将 AIUI Agent 带入 MCP Apps。**

AIUI MCPKit 将你的 [AIUI Agent](https://github.com/yodaos-project/AIUI) 构建为可交互的 MCP App 插件。一条命令完成打包，即可在兼容的 AI 客户端中打开 Agent。

`@yodaos-pkg/aiui-mcpkit` ESM 包将 Agent 页面、运行时和 MCP 服务一起打包。构建工具可以直接调用 API，将插件生成能力集成到自己的打包流程。

[English](README.md) · [快速开始](#快速开始) · [构建你的 Agent](#构建你的-agent) · [开发](#开发) · [问题反馈](https://github.com/yodaos-project/aiui-mcpkit/issues)

## 功能

- **提供 ESM API 和 TypeScript 类型声明。** 在构建工具中导入 `buildPlugin()`，无需启动 CLI 子进程。
- **将自己的 AIUI Agent 打包为插件。** 使用自己的页面、Agent 名称和打开工具。
- **独立运行的构建产物。** JavaScript、Agent 源码和压缩的 WebAssembly 均已打包，生成的插件无需安装 npm 依赖。
- **内联与全屏布局。** 将宿主显示模式映射到 Agent 的 `_current` 和 `_blank`，同一个页面可在展开时展示更多内容。
- **支持本地安装。** 每次构建都会生成插件元数据、stdio MCP 配置和本地 marketplace manifest。

## 快速开始

需要 **Node.js 22+**、npm，以及支持 MCP Apps 和本地 stdio 服务的桌面宿主。以下安装命令使用支持 `codex plugin` 的 Codex CLI。

克隆仓库并构建 Counter 示例：

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
npm ci
npm run build:example
```

安装生成的插件：

```sh
codex plugin marketplace add ./dist/examples/counter
codex plugin add ink-counter@ink-counter-local
```

首次安装后重启桌面宿主，然后打开 **AIUI MCPKit Counter**。在提供本地 MCP 工具的宿主中，也可以调用 `open_counter`。

[Counter 示例](examples/counter/ink) 采用 AIUI 单绿设计。内联模式展示计数和递增操作，全屏模式增加会话统计、最近操作记录和快捷操作。展开由宿主控制，插件视图只展示 Agent 界面。

## 构建你的 Agent

### 1. 准备 Agent 源码

AIUI Agent 由 `app.json` manifest 和页面组成：

```text
my-agent/
└── agent/
    ├── app.json
    └── pages/
        └── home.ink
```

`app.json`：

```json
{
  "name": "My Agent",
  "pages": ["pages/home"]
}
```

`pages/home.ink`：

```html
<page>
  <view>
    <text>Hello from AIUI Agent</text>
  </view>
</page>
```

`app.json` 中的页面路径不带 `.ink` 后缀。包含状态管理和输入事件的完整示例见 [Counter 页面](examples/counter/ink/pages/counter/index.ink)。

### 2. 打包 Agent

包的公开入口是 ESM API：

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

`buildPlugin()` 返回插件身份、绝对输出目录、marketplace 名称和生成文件的路径。错误通过 Promise rejection 返回；函数不输出日志，也不修改进程工作目录。相对路径基于调用方的工作目录解析。该 API 可供 AIX 等构建工具集成；`aix pack --target mcp-apps` 将由 AIX 后续实现。

在本仓库中测试时，先构建库，再使用辅助脚本：

```sh
npm run build
node scripts/build-plugin.mjs /path/to/my-agent/agent \
  --name my-agent \
  --out /path/to/my-agent/dist/plugin
```

源码目录与输出目录需要分开，两者不能互相包含。

### 3. 安装插件

```sh
codex plugin marketplace add /path/to/my-agent/dist/plugin
codex plugin add my-agent@my-agent-local
```

生成的目录就是 marketplace 根目录。每次构建会创建名为 `<plugin-name>-local` 的 marketplace；打开工具默认名为 `open_app`。

### API 参数

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `source` | Agent 源码目录 | 必填 |
| `name` | 插件标识 | 必填 |
| `outputDir` | 插件输出目录 | `dist/<name>` |
| `title` | 显示名称 | `app.json` 名称，其次为插件名称 |
| `description` | 插件与打开工具的描述 | 根据显示名称生成 |
| `tool` | 打开工具名称 | `open_app` |
| `page` | 初始页面路径，不带 `.ink` | `app.json` 的第一个 pages 条目 |
| `version` | 插件和 MCP 服务版本 | `0.1.0` |

包导出 `BuildPluginOptions` 和 `BuildPluginResult` 类型。发布的入口是库，CLI 辅助脚本保留在本仓库中。

### 本地 CLI 参数

```sh
node scripts/build-plugin.mjs [source] --name <plugin-name> [options]
```

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `[source]` | Agent 源码目录 | 当前工作目录 |
| `--name` | 插件标识：小写字母、数字和连字符，以字母开头 | 必填 |
| `--out` | 插件输出目录 | `dist/<plugin-name>` |
| `--title` | 显示名称 | `app.json` 名称，其次为插件名称 |
| `--description` | 插件与打开工具的描述 | 根据显示名称生成 |
| `--tool` | 打开工具名称 | `open_app` |
| `--page` | 初始页面路径，不带 `.ink` | `app.json` 的第一个 pages 条目 |
| `--version` | 插件和 MCP 服务版本 | `0.1.0` |
| `--help` | 显示命令帮助 | — |

## 工作原理

```text
AIUI Agent 源码 → MCPKit 构建 → 插件包 → MCP Apps 宿主 → Agent 界面
```

生成的 stdio MCP 服务注册一个打开工具和一个 `ui://` HTML 资源。宿主将资源加载到应用视图，运行时渲染你的 Agent 界面。宿主切换显示模式时，Agent target 随之更新，无需重新打开 Agent。

每次构建生成：

```text
plugin/
├── plugin.json                       # 插件身份和显示元数据
├── mcp.json                          # 可移植的 stdio 服务配置
├── view.html                         # 内嵌的 Agent 和运行时
├── dist/server.mjs                   # 打包后的 MCP 服务
└── .agents/plugins/marketplace.json  # 本地安装目录
```

你可以通过自己的 marketplace 分发该目录，也可以在其他兼容的 MCP Apps 宿主中配置 `node /path/to/plugin/dist/server.mjs`。生成的 `mcp.json` 通过 `${PLUGIN_ROOT}` 解析服务路径。

## 开发

### 更新已安装的示例

修改 Counter Agent 的页面或浏览器视图后，运行：

```sh
npm run update:example
```

命令会重新构建示例，并以原子替换方式更新已安装 `ink-counter` 插件的 `view.html`。重新打开 Counter 卡片即可请求新 UI；已有卡片保留当前视图。

脚本使用 `$CODEX_HOME`，默认是 `~/.codex`，并检查匹配版本和 `local` 缓存目录。指定其他安装路径：

```sh
npm run update:example -- --plugin-dir /absolute/path/to/installed/plugin
```

该命令只更新视图。MCP 服务或 manifest 变更需要重新安装并重载插件。桌面宿主缓存 UI 资源时，仍可能需要重启。

### 项目命令

| 命令 | 用途 |
| --- | --- |
| `npm run build` | 构建 ESM 库、类型声明和运行时模板 |
| `npm run build:example` | 构建并打包 Counter 示例 |
| `npm run update:example` | 构建并替换已安装的 Counter 视图 |
| `npm run start:example` | 启动生成的 stdio MCP 服务 |
| `npm run typecheck` | 检查 TypeScript 类型 |
| `npm test` | 运行打包、MCP 和浏览器测试 |

运行测试前，先构建示例并安装 Playwright Chromium：

```sh
npm run build:example
npx playwright install chromium
npm run typecheck
npm test
```

浏览器测试在 MCP Apps `AppBridge` 测试宿主中使用真实的 Agent 运行时进行渲染，覆盖输入、状态连续性、宿主控制的显示模式和禁止外部连接的 CSP。也可通过 `CHROMIUM_PATH` 指定 Chromium，或使用系统已有的 `/usr/bin/chromium`。

## 兼容性

AIUI MCPKit 当前生成本地 **stdio** 插件。宿主需要支持 MCP Apps、启动 Node.js 进程，以及在 UI 沙箱中编译 WebAssembly。内联、全屏和侧栏入口取决于宿主支持。

- **资源：** 源文件按 UTF-8 读取，尚不支持打包二进制素材。内嵌运行时使 HTML 资源约为 10 MB，需要留意宿主的资源大小限制。
- **工具接入：** 插件出现在选择器或侧栏中，不代表模型能够调用它的本地工具。生成的本地插件尚未验证 Chat 模型调用。如需账号连接的 HTTPS MCP 集成，请参考[开发者连接指南](https://developers.openai.com/plugins/deploy/connect-chatgpt)。
- **验证范围：** 自动化测试覆盖生成的插件包和浏览器测试宿主。插件发现、资源缓存、显示位置和沙箱策略还需在目标桌面宿主中检查。

## 参与贡献

欢迎提交问题和 Pull Request。反馈宿主集成问题时，请附上宿主及 CLI 版本、构建命令和复现步骤。修改代码后，请运行上述检查，并保持中英文 README 同步。

[反馈问题](https://github.com/yodaos-project/aiui-mcpkit/issues) · [查看源码](https://github.com/yodaos-project/aiui-mcpkit)
