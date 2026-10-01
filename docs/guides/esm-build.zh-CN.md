# 接入 ESM 库

[English](esm-build.md) | 简体中文 · [文档目录](../README.zh-CN.md)

**目标：** 在独立 Node 项目中构建 Agent。先完成[第一个 Agent](../getting-started/first-agent.zh-CN.md)，准备好源码，无需安装全局 MCPKit CLI。

## 准备使用方项目

在自己的空项目目录执行：

```sh
npm init -y
```

在其中创建 `agent/`，把 `app.json` 和 `pages/` 复制进去。另开终端，在 MCPKit 仓库执行 `npm pack` 生成 tarball；回到自己的项目目录，再执行下方的 `npm install`、创建构建脚本和 `node build-agent.mjs`。`.mjs` 直接使用 ESM，无需修改 `package.json` 的 `type`。

如果你在开发打包工具或自动构建流程，可以直接从 JavaScript 调用 MCPKit，无需启动 CLI 子进程。

要使用当前仓库中的包，先在 MCPKit 仓库运行 `npm pack`。它会构建库并生成 `yodaos-pkg-aiui-mcpkit-0.1.0.tgz`。然后在自己的 Node.js 项目中安装这个文件：

```sh
npm install /absolute/path/to/aiui-mcpkit/yodaos-pkg-aiui-mcpkit-0.1.0.tgz
```

在自己的项目中创建 `build-agent.mjs`：

```js
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

const result = await buildPlugin({
  source: './agent',
  name: 'my-agent',
  outputDir: './dist/plugin',
  version: '1.0.0',
});

console.log(result.outputDir);
console.log(result.files.view);
```

运行 `node build-agent.mjs` 即可打包。相对路径基于执行命令时所在的目录解析。返回结果包含插件身份、绝对输出目录、marketplace 名称和生成文件的路径。

API 导出 `BuildPluginOptions` 和 `BuildPluginResult` 类型。错误通过 Promise rejection 返回，不输出日志、不退出进程、不修改工作目录。这也是 AIX 等工具的集成入口；`aix pack --target mcp-apps` 计划在 AIX 中单独实现。

## 验证并安装

本例在自己的项目中生成 `dist/plugin/`。确认其中包含 `plugin.json`、`view.html` 和 `dist/server.mjs`。按[第一个 Agent](../getting-started/first-agent.zh-CN.md)的插件路径安装该目录，或在[客户端](clients.zh-CN.md)注册服务的绝对路径。生成的服务已打包运行依赖，构建依赖安装在使用方项目，不必安装到产物目录。

把构建脚本纳入版本管理，忽略生成的插件目录。按需添加元数据、策略和 handler 选项，默认值及约束见 [BuildPluginOptions](../reference/build-api.zh-CN.md)。

---

[文档目录](../README.zh-CN.md) · 上一篇：[公开元数据](metadata.zh-CN.md) · 下一篇：[客户端接入](clients.zh-CN.md)
