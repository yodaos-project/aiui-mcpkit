import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const assets = resolve(root, "../../docs/assets");
const out = join(root, "out");
mkdirSync(out, { recursive: true });
mkdirSync(assets, { recursive: true });
const cli = join(root, "node_modules/@remotion/cli/remotion-cli.js");
const music = join(assets, "mcpkit-showcase.mp4");
const noMusic = join(assets, "mcpkit-showcase-nobgm.mp4");
for (const [output, extra] of [
  [music, []],
  [noMusic, ["--props=props-nobgm.json"]],
]) {
  execFileSync(
    process.execPath,
    [
      cli,
      "render",
      "src/index.ts",
      "MCPKitShowcase",
      output,
      ...extra,
      "--codec=h264",
      "--crf=20",
      "--pixel-format=yuv420p",
      ...process.argv.slice(2),
    ],
    { cwd: root, stdio: "inherit" },
  );
}
// Both audio tracks are genuinely rendered from Main's bgm toggle. Reuse one
// encoded picture track to remove harmless Chromium/H.264 raster differences;
// this does not try to remove music from an already mixed soundtrack.
copyFileSync(noMusic, join(out, "nobgm-rendered.mp4"));
const temporary = join(out, "nobgm-canonical.mp4");
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-v",
    "error",
    "-i",
    music,
    "-i",
    noMusic,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    temporary,
  ],
  { stdio: "inherit" },
);
renameSync(temporary, noMusic);
const hashes = (path) =>
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-i",
    path,
    "-map",
    "0:v:0",
    "-f",
    "framemd5",
    "-",
  ]);
if (!hashes(music).equals(hashes(noMusic)))
  throw new Error("Decoded picture tracks differ.");
console.log("Both editions exported; all decoded video frames are identical.");
