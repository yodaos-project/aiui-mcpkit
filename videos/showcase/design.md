# MCPKit showcase design

A 33-second English product film: **An idea. Now in view.** Show an idea become an interactive app inside a conversation, expand into its own view, and return with the user’s choices intact. Introduce four distinct examples and desktop/glasses contexts.

## Visual direction

Use #101010 / #f4f4ef / #245dd8, sentence-case benefit copy, large type and front-facing interaction. Keep thin light borders, white toolbars and soft shadows. No lower-third source banners, technical labels, oversized background words or duplicate product headings. The existing Codex header retains one quiet “UI illustration” label. Sources and host limitations belong in ASSETS.md and the reproduction README.

Four real examples form a nonoverlapping, unrotated 2×2 grid in blue, coral, violet and ceramic palettes. Card labels use 46px type in a 52px bar. The official Rokid Glasses image remains unchanged. Static direction frames are in `styleframes.html`; the composition is authoritative.

## Story and rhythm

| Beats / frames | Scene | Copy and action |
| --- | --- | --- |
| 0–8 / 0–110 | Opening | An idea. Now in view. / Put it to work. |
| 8–20 / 111–276 | Conversation | Right in your chat. / Select day two, save bamboo. |
| 20–32 / 277–442 | Independent view | More room. / Expand, choose the garden. |
| 32–40 / 443–553 | Return | Just as you left it. / Keep the garden selection. |
| 40–48 / 554–664 | Examples | Small apps. Big possibilities. / Four staggered cards. |
| 48–60 / 665–830 | Client/device contexts | From your desk. To your day. / Codex, Claude Code, AIUI on Rokid Glasses. |
| 60–72 / 831–996 | Brand | Your ideas. A wider world. / Project URL. |

The measured 130 BPM edit drives text landings, clicks, expansion/return, card arrivals and product-image arrival. `src/timeline.ts` contains shared frame timings and audio anchors; `analysis/music/music-edit.json` records the source edit, and `analysis/rendered/sync-report.json` records exported-track alignment. Motion uses nonlinear entrances, clear reading holds, a flat match move and a resource-free pointer.

## Evidence and delivery

`public/textures/modes.json` records one AppBridge and one View through both display-mode changes, with state assertions. The approved illustrated shell contains actual app captures. Local capture evidence is distinct from native-client/device verification; the glasses chapter does not assert live device-state transfer.

Deliver a 1920×1080 / 30fps / 997-frame H.264 film and a matching edition with sound effects but no music. Check full decoding, picture identity, text layout, source assets and audio timing. A clean-context independent reviewer completed final export review; `review.md` retains its conclusions and verification limits. Superseded sources, scratch frames and render backups are removed from the maintained project.
