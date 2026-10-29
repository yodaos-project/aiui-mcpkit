# MCPKit 渐进式学习路线

[English](README.md) | 简体中文 · [学习路线](README.zh-CN.md)

第一次开发 AI 应用？先从浏览器和一个按钮开始。基础 JavaScript 加上文本编辑器就能做出第一个界面，协议知识和 AI 账号可以用到时再了解。

## 从这里开始

[运行第一个预览 →](getting-started/quickstart.zh-CN.md)

你会在本地打开 Counter，点击按钮改变数字。Node.js、Git 或终端还没准备好？先看[准备环境](getting-started/installation.zh-CN.md)。想先理解项目用途？读[认识 MCPKit](getting-started/overview.zh-CN.md)。

## 沿着主线学习

每篇只增加一种能力，并以能看到的结果结束。前三步都在浏览器完成，准备好后再连接助手。

1. **[运行预览](getting-started/quickstart.zh-CN.md)** — 一个能点击的 Counter，无需安装客户端。
2. **[修改按钮](getting-started/edit-example.zh-CN.md)** — 保存后就能在预览中看到的改动。
3. **[创建自己的应用](getting-started/first-agent.zh-CN.md)** — 两个源文件，以及你自己的可用按钮。
4. **[添加工具参数](guides/page-tools.zh-CN.md)** — 一个接受校验后参数、打开应用的命名工具。
5. **[连接 AI 客户端](guides/clients.zh-CN.md)** — 助手能发现、调用的工具。
6. **[返回业务结果](guides/first-business-tool.zh-CN.md)** — 一个服务端函数，把 CNY 40 同时返回给助手和界面。

每完成一篇都可以停下来动手尝试。基础路线不要求先学习 Worker、协议元数据、状态恢复或自动化浏览器测试。

## 按需求增加功能

| 你现在想做什么 | 阅读哪篇 | 开始前已有的基础 |
| --- | --- | --- |
| 体验其他界面 | [示例集合](../examples/README.zh-CN.md) | 能运行本地预览 |
| 提高修改效率、更新已安装应用 | [开发迭代](guides/development.zh-CN.md) | 已创建第一个应用 |
| 点击按钮发送消息、分享选中状态 | [Agent 会话](guides/agent-session.zh-CN.md) | 已连接 Apps 客户端 |
| 实现商品候选选择流程 | [候选选择](guides/candidate-selection.zh-CN.md) | 了解业务工具与 Agent 会话 |
| 显示进度、错误与取消状态 | [请求生命周期](guides/tool-lifecycle.zh-CN.md) | 已跑通业务调用 |
| 在其他 Node.js 项目中使用 MCPKit | [ESM 接入](guides/esm-build.zh-CN.md) | 已有能构建的应用 |

## 进阶指南：有具体需求时再读

| 需求 | 对应指南 |
| --- | --- |
| 多个工具更新同一个已打开的应用 | [共享 App](guides/shared-agent.zh-CN.md) |
| View 销毁后恢复指定状态 | [作用域恢复](guides/state-restoration.zh-CN.md) |
| 使用 Worker 执行方式，或部署其宿主 | [业务工具](guides/business-tools.zh-CN.md) · [运行时集成](guides/runtime-integration.zh-CN.md) |
| 定制资源元数据、网络访问声明 | [元数据](guides/metadata.zh-CN.md) |
| 检查请求或上下文发布过程 | [Inspector](guides/inspector.zh-CN.md) |
| 截图并验证界面就绪状态 | [预览验证](guides/preview-verification.zh-CN.md) |
| 将录制的交互变成回归检查 | [录制与回放](guides/interaction-replay.zh-CN.md) |
| 查明实际运行的是哪个版本 | [构建诊断](guides/build-diagnostics.zh-CN.md) |

## 需要时查参考手册

参考手册用于查字段和行为，不要求按顺序阅读。

- [构建 API](reference/build-api.zh-CN.md)：选项、文件、类型与导出。
- [消息格式](reference/messages.zh-CN.md)：页面输入、结果与请求状态。
- [兼容性](reference/compatibility.zh-CN.md)：协议版本、宿主要求和验证边界。
- [性能基准](reference/benchmarks.zh-CN.md)：测量方法与报告。

## 遇到问题，或想参与贡献

用[故障排查](guides/troubleshooting.zh-CN.md)定位最先失败的步骤。[参与贡献](contributing.zh-CN.md)介绍仓库检查和问题反馈方式。

文档中的 **shell 代码块**在终端执行，**对话提示词**发给助手，**文件内容**会标出要创建或修改的路径。代码前会说明是完整文件还是集成片段。公开指南都有对应的中英文版本。

[返回项目 README](../README.zh-CN.md)
