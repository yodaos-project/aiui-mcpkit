<p align="center">
  <picture>
    <source media="(max-width: 600px)" srcset="docs/assets/readme-banner-compact.svg">
    <img src="docs/assets/readme-banner.svg" width="1200" alt="AIUI MCPKit — 将 AIUI 智能体构建为可交互的 MCP Apps">
  </picture>
</p>

<h3 align="center">让 AI 工具拥有可操作的界面。</h3>

<p align="center">
  用 JavaScript 和 AIUI，构建可交互的 MCP Apps。<br>
  将页面、Ink WebAssembly 渲染器和 MCP 服务，一起交付为插件。
</p>

<p align="center">
  <a href="https://github.com/yodaos-project/aiui-mcpkit/actions/workflows/ci.yml"><img src="https://github.com/yodaos-project/aiui-mcpkit/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://github.com/yodaos-project/aiui-mcpkit/actions/workflows/benchmark.yml"><img src="https://github.com/yodaos-project/aiui-mcpkit/actions/workflows/benchmark.yml/badge.svg?branch=main" alt="Benchmarks"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&amp;logoColor=white" alt="Node.js 22+"></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>简体中文</strong><br>
  <a href="#快速开始">快速开始</a> · <a href="#构建自己的智能体">开始开发</a> · <a href="docs/README.zh-CN.md">完整文档</a> · <a href="#参与贡献">参与贡献</a>
</p>

## 让用户直接操作 AI 工具

助手获取结构化数据，用户通过按钮、表单和实时状态继续操作。你可以构建订单计算器、商品选择器和共享工作区，把界面操作接入 AI 对话。

<table>
  <tr>
    <th width="50%" align="left">旅行规划 · Fieldnotes</th>
    <th width="50%" align="left">专注计时 · Focus Studio</th>
  </tr>
  <tr>
    <td width="50%" align="center" valign="top"><a href="docs/assets/examples/travel.png"><img src="docs/assets/examples/travel.png" width="480" alt="蓝色京都行程，支持日期切换与地点收藏"></a></td>
    <td width="50%" align="center" valign="top"><a href="docs/assets/examples/focus.png"><img src="docs/assets/examples/focus.png" width="480" alt="珊瑚暖色专注计时器，支持开始、暂停与重置"></a></td>
  </tr>
  <tr>
    <td valign="top">切换日期、收藏地点，点击后只向助手分享选中的内容。</td>
    <td valign="top">设置任务与时长，启动计时后随时暂停或重置。</td>
  </tr>
  <tr>
    <td><a href="examples/travel">查看旅行规划 →</a></td>
    <td><a href="examples/focus">查看专注计时 →</a></td>
  </tr>
</table>

<table>
  <tr>
    <th width="50%" align="left">数据洞察 · Signal</th>
    <th width="50%" align="left">活动预约 · The Making Room</th>
  </tr>
  <tr>
    <td width="50%" align="center" valign="top"><a href="docs/assets/examples/analytics.png"><img src="docs/assets/examples/analytics.png" width="480" alt="紫色数据看板，展示周期筛选、业务指标和柱状图"></a></td>
    <td width="50%" align="center" valign="top"><a href="docs/assets/examples/events.png"><img src="docs/assets/examples/events.png" width="480" alt="陶艺工作坊预约，支持场次与人数选择"></a></td>
  </tr>
  <tr>
    <td valign="top">切换周/月，指标和图表同步更新。</td>
    <td valign="top">选择场次与人数、核对金额，再确认本地演示预约。</td>
  </tr>
  <tr>
    <td><a href="examples/analytics">查看数据洞察 →</a></td>
    <td><a href="examples/events">查看活动预约 →</a></td>
  </tr>
</table>

<sub>截图来自本地 MCP Apps 浏览器测试宿主，使用真实 Ink/WASM 运行时。旅行、数据分析、预约与业务数据均为演示数据；预约确认不会真实订位或付款，计时器在 View 打开期间运行。向对话分享内容需要宿主支持。</sub>

<details>
<summary><strong>继续查看业务结果与共享 App</strong></summary>

<table>
  <tr>
    <th width="50%" align="left">计算报价，继续操作</th>
    <th width="50%" align="left">搜索、查看与选择</th>
  </tr>
  <tr>
    <td width="50%" align="center" valign="top"><a href="docs/assets/business.png"><img src="docs/assets/business.png" width="420" alt="报价页面展示 CNY 40、库存以及计算和取消按钮"></a></td>
    <td width="50%" align="center" valign="top"><a href="docs/assets/shared-agent-search.png"><img src="docs/assets/shared-agent-search.png" width="420" alt="目录搜索台灯，同时保留已选中的旅行包"></a></td>
  </tr>
  <tr>
    <td valign="top">向模型返回经过校验的报价，用户可在同一个界面中重新计算或取消操作。</td>
    <td valign="top">多个工具共用一个 App，在各自的实时 View 中保留搜索、导航和选择状态。</td>
  </tr>
  <tr>
    <td><a href="docs/guides/business-tools.zh-CN.md">构建业务工具 →</a></td>
    <td><a href="docs/guides/shared-agent.zh-CN.md">构建共享 App →</a></td>
  </tr>
</table>

</details>

https://github.com/user-attachments/assets/487a1771-ca2d-4b04-91f4-8a55f8f8eba1

**[观看 33 秒英文宣传短片 →](docs/assets/mcpkit-showcase.mp4)** · [无背景音乐版](docs/assets/mcpkit-showcase-nobgm.mp4)

<details>
<summary>短片说明与素材署名</summary>

从 Codex 对话内渲染，到独立视图继续操作，再携带选择返回对话。英文成片还展示 Codex、Claude Code 等电脑智能体客户端，以及 AIUI 在 Rokid Glasses 上的运行能力。客户端外壳明确标注为示意，应用画面来自真实运行时，眼镜素材使用 [AIUI 官网](https://open.rokid.com/aiui/?lang=en-US)的官方产品图；电脑端交互界面依赖宿主能力。配乐：[Cat Walk — Arulo](https://assets.mixkit.co/music/371/371.mp3)（[Mixkit 许可](https://mixkit.co/license/#musicFree)）；音效：[Mixkit](https://mixkit.co/license/#sfxFree)。

</details>

## 为什么选择 MCPKit？

- **页面和工具共用一份定义。** 工具名称与 schema 直接写在 `.ink` 页面中，自动生成工具注册、运行时校验与 TypeScript 契约。
- **让助手连接实时状态。** 用 `ModelContext.defineAction()` 暴露 App/Page 方法，通过 `getApp().getAgent()` 发送消息、发布选中内容。
- **业务逻辑独立于 View 执行。** 用 Ink Agent Worker 或 Node.js 服务端 handler 处理计算与系统集成，服务端凭据保留在 UI 代码之外。
- **构建、交付与验证一起完成。** `buildPlugin()` 打包服务、UI、运行时和 manifest；用[预览验证](docs/guides/preview-verification.zh-CN.md)检查就绪状态，用[构建诊断](docs/guides/build-diagnostics.zh-CN.md)核对构建身份。

## 快速开始

先在浏览器里体验，只需要 **Node.js 22+**、Git 和文本编辑器。第一个预览不需要 AI 账号或 API Key。

在终端运行：

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
npm ci
npm run watch:examples -- counter
```

打开终端 `preview` 行中的地址，并保持命令运行。Counter 从 **0** 开始，点击 **+ ADD ONE** 后变成 **1**。保存源码改动会触发重建与刷新；按 **Ctrl+C** 结束预览。

[完整首次体验教程 →](docs/getting-started/quickstart.zh-CN.md) · [准备环境 →](docs/getting-started/installation.zh-CN.md)

预览使用真实 Ink/WASM，并提供启动参数；它不运行 AI 模型或服务端业务调用。准备好接入助手后，再按[客户端接入](docs/guides/clients.zh-CN.md)操作。

## 构建自己的智能体

每次只增加一种能力，每一步都有可以运行的结果：

1. **[第一次修改](docs/getting-started/edit-example.zh-CN.md)** — 修改按钮，看到自动刷新
2. **[第一个应用](docs/getting-started/first-agent.zh-CN.md)** — 用两个源文件创建自己的应用
3. **[页面工具](docs/guides/page-tools.zh-CN.md)** — 用经过校验的工具参数打开它
4. **[连接客户端](docs/guides/clients.zh-CN.md)** — 在助手中调用它
5. **[第一个业务工具](docs/guides/first-business-tool.zh-CN.md)** — 将计算结果同时返回给助手和界面

[查看完整学习路线 →](docs/README.zh-CN.md)

已经在做项目集成？可以直接看 [ESM 接入](docs/guides/esm-build.zh-CN.md)和[构建 API](docs/reference/build-api.zh-CN.md)。[示例集合](examples/README.zh-CN.md)介绍六个插件及其安装命令。

## 客户端支持

MCPKit 生成**本地 stdio 服务**。交互界面需要支持 WASM 的 MCP Apps 宿主；不支持 Apps 的客户端会收到工具数据和明确的界面不可用说明。

| 能力或客户端 | 验证情况 |
| :--- | :--- |
| **Ink/WASM 与 MCP Apps 通道** | 真实浏览器测试覆盖工具输入/结果、界面操作、显示模式、消息、上下文与取消。 |
| **Codex Desktop** | 已观察到 Counter 内联界面；其他交互和显示模式由浏览器测试覆盖。 |
| **Claude Desktop / VS Code** | 已提供接入指南，本项目界面仍需在这些客户端中验证。 |
| **对话与实时工具** | 能力是否可用取决于宿主协商和 View 工具路由；模型实际消费上下文仍需单独验证。 |

协议细节与运行条件见[兼容性说明](docs/reference/compatibility.zh-CN.md)和[运行时集成](docs/guides/runtime-integration.zh-CN.md)。HTTPS 部署与对话卡片渲染仍是独立待办。

## 深入了解

| 构建应用 | 接入宿主 | 验证与排查 |
| :--- | :--- | :--- |
| [AIUI、Ink 与 MCPKit](docs/getting-started/overview.zh-CN.md) | [客户端接入](docs/guides/clients.zh-CN.md) | [预览验证](docs/guides/preview-verification.zh-CN.md) |
| [构建 API](docs/reference/build-api.zh-CN.md) | [Agent 会话](docs/guides/agent-session.zh-CN.md) | [构建诊断](docs/guides/build-diagnostics.zh-CN.md) |
| [插件元数据](docs/guides/metadata.zh-CN.md) | [运行时与 Worker](docs/guides/runtime-integration.zh-CN.md) | [性能基准](docs/reference/benchmarks.zh-CN.md) |
| [共享 App](docs/guides/shared-agent.zh-CN.md) | [状态恢复](docs/guides/state-restoration.zh-CN.md) | [故障排查](docs/guides/troubleshooting.zh-CN.md) |
| [示例集合](examples/README.zh-CN.md) | [开发迭代](docs/guides/development.zh-CN.md) | [参与贡献](docs/contributing.zh-CN.md) |

[查看完整文档 →](docs/README.zh-CN.md)

## 参与贡献

欢迎提交可运行示例、客户端测试记录或范围清晰的修复。[提交 Issue](https://github.com/yodaos-project/aiui-mcpkit/issues) 时，请附上客户端版本和复现步骤，也欢迎 Pull Request。

```sh
npm run build:examples
npx playwright install chromium
npm run typecheck
npm test
```

Worker 测试配置与基准检查步骤见[贡献指南](docs/contributing.zh-CN.md)。

---

<p align="center">
  基于 <a href="https://github.com/yodaos-project/AIUI">AIUI</a> · <a href="https://github.com/jsar-project/ink">Ink</a> · <a href="https://github.com/modelcontextprotocol/ext-apps">MCP Apps SDK</a> 构建
</p>
