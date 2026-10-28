# MCPKit 宣传短片

[English](README.md) · [观看成片](../../docs/assets/mcpkit-showcase.mp4) · [无背景音乐版](../../docs/assets/mcpkit-showcase-nobgm.mp4)

**An idea. Now in view.** 33 秒英文版、1920×1080、30 fps。通过大字标题、轻量窗框与整洁网格突出产品，使用 [AIUI 官网](https://open.rokid.com/aiui/?lang=en-US)的 Rokid Glasses 官方产品图；保留实测 130 BPM 的文字、点击、卡片入场和切点。新增电脑／眼镜篇章，明确展示 Codex、Claude Code 与 AIUI on Rokid Glasses；主线围绕“在 Codex 对话内打开应用 → 独立视图继续操作 → 保留选择返回对话”展开。巨型文字、黑／暖白／钴蓝色块与连续展开的应用卡片构成视觉主线，四个真实示例呈现蓝、珊瑚、紫与陶土色的差异。

按本片已确认的素材方案，Codex 对话外壳在原有头栏以轻量的 **UI illustration** 标注为示意，应用画面来自真实运行时；来源和宿主能力说明保留在文档中。同一个本地 MCP Apps AppBridge 和 View 完成 inline → fullscreen → inline 流程，状态断言验证两次切换均保留选择。跨端篇章使用桌面外壳示意与眼镜官方产品图，未向镜片叠加界面，不作为硬件录屏或跨设备状态同步的证明。Claude Code 是 MCP 工具客户端名称，未被描绘为已验证的内联界面宿主；AIUI 智能体通过其设备工作流运行于 Rokid Glasses，不声称生成的 stdio 服务可原样运行在眼镜上。本片不作为原生 Codex 录屏或独立网站部署的证明。数据均为演示内容或虚构数据，没有真实预约或模型回复。

## 复现

在仓库根目录执行：

```sh
npm ci
npm run build:examples
npx playwright install chromium
npm run capture:examples
npm run capture:modes
cd videos/showcase
npm ci
npm run dev
```

打开 Remotion 输出的 Studio 地址，选择 `MCPKitShowcase`。导出：

```sh
npm run typecheck
npm run render:all
```

该命令需要 PATH 中存在 FFmpeg，先从同一时间线渲染两种音轨，再复用同一条已编码视频轨，保证两版逐帧一致。也可分别使用 `render` 与 `render:nobgm`。输出更新 `docs/assets/` 下的两个 MP4，后者保留音效。Remotion 会按需下载浏览器；要使用已有浏览器，可在渲染命令后附加 `-- --browser-executable=/absolute/path/to/chromium`。

`capture:examples` 更新 README 截图，将交互过程的中间截图写入已忽略的 `out/captures/`；`capture:modes` 连续采集模式切换，并将状态断言写入 `public/textures/modes.json`。修改 `.ink` 后应重新采集。本地宿主不安装插件，也不向真实对话发送消息。

## 编辑

- `src/timeline.ts`：共用的镜头时间与音效相对时间。
- `src/ConversationFilm.tsx`：对话外壳示意、文案、真实截图状态、光标路径与展开动效。
- `src/Main.tsx`：镜头轨道与可选配乐。
- `src/workbench.ts`：video-shotcraft 工作台清单，可改标题与配乐音量。
- `design.md`：简报、视觉判断、分镜与镜头适配说明。
- `styleframes.html`：静态视觉方向帧，通过 HTTP 服务打开。

安装 video-shotcraft 后，可运行 `node /path/to/video-shotcraft/workbench/scripts/open.mjs /absolute/path/to/videos/showcase`。未安装该技能时，仍可用独立的 Remotion 工程编辑和导出。

## 来源

UI 截图来自本仓库编译后示例的真实 Ink 渲染。应用卡片展开是参考 video-shotcraft `shot-transitions` 语法自定义的平面匹配运动，不声称复刻其纵深空间变体。[Video-shotcraft](https://vincentwei1021.github.io/video-shotcraft/)。

配乐为 **Arulo 的 Cat Walk**，[Mixkit 原曲](https://assets.mixkit.co/music/371/371.mp3)，按小节剪成 72 拍（33.233 秒）。音效来自技能的 Mixkit 素材库。[文件对应关系](ASSETS.md)。没有使用配音、客户数据或密钥。`analysis/music/music-edit.json` 记录原曲的精确剪辑区间，`src/timeline.ts` 保留实测节拍锚点，`analysis/rendered/sync-report.json` 记录成片音轨的对齐结果。生成的分析过程数据与审查截图不纳入工程。

[最终审查记录](review.md)
