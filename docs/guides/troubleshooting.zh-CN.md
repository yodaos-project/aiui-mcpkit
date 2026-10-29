# 故障排查

[English](troubleshooting.md) | 简体中文 · [学习路线](../README.zh-CN.md)

从最先失败的一步开始。第一次预览的问题，通常通过终端与浏览器就能定位，之后再按需要使用开发检查工具。

## 先找到你停在哪一步

| 当前进度 | 接下来检查什么 |
| --- | --- |
| 命令无法执行 | 检查 Node 22+、npm、依赖以及仓库根目录。[准备环境](../getting-started/installation.zh-CN.md) |
| 监听在运行，但页面打不开 | 复制最新 `preview` 地址，并保持终端运行。[快速开始](../getting-started/quickstart.zh-CN.md) |
| 页面打开，但改动不生效 | 读构建错误，区分源码、预览产物与安装副本。[开发迭代](development.zh-CN.md) |
| 客户端找不到或无法调用工具 | 检查服务配置与当前会话的工具列表。[客户端接入](clients.zh-CN.md) |
| 业务或对话操作失败 | 检查输入、处理函数与所需宿主能力。[第一个业务工具](first-business-tool.zh-CN.md) |

浏览器预览与 stdio 服务是两个入口：监听程序输出网页地址，生成的服务通常等待客户端启动并调用。

## 常见问题

| 现象 | 检查与处理 |
| --- | --- |
| 找不到 `node` / `npm`，或 Node 低于 22 | 安装 Node 22+，重开终端并执行 `node --version`。桌面应用 PATH 不同时配置 Node 的绝对路径。 |
| 没有 `codex plugin` 命令 | 检查 `codex plugin --help`，使用支持该命令的 CLI，或按[客户端接入](clients.zh-CN.md)直接注册 stdio。 |
| 没有生成 `dist/server.mjs` | 在仓库根目录执行 `npm run build:examples`，或重新构建自己的 Agent。客户端指向产物，不是源码。 |
| 构建提示找不到初始页面或页面文件 | `source` 直接包含 `app.json`；检查各 `pages` 路径，清单中不写 `.ink`，实际文件必须存在。 |
| 名称、schema 或元数据无效 | 读取诊断中的字段路径，按[构建 API](../reference/build-api.zh-CN.md)检查命名，解析 schema 本地引用，按[元数据](metadata.zh-CN.md)修正类型与位置。 |
| 输出目录错误 | 输出不能等于或包含源码目录。使用 `source/dist/plugin` 或同级产物目录，不要选择源码的父目录。 |
| 缺少 handler 或生成类型 | 每个 `schema.output` 工具都有 handler；先构建再检查类型，`typesFile` 与类型导入一致，见[业务工具](business-tools.zh-CN.md)。 |
| `node .../server.mjs` 一直没有输出 | stdio 正在等待 MCP 协议输入，这是正常情况。通过客户端使用，没有 HTTP URL；手动进程用 Ctrl+C 停止。 |
| 客户端内服务启动失败 | 检查 Node 路径与版本、服务绝对路径和客户端日志。手动配置不要保留字面量 `${PLUGIN_ROOT}`，应使用真实绝对路径。 |
| 插件安装成功但找不到工具 | 重载宿主或服务，检查当前会话的 MCP 和工具配置。确认目录索引和插件标识，仓库 Counter 使用 `ink-counter@aiui-mcpkit-examples`。 |
| `open_app` 消失了 | 声明 `schema.data` 后会发现页面工具，替代兜底 opener。改用显式工具名或按路径生成的名称。 |
| 参数缺失或类型错误被拒绝 | 查看实际输入 schema。`open_countdown` 需要正整数 `start`；数字字符串不等于整数。 |
| 返回工具数据但没有界面 | 客户端可能没有 Apps 或 MIME 能力。检查[兼容性](../reference/compatibility.zh-CN.md)、WASM 权限及资源大小限制。 |
| 直接打开 `view.html` 没有可用界面 | 需要 Apps 宿主提供初始化和工具通知，单独 HTML 没有这些通道。 |
| 重新构建后没有变化 | 比较源码、安装文件、实际服务响应和已加载文档的 ID 与字节，见[构建诊断](build-diagnostics.zh-CN.md)，再更新、重载并检查新卡片。 |
| `update:examples` 找不到已安装插件 | 先安装仓库示例；直接注册的服务使用 `build:examples`；自己的 Agent 使用自己的构建与更新流程。 |
| CALCULATE 没有反应或工具不可用 | 检查宿主 `serverTools`、工具权限、名称和唯一 ID；同时处理 `error` 和 `ready`，见[消息参考](../reference/messages.zh-CN.md)。 |
| 错误或取消后一直加载 | 在 `ready`、`error`、`cancelled` 都停止加载，按 requestId 关联；进度不代表完成。 |
| `INVALID_OUTPUT` | Handler 结果不符合 `schema.output`，修正 `structuredContent`，重建类型和服务再测试。 |
| 取消界面没有撤销业务操作 | 把 `signal` 传到真实服务调用。取消能停止等待或中断工作，无法回滚已完成操作。 |
| 浏览器测试无法启动 Chromium | 执行 `npx playwright install chromium`；Linux 缺系统库时使用 `--with-deps`，也可用 `CHROMIUM_PATH` 指定已有可执行文件。 |
| Windows 上 benchmark 失败 | RSS 测量目前要求 macOS/Linux，请在支持的环境执行。 |
| Benchmark A/B 比较被拒绝 | 保持机器、方法、fixture/宿主、工具版本和参数一致，见[性能基准](../reference/benchmarks.zh-CN.md)。 |

## 检查已经运行的请求

应用能运行后，可以用 [Inspector](inspector.zh-CN.md)查看真实调用、结果与上下文发布。用 `buildPlugin({ ..., inspector: true })` 或 `--inspector` 开启，重新构建并打开 View；脱敏诊断也会记录浏览器、WASM、CSP 与资源错误。

## 调试宿主前先检查元数据

在 ESM 构建脚本中调用 `result.inspectProtocol(capabilities)`，比较工具的 `resourceUri` 与资源列表。不传 Apps 能力时，检查结果会有意省略 UI 元数据。完整代码见[元数据检查示例](metadata.zh-CN.md)。检查证明序列化结果，不会打开界面，也不能证明宿主支持。

## 缩小问题范围

1. 用未修改的 Counter 重现，区分自定义源码问题和客户端配置问题。
2. 工具发现正常时，使用快速开始中的明确 JSON 参数调用。
3. 仅页面主动调用失败时，对比宿主能力和权限，查看 `mcpkit:tool-state` 消息。
4. 修改了运行时或打包逻辑时，执行[贡献指南](../contributing.zh-CN.md)中的本地检查。
5. 渲染异常时记录实际宿主错误，检查 UI 沙箱和资源策略；浏览器测试环境通过不代表桌面宿主一定兼容。

## 提交可复现的问题

附上操作系统、Node 与客户端版本、MCPKit Git revision 或包版本、构建命令、接入方式、工具名与参数、预期与实际结果，以及最小源码。明确失败发生在启动、发现、调用还是渲染阶段。提供脱敏后的 stderr、客户端和浏览器诊断，保留错误代码，移除凭据。

[提交 Issue](https://github.com/yodaos-project/aiui-mcpkit/issues)。Benchmark 问题还应附上参数、`status.json`、报告和截图，而不是只有一个耗时数字。

---

[学习路线](../README.zh-CN.md)
