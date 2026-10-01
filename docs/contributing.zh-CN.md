# 参与贡献

[English](contributing.md) | 简体中文 · [文档目录](README.zh-CN.md)

欢迎体验示例、接入新的宿主，或改进构建 API。[提交问题](https://github.com/yodaos-project/aiui-mcpkit/issues)时，请附上客户端版本、构建命令和复现步骤；Claude Desktop 和其他 MCP Apps 宿主的实测反馈尤其有帮助。

| 命令 | 用途 |
| --- | --- |
| `npm run build` | 构建 ESM 库、类型声明和运行时模板 |
| `npm run build:examples` | 构建两个示例及共享 marketplace |
| `npm run update:examples` | 更新已安装示例的界面、服务端及 manifest |
| `npm run start:examples` | 启动 Counter，或用 `-- business` 选择业务示例 |
| `npm run typecheck` | 检查 TypeScript 类型 |
| `npm test` | 运行打包、MCP 和浏览器测试 |
| `npm run bench` | 测量渲染、服务端和打包基线 |

提交代码改动前运行：

```sh
npm run build:examples
npx playwright install chromium
npm run typecheck
npm test
```

浏览器测试在 MCP Apps `AppBridge` 测试环境中运行真实 Agent，覆盖输入、状态连续性、显示模式和禁止网络访问的 CSP。可以通过 `CHROMIUM_PATH` 指定已有 Chromium，也支持可用的 `/usr/bin/chromium`。修改文档时请保持中英文 README 一致。

[查看源码](https://github.com/yodaos-project/aiui-mcpkit) · [反馈问题](https://github.com/yodaos-project/aiui-mcpkit/issues) · [了解 AIUI](https://github.com/yodaos-project/AIUI)

## 执行 benchmark 正确性检查

修改打包、运行时或协议行为时，执行与 Benchmark workflow 相同的 smoke 负载：

```sh
npm run bench -- --samples 1 --operations 3 --idle-ms 250 \
  --server-calls 8 --out benchmark-results/ci
```

检查覆盖四个真实 WASM 场景和服务端负载，不设置性能阈值；请在 macOS/Linux 执行。完整方法和 A/B 测量见[性能基准](reference/benchmarks.zh-CN.md)。本地命令通过不代表 GitHub Actions 已通过，远端 workflow 需要已推送的提交或 PR。

## 修改文档

保持文章对、中英文入口和目录一致。API 变化时更新公开示例，提供链接到源码的可运行参考，区分实际宿主观察和浏览器测试验证。详细说明优先写入 `docs/`，避免继续扩充根 README。保留 benchmark 转发页，兼容原源码目录入口。

---

[文档目录](README.zh-CN.md) · 上一篇：[性能基准](reference/benchmarks.zh-CN.md)
