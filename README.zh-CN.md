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

**准备：** Node.js **22+**、Git，以及支持 WASM 的 MCP Apps 客户端。先体验 Counter；业务示例还需要配置 [`ink-worker`](docs/guides/business-tools.zh-CN.md)。

### 1. 构建示例

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
npm ci
npm run build:examples
```

构建后，`dist/examples/` 下会生成六个独立插件。Counter 和四个视觉示例无需原生 Worker 或外部服务。[查看全部示例 →](examples/README.zh-CN.md)

### 2. 安装 Counter

在 Codex Desktop 中体验时，使用支持插件命令的 Codex CLI：

```sh
codex plugin marketplace add ./dist/examples
codex plugin add ink-counter@aiui-mcpkit-examples
```

重启宿主，确认当前会话中能发现 `open_counter`。Claude Desktop、VS Code 和直接 stdio 注册方式见[客户端接入](docs/guides/clients.zh-CN.md)。

### 3. 体验交互

让助手执行：

```text
用 { "initialCount": 5, "label": "Demo" } 调用 open_counter。
```

点击 **+ ADD ONE**，计数应从 **5 变为 6**。

[查看 Counter 源码 →](examples/counter/pages/counter/index.ink) · [完整示例教程 →](docs/getting-started/quickstart.zh-CN.md)

<details>
<summary><strong>体验旅行、专注、数据洞察与活动预约</strong></summary>

添加上面的 marketplace 后，可按需安装以下插件，再重新加载宿主：

```sh
codex plugin add travel-planner@aiui-mcpkit-examples
codex plugin add focus-studio@aiui-mcpkit-examples
codex plugin add analytics-lab@aiui-mcpkit-examples
codex plugin add event-booking@aiui-mcpkit-examples
```

| 调用 | 可以体验什么 |
| :--- | :--- |
| `open_trip({ "day": 2 })` | 切换日期、收藏地点，显式分享选中的内容。 |
| `open_focus({ "minutes": 25, "task": "Write the next chapter" })` | 开始、暂停或重置专注计时。 |
| `open_analytics({ "period": "month" })` | 切换统计周期，同步更新图表。 |
| `open_workshop({ "seats": 2 })` | 选择场次并核对演示预约。 |

直接启动 stdio 服务可使用 `npm run start:examples -- travel`，其他 ID 为 `counter`、`business`、`focus`、`analytics`、`events`。打开的 View 通过 `ModelContext.defineAction()` 暴露只读的 `trip_state`、`focus_state`、`analytics_state` 和 `workshop_state`，查询需要宿主支持实时 View 工具路由。[示例指南 →](examples/README.zh-CN.md)

</details>

<details>
<summary><strong>继续体验：报价、商品选择与共享目录</strong></summary>

按 [Worker 配置指南](docs/guides/business-tools.zh-CN.md)，将 `ink-worker` 放入服务进程的 PATH，或设置 `INK_WORKER_BIN`，然后安装：

```sh
codex plugin add business-demo@aiui-mcpkit-examples
```

重新加载宿主，确认当前会话中可以发现工具。

| 调用 | 预期结果 |
| :--- | :--- |
| `quote_order({ "quantity": 2 })` | **CNY 40**、剩余库存 **98**；宿主开启工具访问后，可使用计算与取消按钮。 |
| `find_products({ "query": "travel" })` | 返回候选商品，用户通过显式操作发布选择并向助手提问。 |
| `search_catalog({ "query": "travel" })` | 打开支持搜索、详情与选择的共享目录 App，实时 App Action 更新同一个实例。 |

示例使用 AgentWorker 的 `ModelContext.defineAction()` 方法实现业务。[候选选择](docs/guides/candidate-selection.zh-CN.md)、[共享 App](docs/guides/shared-agent.zh-CN.md)和显式接入的[状态恢复](docs/guides/state-restoration.zh-CN.md)均有独立指南。消息、实时工具路由和恢复能力由宿主支持情况决定。

</details>

## 构建自己的智能体

创建包含 `app.json` 和已注册 `.ink` 页面的 AIUI 智能体。在页面的 `script def` 中添加工具元数据与输入 schema，需要业务结果时再添加 `schema.output`。

构建本仓库后，将下面内容保存为仓库根目录的 `build-agent.mjs`，智能体源码放在 `./agent/`：

```js
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

const plugin = await buildPlugin({
  source: './agent',
  name: 'my-agent',
  outputDir: './dist/my-agent',
});

console.log(plugin.outputDir);
```

执行 `node build-agent.mjs`，生成 `view.html`、`dist/server.mjs` 和插件/连接 manifest。部署宿主需要 Node.js 22+；原生 Worker 执行还需要 `ink-worker`。

| 接下来想做什么 | 对应指南 |
| :--- | :--- |
| 创建源码文件，写出第一个按钮 | [创建第一个 Agent](docs/getting-started/first-agent.zh-CN.md) |
| 将页面参数变成带校验的工具 | [页面工具](docs/guides/page-tools.zh-CN.md) |
| 添加类型明确的业务操作 | [业务工具](docs/guides/business-tools.zh-CN.md) |
| 在独立 Node.js 项目中使用 MCPKit | [ESM 包接入](docs/guides/esm-build.zh-CN.md) |

### 让助手读取实时界面状态

将下面的方法加入 Page 默认导出对象，即可把当前选择暴露为绑定实例的工具：

```js
export default {
  data: { selectedSku: 'DEMO' },
  getSelection: ModelContext.defineAction({
    name: 'get_selection',
    description: '读取当前页面选中的商品',
    annotations: { readOnlyHint: true },
    execute() {
      return { selectedSku: this.data.selectedSku };
    },
  }),
};
```

在按钮事件中，`getApp().getAgent().conversation.sendMessage()` 可发送用户消息，`agent.provideContext()` 可为后续轮次发布上下文。[Agent 会话](docs/guides/agent-session.zh-CN.md)提供完整页面、动态工具、上下文更新与撤销示例。宿主需要将 View 工具路由给模型，并开启对应的对话能力。

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
