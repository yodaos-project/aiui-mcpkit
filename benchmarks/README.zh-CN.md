# 渲染与打包基准

简体中文 | [English](README.md)

本套件用于建立 [issue #18](https://github.com/yodaos-project/aiui-mcpkit/issues/18) 的基线：在固定的本地 MCP Apps `AppBridge` 浏览器 host 中运行生成的 MCPKit 插件和**真实 Ink WASM**。无需修改 Ink，也不代表桌面客户端兼容性验收。

## 运行

在仓库根目录使用 Node.js 22+，支持 macOS 和 Linux：

```sh
npm ci
npm run build
npx playwright install chromium
npm run bench -- --label ink-baseline --out benchmark-results/baseline
```

已有浏览器可通过 `CHROMIUM_PATH=/absolute/path/to/chromium` 指定。浏览器需显式安装，不属于核心包的运行依赖，也不会由基准自动安装。Linux 首次运行可能需要 `npx playwright install --with-deps chromium`。

默认配置：**每个场景启动 3 个独立浏览器进程，每次测量 30 次输入，输入间隔 25ms，空闲窗口 2s，内存采样间隔 100ms，DPR 1，参考帧率 60Hz**。首次操作用于验证可交互并预热输入路径，不计入输入延迟分布。场景依次执行；比较时保持机器空闲，并使用一致的电源、温度条件。

CI 也使用以下正确性 smoke 检查：

```sh
npm run bench -- --samples 1 --operations 3 --idle-ms 250 \
  --server-calls 8 --out benchmark-results/smoke
```

参数见 `npm run bench -- --help`；`--scenario small-card` 可选择单个场景。采样参数不同的报告不允许直接比较。短 smoke 检查仅验证流程，不适合作为有统计意义的性能基线。

## 固定场景

| 场景 | Canvas CSS 视口 | 模式 | 数据与操作 |
| --- | --- | --- | --- |
| `small-card` | 420 × 220 | inline | 从 7 开始，每次输入加一。 |
| `virtual-list` | 640 × 480 | fullscreen | 在内存中生成 10,000 条固定记录，仅挂载 20 行，每行 18px。每次输入向后移动 50 行，并更新滚动位置；占位元素保持完整列表的几何尺寸。 |
| `live-dashboard` | 640 × 480 | fullscreen | 8 项指标，每 100ms 更新一次，数值为 `(tick × 17 + index × 31) % 100`；每次输入选择下一项指标，测空闲 CPU 前暂停数据流。 |
| `dense-canvas` | 640 × 480 | fullscreen | 每次输入在 Ink `<canvas>` 中重绘 512 根柱和一条 512 段折线，坐标由操作序号确定。 |

外层浏览器视口为 800 × 800。host 声明 inline/fullscreen 支持、禁用 HTTP 缓存、使用禁止网络的 UI CSP，并传入固定参数。源码在 [agent/](agent/)。列表仅在滚动到目标窗口并稳定后确认操作；不提供 `scrollend` 的 runtime 使用固定 100ms 静默窗口，该等待计入延迟，因此列表延迟不能解释为纯布局耗时。仪表盘数据按 tick 确定，实际 tick 数可能随运行速度变化。

## 指标与正确性

| 指标 | 测量方式 |
| --- | --- |
| 首次验证画面 | 从 **iframe 导航开始**到出现业务状态消息、Canvas 渲染提交和预期标记像素；另行检查业务区域有可见内容。 |
| 实际操作验证的 TTI | 从同一时间原点到首次真实指针操作成功绘制更新。它包含自动化与就绪等待，是上界，不是 Lighthouse TTI。 |
| 输入到显示的代理指标 | 从可信 DOM `pointerdown` 到包含预期标记像素的渲染轮次中最后一次 Canvas2D 表面修改。报告 min/median/p95/max/mean 和原始样本，包含点击手势与应用逻辑。 |
| 帧间隔与丢失槽位 | 操作期间浏览器 `requestAnimationFrame` 的间隔。丢失槽位为 `max(0, round(interval / targetPeriod) - 1)`；比例为丢失数 /（已观察间隔数 + 丢失数）。这是调度估算，**不是 GPU/compositor 的实际掉帧数**。 |
| Canvas 提交 | 出现 Canvas2D 表面修改的渲染轮次，与浏览器帧机会分开统计；覆盖矢量绘制和位图提交。 |
| 空闲 CPU | Chromium CDP `TaskDuration` 增量 / CDP 实际时间，以一个主线程的百分比表示。包括 host 与采集器开销；仪表盘数据流已暂停。 |
| 内存 | 通过 `ps` 采样当前独立 Chromium 各进程的 RSS 总和，另行记录 CDP JS heap 和导出的 WASM 线性内存 buffer，分别报告峰值与原始样本。 |

内存采样覆盖导航、启动、交互、空闲和截图验证。RSS 可能重复计算共享内存，包含浏览器、renderer、utility 进程，不能当作精确瞬时峰值或 GPU 分配量。WASM 线性内存也不等于整个 runtime 的内存。当前不支持 Windows RSS 测量，会明确报错。

测量代码只注入基准浏览器上下文，包装 Canvas2D 修改方法，每次输入只回读一个很小的标记像素。该开销、就绪轮询、CDP 采样及截图属于本 harness；A/B 必须保持方法一致。操作系统文件缓存、机器负载和温度不会重置。每个样本使用新的 Chromium 进程与 profile，避免复用上一次的浏览器/WASM 缓存。

每次操作必须产生预期序号和标记像素。检查还覆盖计数、列表窗口与挂载行数、仪表盘选择与真实 tick、Canvas 几何数量、业务区域非空及像素 hash 变化、Canvas 尺寸，以及浏览器/runtime 错误。每个样本保存预热后截图（序号 1）和最终截图（序号 operations + 1），供视觉复核。这些检查不能证明每个字形正确，发布数据前应检查 PNG。失败会保存诊断与截图，以非零状态退出，并把 `status.json` 标为 `failed`，避免误用旧报告。

## 单独测量服务端与体积

启动浏览器之前，通过 SDK 初始化、发现并读取真实生成的 **stdio MCP server**。`benchmark_card` 业务 handler 返回 `value + 1`，保留正常 MCPKit 契约验证。预热 10 次之后，分别执行 1,000 次串行调用、1,000 次并发度为 4 的调用，使用**一个客户端连接**。记录初始化、资源读取、吞吐、调用延迟分布、结果验证和 RSS 快照。这不是 HTTP、多客户端、外部服务或渲染吞吐基准。

体积分开报告：

- 安装后的生产/共享依赖与仅开发依赖：按 `package-lock.json` 的 `dev` 标记统计普通文件逻辑字节，记录实际安装版本；跳过当前平台未安装的 optional 包，不重复统计嵌套包，不跟随符号链接。另行报告安装总量及未分类包/安装元数据。
- npm 包：构建库之后执行 `npm pack --dry-run --ignore-scripts --json`，记录 tarball 压缩体积与解包体积。
- 生成插件：总字节及 server/view/manifest/types 各文件字节。
- UI 资源：HTML、序列化 MCP 资源 JSON、gzip HTML。gzip 用于比较，不意味着 stdio 或桌面 host 会压缩该资源。
- runtime：WASM 原始与 gzip 字节及 SHA-256。

## 报告与 A/B 比较

输出目录包含 `report.json`、`report.md`、`status.json`、`screenshots/` 和生成的 `plugin/`。JSON 记录参数、场景、fixture/host hash、Node/Chromium/Ink/SDK 版本、机器与 OS、Git revision/dirty 状态、构建配置、原始样本和测量边界。Markdown 展示多个独立样本中各指标的中位数。共享 CI runner 不使用性能数值阈值。

使用一致的配置运行两次：

```sh
npm run bench -- --label before --out benchmark-results/before
# 应用候选 MCPKit/runtime 修改并重新构建。
npm run build
npm run bench -- --label after --out benchmark-results/after \
  --baseline benchmark-results/before/report.json
```

`comparison.json` 记录前后数值、绝对与百分比变化，以及 runtime 版本/hash；基线为零时百分比为 null。机器/OS、host/fixture/测量代码 hash、Node/Chromium/协议/Playwright/esbuild/TypeScript 版本、场景集合及测量参数必须一致。Ink 版本/WASM hash 和 MCPKit revision 可有意不同。环境不一致时拒绝比较，避免把环境变化归因于候选实现。差异本身不能证明稳定提升，应检查方差与原始样本。

比较已发布 Ink 候选版本时，可在独立 checkout 中执行 `npm install --no-save --package-lock=false @yodaos-pkg/ink@<candidate-version>`，然后构建、运行第二次基准；结束后用 `npm ci` 恢复锁文件对应的安装。脚本不会自动替换依赖。

API 参考：[Playwright CDPSession](https://playwright.dev/docs/api/class-cdpsession)、[Chromium Performance domain](https://chromedevtools.github.io/devtools-protocol/tot/Performance/)、[Chromium SystemInfo domain](https://chromedevtools.github.io/devtools-protocol/tot/SystemInfo/)。
