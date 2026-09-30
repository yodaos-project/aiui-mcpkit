import { build } from 'esbuild';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join, relative } from 'node:path';

const root = new URL('../', import.meta.url);
const path = (part) => new URL(part, root);
const files = {};
async function walk(dir) {
  for (const entry of await readdir(path(dir), { withFileTypes: true })) {
    const next = join(dir, entry.name);
    if (entry.isDirectory()) await walk(next);
    else files[relative('ink', next).replaceAll('\\', '/')] = await readFile(path(next), 'utf8');
  }
}
await walk('ink');
const wasm = await readFile(path('node_modules/@yodaos-pkg/ink/pkg/ink_web_bg.wasm'));
const gzip = gzipSync(wasm, { level: 9 }).toString('base64');
const result = await build({
  entryPoints: [path('src/view.ts').pathname], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
  define: { __WASM_GZIP_BASE64__: JSON.stringify(gzip), __INK_FILES__: JSON.stringify(files) },
});
const script = result.outputFiles[0].text.replaceAll('</script', '<\\/script');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AIUI MCPKit</title><style>
*{box-sizing:border-box}body{margin:0;padding:12px;font:13px system-ui;color:#25304b;background:#fff}#shell{width:100%;height:220px;min-width:180px}body[data-mode=fullscreen] #shell{height:calc(100vh - 64px)}canvas{display:block;width:100%;height:100%;outline:none}#controls{display:flex;gap:8px;align-items:center;padding-top:8px}button{padding:5px 10px;border:1px solid #c8d0e0;border-radius:7px;background:white;color:#25304b;cursor:pointer}button[hidden]{display:none}#status{font-size:11px;color:#65718a}
</style></head><body><div id="shell"><canvas id="ink" tabindex="0" aria-label="Ink counter"></canvas></div><div id="controls"><button id="expand">Fullscreen</button><button id="collapse" hidden>Inline</button><span id="status">Connecting…</span></div><script type="module">${script}</script></body></html>`;
await writeFile(path('plugins/aiui-mcpkit/view.html'), html);
await mkdir(path('plugins/aiui-mcpkit/dist'), { recursive: true });
await build({ entryPoints: [path('src/server.ts').pathname], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: path('plugins/aiui-mcpkit/dist/server.mjs').pathname });
console.log(`Built view.html (${(Buffer.byteLength(html)/1024/1024).toFixed(1)} MiB) and dist/server.mjs`);
