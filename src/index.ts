import { build } from 'esbuild';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { pageTools, type PageTool } from './runtime/page-tools.js';
export type { PageTool } from './runtime/page-tools.js';

/** Options for packaging an AIUI Agent as an MCP Apps plugin. */
export interface BuildPluginOptions {
  /** Agent source directory containing app.json and its pages. */
  source: string;
  /** Plugin identifier, starting with a lowercase letter. */
  name: string;
  /** Output directory. Defaults to dist/<name> in the working directory. */
  outputDir?: string;
  title?: string;
  description?: string;
  /** Fallback opener name when no page declares schema.data. Defaults to open_app. */
  tool?: string;
  /** Initial page path without its file extension. Defaults to app.json's first page. */
  page?: string;
  /** Plugin and MCP server version. Defaults to 0.1.0. */
  version?: string;
}

/** Paths and identity of the completed plugin build. */
export interface BuildPluginResult {
  name: string;
  title: string;
  version: string;
  tool: string;
  page: string;
  /** All registered tools, including their page routes and input schemas. */
  tools: PageTool[];
  outputDir: string;
  marketplaceName: string;
  files: {
    view: string;
    server: string;
    plugin: string;
    mcp: string;
    marketplace: string;
  };
}

/**
 * Build a self-contained MCP Apps plugin from an AIUI Agent source directory.
 * Resolves relative paths from the caller's working directory, validates input
 * before writing output, and returns the generated artifact paths. Errors reject
 * the promise; this function does not log, exit, or change the working directory.
 */
export async function buildPlugin(options: BuildPluginOptions): Promise<BuildPluginResult> {
  if (!options.source || !options.name) throw new Error('source and name are required.');
  if (!/^[a-z][a-z0-9-]*$/.test(options.name)) throw new Error('name must use lowercase letters, numbers, and hyphens, starting with a letter.');
  const tool = options.tool ?? 'open_app';
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(tool)) throw new Error('tool must contain 1–128 letters, numbers, underscores, or hyphens.');
  const source = resolve(options.source);
  const out = resolve(options.outputDir ?? join('dist', options.name));
  const nested = (parent: string, child: string) => {
    const path = relative(parent, child);
    return path === '' || (!path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && path !== '..' && !isAbsolute(path));
  };
  if (nested(source, out) || nested(out, source)) throw new Error('Agent source and output directories must not contain each other.');
  const manifest = JSON.parse(await readFile(join(source, 'app.json'), 'utf8'));
  const page = options.page ?? manifest.pages?.[0];
  if (typeof page !== 'string' || !page || page.split('/').some(part => part === '..' || part === '') || isAbsolute(page)) {
    throw new Error('Provide page or a valid first page in app.json. Use a relative path without the .ink extension.');
  }
  const files: Record<string, string> = {};
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const next = join(dir, entry.name);
      if (entry.isDirectory()) await walk(next);
      else if (entry.isFile()) files[relative(source, next).replaceAll('\\', '/')] = await readFile(next, 'utf8');
      else throw new Error(`Unsupported Agent source entry: ${next}`);
    }
  }
  await walk(source);
  if (!files[`${page}.ink`]) throw new Error(`Initial page not found: ${page}.ink`);
  const pages = manifest.pages;
  if (!Array.isArray(pages) || pages.some(item => typeof item !== 'string' || !item || isAbsolute(item) || item.includes('\\') || item.endsWith('.ink') || item.split('/').some(part => part === '..' || part === '.' || part === ''))) {
    throw new Error('app.json pages must list relative page paths without the .ink extension.');
  }
  const tools = pageTools(files, [...new Set([...pages, page])], options.name);
  const title = options.title ?? manifest.name ?? options.name;
  if (typeof title !== 'string' || !title) throw new Error('Agent title must be a nonempty string.');
  const description = options.description ?? `Open ${title}, an interactive AIUI Agent.`;
  const waitForToolInput = tools.length > 0;
  if (!tools.length) tools.push({ name: tool, title, description, page, inputSchema: { type: 'object', properties: {} }, resourceUri: `ui://${options.name}/app.html` });
  const config = { name: options.name, title, description, tool: tools[0].name, tools, page, waitForToolInput, version: options.version ?? '0.1.0' };
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
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#000}#shell{width:100%;height:220px}body[data-mode=fullscreen] #shell{height:100vh}canvas{display:block;width:100%;height:100%;outline:none}
</style></head><body data-page="${escapeHtml(page)}"><div id="shell"><canvas id="ink" tabindex="0" aria-label="${escapeHtml(title)}"></canvas></div><script type="module">${script}</script></body></html>`;
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
  return {
    name: config.name, title, version: config.version, tool: config.tool, tools, page, outputDir: out,
    marketplaceName: `${config.name}-local`,
    files: {
      view: join(out, 'view.html'),
      server: join(out, 'dist/server.mjs'),
      plugin: join(out, 'plugin.json'),
      mcp: join(out, 'mcp.json'),
      marketplace: join(out, '.agents/plugins/marketplace.json'),
    },
  };
}
