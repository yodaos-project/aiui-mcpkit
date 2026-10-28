# MCPKit showcase film

[简体中文](README.zh-CN.md) · [Watch the film](../../docs/assets/mcpkit-showcase.mp4) · [No background music](../../docs/assets/mcpkit-showcase-nobgm.mp4)

**An idea. Now in view.** A 33-second English film at 1920×1080 / 30 fps, from an interactive conversation to a dedicated view, then back with your choices preserved. Four distinct apps and a desktop/glasses chapter name Codex, Claude Code and AIUI on Rokid Glasses. Large headlines, light window frames and a clean grid keep the focus on the product. The official Rokid product image from the [AIUI site](https://open.rokid.com/aiui/?lang=en-US) and measured 130 BPM edit remain.

The Codex conversation shell uses a quiet **UI illustration** label in its header; app screens are actual runtime captures. Source credits and host limitations are documented here instead of on-screen banners. One local MCP Apps AppBridge and one View run the whole inline → fullscreen → inline sequence; state assertions verify that selection survives both changes. The desktop frame is illustrated; the glasses are the official product image, with no UI composited into their lenses. This is not hardware footage or a claim of cross-device state synchronization. Claude Code is named as an MCP tool client, not presented as a verified inline UI host. The AIUI agent targets Rokid Glasses through its device workflow; the generated stdio server is not claimed to run unchanged on the glasses. This is not a native Codex recording or a hosted standalone website. Data is curated or synthetic; no real booking or model response is represented.

## Reproduce

From the repository root:

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

Open the Studio URL printed by Remotion and choose `MCPKitShowcase`. Export with:

```sh
npm run typecheck
npm run render:all
```

FFmpeg must be on PATH. The script renders both soundtrack variants from the same timeline, then reuses one encoded picture track for exact frame identity. Individual `render` and `render:nobgm` scripts are also available. Exports update both MP4s in `docs/assets/`; the second keeps sound effects. Remotion downloads its browser if needed. Append `-- --browser-executable=/absolute/path/to/chromium` to use an existing browser.

`capture:examples` updates README screenshots and writes intermediate interaction captures under ignored `out/captures/`. `capture:modes` captures the continuous mode-change sequence and writes the state assertions to `public/textures/modes.json`. Recapture after `.ink` changes. The local host neither installs plugins nor sends to a real conversation.

## Edit

- `src/timeline.ts`: shared shot timings and relative sound-effect cues.
- `src/ConversationFilm.tsx`: illustrated shell, copy, real captured states, cursor paths and expansion.
- `src/Main.tsx`: scene tracks and optional music.
- `src/workbench.ts`: video-shotcraft workbench manifest, editable titles and music volume.
- `design.md`: brief, visual decisions, storyboard and reference adaptations.
- `styleframes.html`: static direction frames; serve this directory over HTTP.

With video-shotcraft installed, run `node /path/to/video-shotcraft/workbench/scripts/open.mjs /absolute/path/to/videos/showcase`. The self-contained Remotion project works without the skill.

## Sources

Actual UI screenshots come from this repository's compiled Ink examples. The card expansion is a custom flat match move informed by video-shotcraft's `shot-transitions`; it does not claim to reproduce its depth-world variant. [Video-shotcraft](https://vincentwei1021.github.io/video-shotcraft/).

Music: **Cat Walk — Arulo**, [Mixkit source](https://assets.mixkit.co/music/371/371.mp3), edited into 72 beats (33.233 seconds). Sound effects come from the skill's Mixkit library. [Source mapping](ASSETS.md). No voice, customer information or credentials are included. `analysis/music/music-edit.json` records the exact source intervals; `src/timeline.ts` retains the measured beat anchors, and `analysis/rendered/sync-report.json` records their exported-track alignment. Generated analysis traces and review stills are omitted.

[Final review](review.md)
