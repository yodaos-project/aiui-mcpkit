# Asset provenance

App textures come from this repository’s compiled examples, captured through the local MCP Apps AppBridge and published Ink/WASM runtime. `public/textures/modes.json` records the state-asserted inline → fullscreen → inline sequence in one View. The Codex shell is an approved illustration with a quiet **UI illustration** header label. It is not a native-client screenshot.

`npm run capture:examples` updates the README images and stores intermediate screenshots and their `layout.json` manifest in ignored `out/captures/`. `npm run capture:modes` updates the film’s `public/textures/` assets. Synthetic/curated data stays local; no real booking, payment or model response is represented.

| Local audio | Source |
| --- | --- |
| `cat-walk.wav` | Cat Walk, Arulo; https://assets.mixkit.co/music/371/371.mp3; 72-beat edit with exact source intervals in `analysis/music/music-edit.json` |
| `click.mp3` | Light switch tap; https://assets.mixkit.co/active_storage/sfx/2585/2585-preview.mp3 |
| `swoosh.wav` | Slow sweeping swoosh; https://assets.mixkit.co/active_storage/sfx/163/163-preview.mp3; excerpt 1.8–2.9s |
| `impact.wav` | Big cinematic impact; https://assets.mixkit.co/active_storage/sfx/788/788-preview.mp3; excerpt 2.05–3.15s |
| `riser.wav` | Original deterministic pink-noise swell, generated with FFmpeg (seed 73, high/low-pass filters, fade envelope, peak normalized to −6 dBFS) |
| `sparkle.mp3` | Magic sparkle touch; https://assets.mixkit.co/active_storage/sfx/3083/3083-preview.mp3 |

Source catalog: video-shotcraft `assets/audio/ATTRIBUTION.md`. [Music license](https://mixkit.co/license/#musicFree) · [Sound-effects license](https://mixkit.co/license/#sfxFree).

Motion references video-shotcraft library revision `bdd94be16d60fa8f`, `shot-transitions` / `mask-wipe`. The film uses an original flat match move, not PortalWipeV2’s depth-world implementation. Palette, copy and layouts are specific to MCPKit. The pointer is authored from two solid CSS polygons in composition-space coordinates; the underlying app content remains an actual canvas capture.

## Product image and client context

`public/brand/rokid-glasses.png` comes unchanged from the [official AIUI page](https://open.rokid.com/aiui/?lang=en-US): [original 1621×981 RGBA PNG](https://open.rokid.com/aiui/aiui-assets/landing/rokid-glasses.png). URL, acquisition date and SHA256 are in `public/brand/sources.json`. The image is presented on a light stage, with no UI composited into its lenses. It is not hardware footage or proof of cross-device state transfer.

The desktop shell is illustrated and contains the same captured app canvas. Claude Code is named as an [MCP tool client](https://code.claude.com/docs/en/mcp), not a verified inline UI host. [AIUI targets Rokid Glasses](https://github.com/yodaos-project/AIUI/blob/main/README.md) through its device workflow; the generated stdio server is not claimed to run unchanged on the glasses.
