# Final film review

2026-10-29. Summary of the independent review completed on the final exports before delivery. No unresolved must-fix items were found in the checks performed. Historical iterations and generated review stills were removed during repository cleanup; the final MP4s are unchanged.

## Checks completed

- Both editions fully decode: 997 H.264 frames, 1920×1080, 30fps, 33.233333s picture, stereo 48kHz AAC. All 997 decoded picture frames match between editions.
- The reviewer inspected 63 final encoded frames in contact sheets and eight at full resolution, including chapter boundaries, expansion/return, final grid and product-image transition. No settled clipping or unintended mask seam was found.
- The conversation → independent view → return story retains the selected garden. Four examples are unrotated and nonoverlapping. No removed technical label or lower-left banner remains; the chat keeps a quiet “UI illustration” header label.
- Effective final text heights meet the recorded floors: main copy ≥56px; illustration label 32px; grid labels 43/35/43/43px; platform names 37/36px; project URL 34px.
- The official glasses image matches its recorded source SHA256 and remains completely in frame without UI painted into the lenses.
- The checked audio tracks were retained without re-encoding: AAC elementary-stream bytes, all 1560 packet timings/skip metadata and beat/SFX timing were unchanged during the final visual revision.
- Retained timing measurements in `analysis/rendered/sync-report.json`: 34 anchors, maximum 0.48163-frame and mean 0.24126-frame visual error. Earlier retained-track measurements found no clipping, SFX placement error below one frame and digital silence in the no-music gaps. These algorithms were not rerun for the final visual revision.
- The producer’s nine-frame workbench parity check reported zero differing pixels; the independent reviewer did not repeat it.

## Export fingerprints

| Edition | Final MP4 SHA256 |
| --- | --- |
| Music | `c6114240d7e61457aae9cfd34f3e4edf15bde8c431967d0cdf2f630e2a286ca6` |
| No music | `e3adbe18b4af56b1a625390289ebff09ea7a41df4e083e2cb0e999d0f7410927` |

AAC ADTS SHA256: music `11e71ef384d2443667e1a10eb2e822b3164602fe1956d48ec7ab5cfdd5a93de7`; no music `57e15cb45c9dbe6d3a555408e5545a84c36c3bb1ae1adb2acd7319d62d3010d8`.

The render helper checks decoded-picture identity when exporting both editions. FFmpeg can check each complete export with `ffmpeg -v error -i <file> -f null -` and produce comparison hashes with `ffmpeg -v error -i <file> -map 0:v:0 -f framemd5 -`. The stored fingerprints apply to the delivered files, not future re-renders.

## Verification limits

Full-speed subjective viewing/listening and perceived groove were not independently verified. Native Codex/Claude Code rendering, physical Rokid Glasses behavior and cross-device synchronization were not tested. App interactions were verified in the local MCP Apps browser harness. The source and host distinctions are documented in [ASSETS.md](ASSETS.md).
