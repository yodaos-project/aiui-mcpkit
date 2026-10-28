# 验证 Agent 并截图

[English](preview-verification.md) | 简体中文 · [文档目录](../README.zh-CN.md)

`verifyPlugin()` 在本地 MCP Apps `AppBridge` 宿主中打开构建好的 Agent，执行真实 Ink/WASM 运行时，返回明确的就绪检查结果，并可将 Agent 画布保存为 PNG。仓库 CLI 直接调用同一个 ESM API。

## 安装浏览器支持

预览仅在调用时加载 Playwright。它是**可选 peer 依赖**，普通构建和生成的服务端不需要它，也不会安装浏览器。在开发项目中运行：

```sh
npm install --save-dev playwright
npx playwright install chromium
```

Linux CI 可能需要 `npx playwright install --with-deps chromium`。也可以通过 `executablePath` 或 `CHROMIUM_PATH` 使用已有 Chromium，无需下载。生成插件的运行环境不需要部署浏览器。

## ESM 示例

在仓库根目录执行 `npm run build:examples` 后：

```js
import { verifyPlugin } from '@yodaos-pkg/aiui-mcpkit';

const result = await verifyPlugin({
  pluginDir: './dist/examples/counter',
  page: 'pages/counter/index',
  input: { initialCount: 42, label: 'Release check' },
  displayMode: 'fullscreen',
  viewport: { width: 480, height: 352 },
  deviceScaleFactor: 1,
  readyWhen: {
    message: { type: 'counter-loaded', count: 42, label: 'Release check' },
  },
  timeouts: { runtime: 15000, firstFrame: 15000, business: 15000 },
  screenshotPath: './test-results/counter.png',
});
console.log(result);
if (!result.usable) process.exitCode = 1;
```

自己的 Agent 可使用 `buildPlugin()` 返回的 `outputDir`。`page` 默认使用构建时的初始页面，路由不带 `.ink`。启动参数经真实宿主桥传递。每次调用使用新的浏览器上下文，存储和 App 状态独立。相对路径以调用者的工作目录为基准。

## 就绪约定

依次执行三项检查，每项有独立超时：

1. **runtime：** 生成的 View 已连接宿主、创建 Ink 并打开页面（`body.dataset.ready`）。
2. **firstFrame：** 预览观察到实际画布提交，经过两次动画回调给予浏览器绘制机会，并检查画布像素不完全相同。仅有 canvas 元素或纯空白、纯背景图片不够。这是浏览器呈现证据，不是物理显示测量。
3. **business：** `readyWhen.message` 递归匹配 Agent 消息。对象可包含额外字段；数组长度和内容必须完整匹配。应包含记录 ID、加载数量等目标状态，避免误匹配普通启动消息。

Agent 应在必要的异步工作和数据更新完成后发送消息：

```js
this.setData({ record, loading: false });
this.postMessage({ type: 'record-ready', id: record.id, loading: false });
```

就绪后，预览再经过两次动画回调，让待处理的更新和绘制完成，然后返回或截图。消息是应用自身的约定，必须覆盖截图所需的业务数据和资源；它不会自动证明网络已空闲、动画全部结束、每个控件都可交互，或后续模型已消费数据。

只有三项检查和配置的错误门禁全部通过，才返回 `status: 'passed'`、`usable: true`。未指定 `readyWhen` 时，业务检查为 `skipped`，整体为 `incomplete`，`usable` 为 false。失败或未完成验证的运行仍可生成诊断截图；PNG 存在不代表应用可用。

## 参数和返回值

| 参数 | 默认值 / 含义 |
| --- | --- |
| `pluginDir` | 必填，包含 `view.html` 的构建目录 |
| `page`、`input` | 构建时初始页面和 `{}` |
| `displayMode` | `inline`，也支持 `fullscreen` |
| `viewport` | `{ width: 420, height: 280 }` CSS 像素，尺寸范围 1–16384 |
| `deviceScaleFactor` | `1`，大于 0 且不超过 4 |
| `readyWhen.message` | 可选非空 JSON 对象；省略时验证未完成 |
| `timeouts` | `runtime`、`firstFrame`、`business` 各 15000ms，必须为正 32 位整数 |
| `errorGate` | `fail`；`collect` 记录运行时异常、拒绝和控制台错误，但不因此判失败 |
| `screenshotPath` | 可选 `.png` 路径，自动创建父目录 |
| `executablePath` | 优先使用显式路径，其次 `CHROMIUM_PATH`，最后使用 Playwright 已安装的浏览器 |

截图只包含 Agent 画布，不包含宿主外壳。全屏画布遵循视口尺寸；内联模式保留生成 View 的高度（通常为 220 CSS 像素）。PNG 尺寸包含设备缩放比例，通过 `screenshot.width/height` 返回。

结果包括 `status`、`usable`、`checks`（`passed`/`failed`/`skipped`）、`diagnostics`、实际匹配的 `readyMessage`、视口/模式/缩放，以及可选的 `screenshot`（含绝对路径）。非法参数抛出 `code: 'INVALID_OPTIONS'` 的 `PreviewError`；执行失败返回 `status: 'failed'` 和稳定错误码：

| 错误码 | 含义 |
| --- | --- |
| `RUNTIME_ERROR` | 浏览器运行时异常 |
| `UNHANDLED_REJECTION` | 浏览器未处理的 Promise 拒绝 |
| `CONSOLE_ERROR` | View、Ink 或预览宿主记录的错误 |
| `RUNTIME_READY_TIMEOUT` | View 未在预算内完成运行时就绪 |
| `FIRST_FRAME_TIMEOUT` | 未在预算内得到符合要求的画面/呈现 |
| `BUSINESS_READY_TIMEOUT` | 未等到目标业务消息 |
| `BROWSER_UNAVAILABLE` | 缺少 Playwright、缺少浏览器或浏览器启动失败 |
| `SCREENSHOT_FAILED` | 画布截图或 PNG 写入失败 |
| `PREVIEW_FAILED` | 其他预览初始化/导航失败 |

错误采集持续到截图/验证结束。`collect` 不会忽略超时或基础设施错误；携带错误但通过的结果反映调用者显式选择的策略。

## 仓库 CLI

```sh
npm run verify:plugin -- dist/examples/counter \
  --input '{"initialCount":42,"label":"Release check"}' \
  --ready-message '{"type":"counter-loaded","count":42,"label":"Release check"}' \
  --mode fullscreen --width 480 --height 352 \
  --screenshot test-results/counter.png
```

`--timeout` 设置每个阶段的预算。`--page`、`--dpr`、`--chromium`、`--error-gate collect` 对应 ESM 参数。CLI 输出 JSON，仅 `passed` 退出码为 0；失败和未完成均为 1。详见 `node scripts/verify-plugin.mjs --help`。

本地宿主提供启动参数和显示上下文，不启动生成的 MCP 服务端，也不提供业务/宿主工具服务；依赖这些服务的页面需要专用集成宿主。本地验证不能证明部署后的桌面宿主或真实模型兼容性，相关边界见[运行时集成](runtime-integration.zh-CN.md)和[客户端配置](clients.zh-CN.md)。
