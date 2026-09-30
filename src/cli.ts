import { build } from 'esbuild';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';

async function main() {
  const { values } = parseArgs({ options: {
    ink: { type: 'string' }, out: { type: 'string' }, name: { type: 'string' },
    title: { type: 'string' }, description: { type: 'string' },
    tool: { type: 'string' }, page: { type: 'string' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log(`Usage: aiui-mcpkit --ink <directory> --name <plugin-name> [options]

  --out <directory>       Plugin output (default: dist/<plugin-name>)
  --title <text>          Display name (default: app.json name or plugin name)
  --description <text>    Plugin and MCP tool description
  --tool <name>           Opener tool (default: open_app)
  --page <path>           Initial page (default: first app.json pages entry)`);
    return;
  }
  if (!values.ink || !values.name) throw new Error('--ink and --name are required; use --help for usage.');
  if (!/^[a-z][a-z0-9-]*$/.test(values.name)) throw new Error('--name must use lowercase letters, numbers, and hyphens, starting with a letter.');
  const tool = values.tool ?? 'open_app';
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(tool)) throw new Error('--tool must contain 1–128 letters, numbers, underscores, or hyphens.');
  const ink = resolve(values.ink);
  const out = resolve(values.out ?? join('dist', values.name));
  const nested = (parent: string, child: string) => {
    const path = relative(parent, child);
    return path === '' || (!path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && path !== '..' && !isAbsolute(path));
  };
  if (nested(ink, out) || nested(out, ink)) throw new Error('Ink source and output directories must not contain each other.');
  const manifest = JSON.parse(await readFile(join(ink, 'app.json'), 'utf8'));
  const page = values.page ?? manifest.pages?.[0];
  if (typeof page !== 'string' || !page || page.split('/').some(part => part === '..' || part === '') || isAbsolute(page)) {
    throw new Error('Provide --page or a valid first page in app.json. Use a relative path without the .ink extension.');
  }
  const files: Record<string, string> = {};
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const next = join(dir, entry.name);
      if (entry.isDirectory()) await walk(next);
      else if (entry.isFile()) files[relative(ink, next).replaceAll('\\', '/')] = await readFile(next, 'utf8');
      else throw new Error(`Unsupported Ink source entry: ${next}`);
    }
  }
  await walk(ink);
  if (!files[`${page}.ink`]) throw new Error(`Initial page not found: ${page}.ink`);
  const title = values.title ?? manifest.name ?? values.name;
  if (typeof title !== 'string' || !title) throw new Error('App title must be a nonempty string.');
  const description = values.description ?? `Open ${title}, an interactive Ink app.`;
  const config = { name: values.name, title, description, tool, page, version: '0.1.0' };
  const runtime = new URL('./runtime/', import.meta.url);
  const require = createRequire(import.meta.url);
  const wasm = await readFile(join(dirname(require.resolve('@yodaos-pkg/ink/package.json')), 'pkg/ink_web_bg.wasm'));
  const view = await build({
    entryPoints: [fileURLToPath(new URL('view.ts', runtime))],
    bundle: true, write: false, minify: true, format: 'esm', platform: 'browser', target: 'es2022',
    define: {
      __WASM_GZIP_BASE64__: JSON.stringify(gzipSync(wasm, { level: 9 }).toString('base64')),
      __INK_FILES__: JSON.stringify(files), __APP_CONFIG__: JSON.stringify(config),
    },
  });
  const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const script = view.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
*{box-sizing:border-box}body{margin:0;padding:12px;font:13px system-ui;color:#25304b;background:#fff}#shell{width:100%;height:220px;min-width:180px}body[data-mode=fullscreen] #shell{height:calc(100vh - 64px)}canvas{display:block;width:100%;height:100%;outline:none}#controls{display:flex;gap:8px;align-items:center;padding-top:8px}button{padding:5px 10px;border:1px solid #c8d0e0;border-radius:7px;background:white;color:#25304b;cursor:pointer}button[hidden]{display:none}#status{font-size:11px;color:#65718a}
</style></head><body><div id="shell"><canvas id="ink" tabindex="0" aria-label="${escapeHtml(title)}"></canvas></div><div id="controls"><button id="expand">Fullscreen</button><button id="collapse" hidden>Inline</button><span id="status">Connecting…</span></div><script type="module">${script}</script></body></html>`;
  const server = await build({
    entryPoints: [fileURLToPath(new URL('server.ts', runtime))],
    bundle: true, write: false, platform: 'node', format: 'esm', target: 'node22',
    define: { __APP_CONFIG__: JSON.stringify(config) },
  });
  await mkdir(join(out, 'dist'), { recursive: true });
  await writeFile(join(out, 'view.html'), html);
  await writeFile(join(out, 'dist/server.mjs'), server.outputFiles[0].contents);
  const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
  await writeFile(join(out, 'plugin.json'), json({
    $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
    name: config.name, version: config.version, description,
    extensions: { 'com.openai': { interface: {
      displayName: title, shortDescription: description, longDescription: description,
      category: 'Developer Tools', capabilities: ['Interactive'], defaultPrompt: `Open ${title}.`,
    } } },
  }));
  await writeFile(join(out, 'mcp.json'), json({
    $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
    mcpServers: { [config.name]: { type: 'stdio', command: 'node', args: ['${PLUGIN_ROOT}/dist/server.mjs'], cwd: '${PLUGIN_ROOT}' } },
  }));
  await mkdir(join(out, '.agents/plugins'), { recursive: true });
  await writeFile(join(out, '.agents/plugins/marketplace.json'), json({
    name: `${config.name}-local`,
    interface: { displayName: `${title} (local)` },
    plugins: [{
      name: config.name,
      source: { source: 'local', path: './' },
      policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
      category: 'Developer Tools',
    }],
  }));
  console.log(`Built plugin ${config.name} in ${out}`);
  console.log(`Local install: codex plugin marketplace add ${JSON.stringify(out)}`);
  console.log(`Then: codex plugin add ${config.name}@${config.name}-local`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
