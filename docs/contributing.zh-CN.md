# 参与贡献

[English](contributing.md) | 简体中文 · [学习路线](README.zh-CN.md)

欢迎体验示例、接入新的宿主，或改进构建 API。[提交问题](https://github.com/yodaos-project/aiui-mcpkit/issues)时，请附上客户端版本、构建命令和复现步骤；Claude Desktop 和其他 MCP Apps 宿主的实测反馈尤其有帮助。

| 命令 | 用途 |
| --- | --- |
| `npm run build` | 构建 ESM 库、类型声明和运行时模板 |
| `npm run build:examples` | 构建六个示例及共享 marketplace |
| `npm run update:examples` | 更新已安装示例的界面、服务端及 manifest |
| `npm run start:examples` | 启动 Counter，或用 `-- business` 选择业务示例 |
| `npm run watch:examples -- counter` | 启动新手浏览器预览，保存后重建 |
| `npm run typecheck` | 检查 TypeScript 类型 |
| `npm test` | 运行打包、MCP 和浏览器测试 |
| `npm run bench` | 测量渲染、服务端和打包基线 |
| `npm run verify:plugin -- <plugin-directory> ...` | [验证就绪状态并截取 Agent PNG](guides/preview-verification.zh-CN.md) |

提交代码改动前运行：

```sh
npm run build:examples
npx playwright install chromium
npm run typecheck
INK_WORKER_BIN=/absolute/path/to/ink-worker npm test
```

原生宿主按[业务工具配置](guides/business-tools.zh-CN.md)构建。只使用已发布的 npm 依赖时，可运行 `INK_WORKER_BIN="$PWD/scripts/ink-worker-wasm.mjs" npm test` 执行完整套件。CI 选择此通用宿主，通过公开 SDK 的真实 Ink QuickJS/WASM 执行同一组 Worker Action，无需检出私有源码。浏览器测试在 MCP Apps `AppBridge` 测试环境中运行真实 Agent，覆盖输入、状态连续性、显示模式和禁止网络访问的 CSP。可以通过 `CHROMIUM_PATH` 指定已有 Chromium，也支持可用的 `/usr/bin/chromium`。修改文档时请保持中英文 README 一致。

[查看源码](https://github.com/yodaos-project/aiui-mcpkit) · [反馈问题](https://github.com/yodaos-project/aiui-mcpkit/issues) · [了解 AIUI](https://github.com/yodaos-project/AIUI)

## 执行 benchmark 正确性检查

修改打包、运行时或协议行为时，执行与 Benchmark workflow 相同的 smoke 负载：

```sh
npm run bench -- --samples 1 --operations 3 --idle-ms 250 \
  --server-calls 8 --out benchmark-results/ci
```

检查覆盖四个真实 WASM 场景和服务端负载，不设置性能阈值；请在 macOS/Linux 执行。完整方法和 A/B 测量见[性能基准](reference/benchmarks.zh-CN.md)。本地命令通过不代表 GitHub Actions 已通过，远端 workflow 需要已推送的提交或 PR。

## 修改文档

保持[学习路线](README.zh-CN.md)渐进式：读者先在一篇教程里得到能看到的结果，再学习下一种能力。

1. 代码前写清目标、前置条件与命令执行目录。
2. 在第一次用到时解释新术语，将协议契约和实现细节放进参考或进阶页面。
3. 完整文件标注路径；片段说明插入位置。区分终端命令、对话提示词与工具输入。
4. 给出预期结果、完成检查和一个下一步。客户端安装、Worker 与自动化在用到它们的教程中再引入。
5. 保持中英文文章、导航与示例一致，保留已有公开路径和 benchmark 转发页。
6. 检查链接、锚点、Markdown/代码语法与渲染布局。教程命令或完整示例改变时，实际走通该路径并记录结果。纯文档改动无需运行无关的运行时 benchmark。

可运行示例应链接到源码，验证记录区分本地预览、真实桌面宿主与模型行为。详细解释优先写入 `docs/`，根 README 保留简短入口。

---

[学习路线](README.zh-CN.md) · 上一篇：[性能基准](reference/benchmarks.zh-CN.md)
