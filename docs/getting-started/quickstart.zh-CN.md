# 运行第一个预览

[English](quickstart.md) | 简体中文 · [学习路线](../README.zh-CN.md)

**这一课的结果：** 在本地打开一个计数器，点击按钮就能改变数字。需要 Node.js 22+、Git 和浏览器，不需要助手客户端或 API Key。工具没有安装好时，先按[准备环境](installation.zh-CN.md)操作。

## 1. 下载并安装

打开终端，运行：

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
npm ci
```

已经完成“准备环境”？保留那个位于仓库根目录的终端，直接进入第 2 步。

## 2. 打开预览

在仓库根目录运行：

```sh
npm run watch:examples -- counter
```

等待终端出现包含 `"type":"preview"` 的一行，把其中的 `url` 复制到浏览器。地址以 `http://127.0.0.1:` 开头，端口会自动分配。使用预览期间，请保持终端中的命令运行。

命令会构建库和 Counter，并监听源码变化。你应该看到绿色计数器，初始值为 **0**。Ink 有时将数字显示为 `0.0`，含义相同。

## 3. 点击按钮

点击一次 **+ ADD ONE**，数字变为 **1**。再点一次，变为 **2**。

**完成检查：** 预览地址能打开、能看到 Counter、点击能改变数字。你已经通过 Ink/WASM 跑起了一个真实的 AIUI 应用。

要结束预览，回到终端按 **Ctrl+C**。下次用相同命令重新启动；新的预览从零开始。

## 刚才运行了哪些东西

- **源码：** `examples/counter/`，这里的文件可以编辑。
- **构建产物：** `dist/watch/counter/`，由工具生成。修改源码，不要直接修改这个目录。
- **预览页面：** 提供运行应用需要的宿主连接。直接双击生成的 `view.html` 无法完成初始化。

预览可以提供工具参数、显示界面；它不会运行 AI 模型、发送对话消息或执行服务端业务工具。后面的教程再接入真实客户端。

## 没有成功时

| 现象 | 先做什么 |
| --- | --- |
| 找不到 `node` 或 `npm` | 按[准备环境](installation.zh-CN.md)检查安装。 |
| npm 找不到 `package.json` | 在 `aiui-mcpkit` 仓库根目录打开终端。 |
| 浏览器连接失败 | 保持命令运行，并复制最新 `preview` 行中的地址。 |
| 页面空白或构建报错 | 先读终端错误，再看[故障排查](../guides/troubleshooting.zh-CN.md)。 |

**下一步：** [修改第一个按钮](edit-example.zh-CN.md)。想先看彩色示例？停止 Counter，运行 `npm run watch:examples -- travel`；其他 ID 见[示例集合](../../examples/README.zh-CN.md)。
