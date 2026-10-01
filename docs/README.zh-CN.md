# 完整文档与教程

[English](README.md) | 简体中文 · [文档目录](README.zh-CN.md)

这里是 AIUI MCPKit 的完整文档。第一次使用请按入门顺序阅读；遇到具体问题可直接进入主题指南或参考。所有教程基于本仓库实际 API，终端命令会注明执行目录。

## 新手阅读顺序

1. [认识 MCPKit](getting-started/overview.zh-CN.md) — 概念、工作流程和能力边界。
2. [准备环境](getting-started/installation.zh-CN.md) — 安装工具、获取源码、区分不同目录。
3. [运行示例](getting-started/quickstart.zh-CN.md) — 安装 Counter 与业务示例，验证结果。
4. [创建第一个 Agent](getting-started/first-agent.zh-CN.md) — 完整文件、构建安装、添加按钮。

## 主题指南

| 文档 | 内容 |
| --- | --- |
| [页面工具](guides/page-tools.zh-CN.md) | 输入 schema、页面路由与启动参数 |
| [带类型的业务工具](guides/business-tools.zh-CN.md) | Handler、生成类型、结果和错误 |
| [请求生命周期](guides/tool-lifecycle.zh-CN.md) | 加载、进度、取消、超时与重试 |
| [公开元数据](guides/metadata.zh-CN.md) | 合并规则、自定义资源与协议检查 |
| [ESM 构建接入](guides/esm-build.zh-CN.md) | 在自己的 Node 项目中使用 MCPKit |
| [客户端接入](guides/clients.zh-CN.md) | Codex、Claude Desktop、VS Code 与 stdio |
| [开发迭代](guides/development.zh-CN.md) | 重新构建、同步安装副本、重载界面 |
| [故障排查](guides/troubleshooting.zh-CN.md) | 定位构建、发现、调用和渲染问题 |

## 参考手册

| 文档 | 内容 |
| --- | --- |
| [构建 API](reference/build-api.zh-CN.md) | 全部选项、产物与公开导出 |
| [页面消息](reference/messages.zh-CN.md) | 输入、结果格式与生命周期事件 |
| [协议兼容性](reference/compatibility.zh-CN.md) | 版本、协商、验证情况与范围 |
| [性能基准](reference/benchmarks.zh-CN.md) | 场景、指标、报告和 A/B 比较 |

## 项目贡献

| 文档 | 内容 |
| --- | --- |
| [参与贡献](contributing.zh-CN.md) | 仓库检查与贡献约定 |

## 按目标找文档

想快速看到界面：快速开始 → 客户端接入。想写自己的应用：第一个 Agent → 页面工具 → 业务工具 → 生命周期。想集成构建系统：ESM 接入 → 构建 API → 元数据。想测量或修改运行时：参与贡献 → 协议兼容性 → 性能基准。

## 文档约定与来源

代码块中 `/path/to/...` 和 `/absolute/path/...` 是需替换的路径；工具调用示例不是终端命令。`view.html` 需要 Apps 宿主。中英文文章使用一一对应文件和语言切换入口。

目录组织参考 [mcp-use 文档](https://docs.mcp-use.com/llms.txt)的入门、主题指南、调试与 API 参考分层；内容依据 MCPKit 源码编写，mcp-use 的命令或服务能力不能直接用于本项目。兼容性说明区分协议支持、浏览器验证与实际桌面宿主验证。

[返回项目 README](../README.zh-CN.md)

---

[文档目录](README.zh-CN.md)
