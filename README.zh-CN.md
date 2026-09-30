# AIUI MCPKit

[English](README.md)

AIUI MCPKit 是一个将开发者自己的 Ink 应用构建成 MCP App plugin 的 framework。它将 Ink 页面、Ink Web Canvas/WASM 运行时、MCP Apps 视图和本地 stdio MCP 服务打包为独立插件。仓库本身不是 plugin，也不提供 plugin marketplace。

## 构建 framework

需要 Node.js 22+。

```sh
npm ci
npm run build
```

此命令只在 `dist/` 下生成 framework CLI 和运行时模板，不会自动打包示例或生成 plugin。npm 包提供 `aiui-mcpkit` 命令；在当前仓库中使用 `node dist/cli.mjs`。

## 打包自己的 Ink 应用

指定开发者自己的 Ink 源码目录，其中包含 `app.json` 和 `.ink` 页面：

```sh
node dist/cli.mjs --ink /path/to/my-app/ink --name my-app --out /path/to/my-app/dist/plugin
```

将 framework 安装为 npm 依赖后，可使用：

```sh
npx aiui-mcpkit --ink ./ink --name my-app --out ./dist/plugin
```

`--ink` 和 `--name` 必填。`--title` 默认采用 `app.json` 的应用名称；`--page` 默认采用其 `pages` 第一项，路径不带 `.ink` 后缀。`--tool` 默认是 `open_app`；`--description` 设置 plugin 和打开工具的描述。未指定 `--out` 时，输出到当前工作目录下的 `dist/<plugin-name>`。运行 `--help` 查看参数。

生成的 plugin 包含：

```text
.agents/plugins/marketplace.json
plugin.json
mcp.json
view.html
dist/server.mjs
```

这些文件是构建产物，不是 framework 源码。服务、视图和 manifest 使用开发者应用的身份及初始页面。JS、Ink 源文件和压缩的浏览器 WASM 均内嵌；生成的 plugin 需要 Node.js 22+，无需 npm 安装或外部资源请求。目前 Ink bundle 按 UTF-8 读取文件，尚不支持打包二进制素材。

输出还包含指向同目录 plugin 的本地 marketplace manifest。添加 marketplace 时使用生成目录，不能使用 framework 仓库根目录。格式遵循 [OpenAI 官方本地 marketplace 文档](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually)。也可通过开发者自己的 plugin marketplace 分发生成插件，或在支持 MCP Apps 的宿主中配置 Node 启动其中的 `dist/server.mjs`。生成的 `mcp.json` 使用 `${PLUGIN_ROOT}` 保证可移植性。纯浏览器宿主无法启动本地 stdio 服务。

## 计数器示例

计数器作为示例应用源码放在 [examples/counter/ink](examples/counter/ink)，与 framework 运行时独立：

```sh
npm run build:example
npm run start:example
```

使用支持 plugin 命令的 Codex CLI 安装生成的示例：

```sh
codex plugin marketplace add ./dist/examples/counter
codex plugin add ink-counter@ink-counter-local
```

安装后重启桌面宿主。修改后重新构建示例并重新安装，宿主缓存中的已安装副本与构建输出分开存放。

`build:example` 先构建 framework，再将示例打包为 `ink-counter`，输出到 `dist/examples/counter/`，提供 `open_counter` 工具。`start:example` 启动该示例的 stdio MCP 服务。示例展示画布输入、宿主支持时的存储，以及 inline/fullscreen 切换。模式切换采用宿主确认的结果。

## 验证

```sh
npm run typecheck
npm run build:example
npx playwright install chromium
npm test
```

测试覆盖独立开发者应用的打包、stdio MCP 工具和资源，以及 MCP Apps `AppBridge` 浏览器测试宿主中的真实 Ink WASM 渲染。浏览器测试使用 Playwright Chromium；存在 `/usr/bin/chromium` 时使用该路径，也可通过 `CHROMIUM_PATH` 指定。测试检查模式请求被接受、被拒绝和不受支持的情况，以及输入、状态连续性和禁止外部连接的 CSP。

这些检查不等同于真实 ChatGPT 桌面版/Codex GUI 验证。plugin 发现、显示位置、资源大小限制及宿主 CSP 仍需在目标宿主验证。浏览器视图经过 minify；测试限制资源响应低于内部 10 MB 预算，这并非宿主公布的上限。内嵌 WASM 仍使 HTML 资源约 10 MB，沙箱必须允许 WebAssembly 编译。宿主声明支持时，运行时提供 inline/fullscreen 模式。
