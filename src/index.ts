import { build } from 'esbuild';
import { readFile, readdir, mkdir, writeFile, realpath, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { pageTools, type PageTool } from './runtime/page-tools.js';
import { resolveRequestPolicy, type RequestPolicy } from './runtime/lifecycle.js';
import { toolTypes } from './tool-types.js';
import { prepareProtocol, inspectProtocol, connectionConfig, type MetadataOptions, type ProtocolInspection } from './runtime/metadata.js';
import { packageAsset, validateAssetLimits, type AssetLimits, type AssetReport } from './assets.js';
import type { BundleEntry } from './runtime/bundle.js';
import { sha256, sourceSnapshot, type BuildManifest } from './diagnostics.js';
export { inspectBuild, diagnosePlugin } from './diagnostics.js';
export type { BuildIdentity, BuildManifest, BuildInspection, DiagnoseOptions } from './diagnostics.js';
import { resolveInspectorOptions, type InspectorOptions } from './runtime/inspector.js';
export type { AssetLimits, AssetInfo, AssetReport, BuildDiagnostic } from './assets.js';
import type { ClientCapabilities } from '@modelcontextprotocol/server';
export type { MetadataOptions, PublicMetadata, JsonValue, UiResource, ProtocolInspection } from './runtime/metadata.js';
export * from './runtime/business-tools.js';
export * from './runtime/lifecycle.js';
export * from './runtime/tool-bridge.js';
export { Inspector, redactDiagnostics, resolveInspectorOptions, type InspectorOptions, type InspectorEvent, type AgentInspectionMessage } from './runtime/inspector.js';
export type { PageTool } from './runtime/page-tools.js';
export * from './preview.js';

/** Options for packaging an AIUI Agent as an MCP Apps plugin. */
export interface BuildPluginOptions extends MetadataOptions {
  /** Optional host byte budgets; violations reject before writing artifacts. */
  assetLimits?: AssetLimits;
  /** Agent source directory containing app.json and its pages. */
  source: string;
  /** Plugin identifier, starting with a lowercase letter. */
  name: string;
  /** Output directory. Defaults to dist/<name> in the working directory. */
  outputDir?: string;
  /** Shared timeout policy for generated server and Agent tool bridge. */
  requestPolicy?: Partial<RequestPolicy>;
  /** Embed a local developer Inspector. Disabled by default; omit for production. */
  inspector?: boolean | InspectorOptions;
  /** Tool names explicitly safe to repeat after a request timeout. */
  retrySafeTools?: string[];
  /** Server-only handlers module. Defaults to <source>/mcp-server/handlers.ts for pages with schema.output. */
  handlers?: string;
  /** Execute schema.output tools in this manifest worker using an external ink-worker host. */
  worker?: { name: string };
  /** Shared UI registrations. Calls delivered to an existing View preserve its App. New Views remain independent. */
  applications?: Record<string, { page: string }>;
  /** Generated handler/input/output declarations. Defaults to <outputDir>/tools.d.ts. */
  typesFile?: string;
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
  /** Content-derived identity; independent of output directory and build time. */
  build: BuildManifest['build'];
  /** Public asset sizes, encodings, final HTML size, and advisory host diagnostics. */
  assets: AssetReport;
  name: string;
  title: string;
  version: string;
  tool: string;
  page: string;
  /** All registered tools, including their page routes and input schemas. */
  tools: PageTool[];
  outputDir: string;
  marketplaceName: string;
  requestPolicy: RequestPolicy;
  /** Final tools/list, resources/list and connection configuration for these client capabilities. Defaults to no Apps support. */
  inspectProtocol(clientCapabilities?: ClientCapabilities): ProtocolInspection;
  files: {
    build: string;
    view: string;
    server: string;
    plugin: string;
    mcp: string;
    marketplace: string;
    types: string;
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
  const requestPolicy = resolveRequestPolicy(options.requestPolicy);
  const inspector = resolveInspectorOptions(options.inspector);
  const assetLimits = validateAssetLimits(options.assetLimits);
  const assets: AssetReport = { files: [], totalBytes: 0, viewBytes: 0, diagnostics: [] };
  const retrySafeTools = options.retrySafeTools ?? [];
  if (!Array.isArray(retrySafeTools) || retrySafeTools.some(name => typeof name !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(name))) throw new Error('retrySafeTools must contain valid tool names.');
  const tool = options.tool ?? 'open_app';
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(tool)) throw new Error('tool must contain 1–128 letters, numbers, underscores, or hyphens.');
  const source = resolve(options.source);
  const out = resolve(options.outputDir ?? join('dist', options.name));
  const nested = (parent: string, child: string) => {
    const path = relative(parent, child);
    return path === '' || (!path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && path !== '..' && !isAbsolute(path));
  };
  if (nested(out, source)) throw new Error('Output directory must not contain the Agent source directory.');
  if ('businessTools' in options) throw new Error('Declare business tools in .ink script def schema.data/schema.output and use handlers instead of businessTools.');
  const manifest = JSON.parse(await readFile(join(source, 'app.json'), 'utf8'));
  const page = options.page ?? manifest.pages?.[0];
  if (typeof page !== 'string' || !page || page.split('/').some(part => part === '..' || part === '') || isAbsolute(page)) {
    throw new Error('Provide page or a valid first page in app.json. Use a relative path without the .ink extension.');
  }
  const files: Record<string, string> = {};
  // Tool discovery reads registered pages only; private server files are not UI assets.
  if (!Array.isArray(manifest.pages)) throw new Error('app.json pages must be an array.');
  for (const route of new Set([...manifest.pages, page])) {
    if (typeof route !== 'string' || !route || isAbsolute(route) || route.includes('\\') || route.endsWith('.ink') || route.split('/').some(part => part === '..' || part === '.' || !part)) throw new Error('app.json pages must list relative page paths without the .ink extension.');
    try { files[`${route}.ink`] = await readFile(join(source, `${route}.ink`), 'utf8'); }
    catch { throw new Error(`${route === page ? 'Initial page' : 'Page'} not found: ${route}.ink`); }
  }
  const pages = manifest.pages;
  if (!Array.isArray(pages) || pages.some(item => typeof item !== 'string' || !item || isAbsolute(item) || item.includes('\\') || item.endsWith('.ink') || item.split('/').some(part => part === '..' || part === '.' || part === ''))) {
    throw new Error('app.json pages must list relative page paths without the .ink extension.');
  }
  let tools = pageTools(files, [...new Set([...pages, page])], options.name);
  const applications = options.applications ?? {};
  if (!applications || typeof applications !== 'object' || Array.isArray(applications)) throw new Error('applications must be a registry.');
  for (const [id, application] of Object.entries(applications)) {
    if (!/^[a-z][a-z0-9-]*$/.test(id) || !application || !pages.includes(application.page)) throw new Error('applications must reference registered pages with lowercase identifiers.');
  }
  tools = tools.map(tool => {
    if (tool.application === undefined) return tool;
    if (!Object.hasOwn(applications, tool.application)) throw new Error(`Unknown application: ${tool.application}`);
    return { ...tool, page: applications[tool.application].page, resourceUri: `ui://${options.name}/applications/${tool.application}.html` };
  });
  const title = options.title ?? manifest.name ?? options.name;
  if (typeof title !== 'string' || !title) throw new Error('Agent title must be a nonempty string.');
  const description = options.description ?? `Open ${title}, an interactive AIUI Agent.`;
  let waitForToolInput = tools.length > 0;
  if (!tools.length) tools.push({ name: tool, title, description, page, inputSchema: { type: 'object', properties: {} }, resourceUri: `ui://${options.name}/app.html` });
  const protocol = prepareProtocol(options.name, tools, requestPolicy, options);
  // Ink registers bundled fonts using object URLs. Custom HTML keeps its own CSP.
  if (Array.isArray(manifest.fonts) && manifest.fonts.length) {
    for (const resource of protocol.resources.filter(resource => resource.page !== undefined)) {
      const ui = resource._meta!.ui as import('./runtime/metadata.js').PublicMetadata;
      const csp = ui.csp as import('./runtime/metadata.js').PublicMetadata;
      csp.resourceDomains = [...new Set([...(csp.resourceDomains as string[]), 'blob:'])];
    }
    assets.diagnostics.push({ code: 'HOST_REQUIREMENT', message: 'Bundled app.json fonts require host font-src blob: support. Generated UI CSP includes resourceDomains: blob:; font formats still depend on the browser.' });
  }
  tools = protocol.tools;
  const hasBusinessTools = tools.some(tool => tool.outputSchema !== undefined);
  if (options.worker && options.handlers) throw new Error('worker and handlers are mutually exclusive.');
  if (options.worker && (!options.worker.name || !Array.isArray(manifest.agentWorkers) || !manifest.agentWorkers.some((value: { name?: string }) => value.name === options.worker!.name))) throw new Error('worker.name must select an app.json.agentWorkers entry.');
  const handlersPath = hasBusinessTools && !options.worker ? resolve(options.handlers ?? join(source, 'mcp-server/handlers.ts')) : undefined;
  if (handlersPath && nested(out, handlersPath)) throw new Error('Business handlers must be outside the output directory.');
  const typesFile = resolve(options.typesFile ?? join(out, 'tools.d.ts'));
  if (!typesFile.endsWith('.d.ts')) throw new Error('typesFile must end with .d.ts.');
  const config = { requestPolicy, retrySafeTools, name: options.name, title, description, tool: tools[0].name, tools, protocol, page, waitForToolInput, version: options.version ?? '0.1.0' };
  const runtime = new URL('./runtime/', import.meta.url);
  const require = createRequire(import.meta.url);
  const server = await build({
    entryPoints: [fileURLToPath(new URL('server.ts', runtime))],
    bundle: true, write: false, metafile: true, platform: 'node', format: 'esm', target: 'node22',
    banner: { js: `import { createRequire as __mcpkitCreateRequire } from 'node:module'; const require = __mcpkitCreateRequire(import.meta.url);` },
    plugins: [{ name: 'business-handlers', setup(plugin) {
      plugin.onResolve({ filter: /^@yodaos-pkg\/aiui-mcpkit$/ }, () => ({ path: fileURLToPath(new URL('server-api.ts', runtime)) }));
      plugin.onResolve({ filter: /^@yodaos-pkg\/aiui-mcpkit\/tools$/ }, () => ({ path: fileURLToPath(new URL('business-tools.ts', runtime)) }));
      plugin.onResolve({ filter: /^mcpkit:business-handlers$/ }, () => options.worker ? { path: 'worker-handlers', namespace: 'mcpkit' } : handlersPath
        ? { path: handlersPath } : { path: 'empty-handlers', namespace: 'mcpkit' });
      plugin.onLoad({ filter: /^worker-handlers$/, namespace: 'mcpkit' }, () => ({ contents: `import { createWorkerHandlers } from ${JSON.stringify(fileURLToPath(new URL('worker-tools.ts', runtime)))}; export const handlers = createWorkerHandlers(${JSON.stringify(options.worker!.name)}, ${JSON.stringify(tools.filter(tool => tool.outputSchema).map(tool => tool.name))});`, loader: 'ts', resolveDir: fileURLToPath(runtime) }));
      plugin.onLoad({ filter: /^empty-handlers$/, namespace: 'mcpkit' }, () => ({ contents: 'export const handlers = {};', loader: 'js' }));
    } }],
    define: { __APP_CONFIG__: JSON.stringify(config), __BUILD_INFO__: '__mcpkitBuildInfo' },
  });
  const serverFiles = new Set<string>();
  for (const input of Object.keys(server.metafile!.inputs)) {
    if (input.startsWith('<define:') || input.startsWith('mcpkit:')) continue;
    serverFiles.add(await realpath(resolve(input)));
  }
  const packagedFiles: Record<string, BundleEntry> = Object.create(null);
  async function walk(dir: string) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const next = join(dir, entry.name);
      const path = relative(source, next).replaceAll('\\', '/');
      if (nested(out, next) || next === typesFile || path === 'mcp-server' || path === 'dist' || path === '.mcpkit' || path === '.git' || path === 'node_modules' || entry.name === '.env' || entry.name.startsWith('.env.')) continue;
      if (entry.isDirectory()) await walk(next);
      else if (entry.isFile()) {
        if (path !== 'app.json' && serverFiles.has(await realpath(next))) {
          if (files[path] !== undefined) throw new Error(`Server code cannot import a registered UI page: ${path}`);
          continue;
        }
        packagedFiles[path] = packageAsset(path, await readFile(next), assetLimits, assets);
      } else throw new Error(`Unsupported Agent source entry: ${next}`);
    }
  }
  await walk(source);
  const wasm = await readFile(join(dirname(require.resolve('@yodaos-pkg/ink/package.json')), 'pkg/ink_web_bg.wasm'));
  const view = await build({
    entryPoints: [fileURLToPath(new URL('view.ts', runtime))],
    bundle: true, write: false, metafile: true, minify: true, format: 'esm', platform: 'browser', target: 'es2022',
    define: {
      __BUILD_INFO__: '__mcpkitBuildInfo',
      __WASM_GZIP_BASE64__: JSON.stringify(gzipSync(wasm, { level: 9 }).toString('base64')),
      __INK_FILES__: JSON.stringify(packagedFiles), __APP_CONFIG__: JSON.stringify({ name: config.name, title: config.title, version: config.version, page, waitForToolInput, requestPolicy, retrySafeTools, sharedPages: Object.values(applications).map(app => app.page), inspector, tools: inspector ? tools.map(({ name, inputSchema }) => ({ name, inputSchema, target: 'server' })) : undefined }),
    },
  });
  const excluded = [out, typesFile];
  const sourceFiles = await sourceSnapshot(source, excluded);
  const inputs: Record<string, string> = {};
  const inputPaths = [fileURLToPath(import.meta.url), join(dirname(require.resolve('@yodaos-pkg/ink/package.json')), 'pkg/ink_web_bg.wasm'),
    ...Object.keys(server.metafile!.inputs), ...Object.keys(view.metafile!.inputs)];
  for (const input of [...new Set(inputPaths)].sort()) {
    if (input.startsWith('<define:') || input.startsWith('mcpkit:')) continue;
    const path = await realpath(resolve(input));
    inputs[path] = sha256(await readFile(path));
  }
  const identity = { schemaVersion: 1 as const, name: config.name, version: config.version,
    id: sha256(JSON.stringify([config, Object.entries(sourceFiles).sort(), Object.values(inputs).sort(), server.outputFiles[0].text, view.outputFiles[0].text])) };
  const buildDeclaration = `const __mcpkitBuildInfo = ${JSON.stringify(identity)};\n`;
  const buildMarker = `<meta name="mcpkit-build-id" content="${identity.id}">`;
  const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const script = (buildDeclaration + view.outputFiles[0].text).replace(/<\/script/gi, '<\\/script');
  const html = `<!doctype html><html><head><meta charset="utf-8">${buildMarker}<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#000}#shell{width:100%;height:220px}body[data-mode=fullscreen] #shell{height:100vh}canvas{display:block;width:100%;height:100%;outline:none}
</style></head><body data-page="${escapeHtml(page)}"><div id="shell"><canvas id="ink" tabindex="0" aria-label="${escapeHtml(title)}"></canvas></div><script type="module">${script}</script></body></html>`;
  assets.viewBytes = Buffer.byteLength(html);
  if (assetLimits.maxViewBytes !== undefined && assets.viewBytes > assetLimits.maxViewBytes) {
    throw new Error(`View HTML: ${assets.viewBytes} bytes exceeds maxViewBytes (${assetLimits.maxViewBytes}).`);
  }
  assets.diagnostics.push({ code: 'HOST_REQUIREMENT', message: `View HTML is ${assets.viewBytes} bytes. The host must support this resource size, inline scripts/styles, WASM compilation and data: images (SVG). CSP declarations do not override host restrictions or CORS.` });
  await mkdir(join(out, 'dist'), { recursive: true });
  await writeFile(join(out, 'view.html'), html);
  await writeFile(join(out, 'dist/server.mjs'), buildDeclaration + server.outputFiles[0].text);
  if (options.worker) {
    await rm(join(out, 'worker-app'), { recursive: true, force: true });
    for (const [path, entry] of Object.entries(packagedFiles)) {
      const destination = join(out, 'worker-app', path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, entry.encoding === 'base64' ? Buffer.from(entry.data, 'base64') : entry.data);
    }
  }
  await mkdir(dirname(typesFile), { recursive: true });
  await writeFile(typesFile, toolTypes(tools));
  const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
  await writeFile(join(out, 'plugin.json'), json({
    $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
    name: config.name, version: config.version, description,
    extensions: { 'com.openai': { interface: {
      displayName: title, shortDescription: description, longDescription: description,
      category: 'Developer Tools', capabilities: ['Interactive'], defaultPrompt: `Open ${title}.`,
    } } },
  }));
  await writeFile(join(out, 'mcp.json'), json(connectionConfig(config.name)));
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
  const artifacts: Record<string, string> = {};
  for (const path of ['view.html', 'dist/server.mjs', 'plugin.json', 'mcp.json',
    ...(options.worker ? Object.keys(packagedFiles).map(path => `worker-app/${path}`) : [])]) {
    artifacts[path] = sha256(await readFile(join(out, path)));
  }
  const buildManifest: BuildManifest = { schemaVersion: 1, build: identity,
    source: { directory: source, excluded, files: sourceFiles }, inputs, artifacts,
    resources: protocol.resources.map(resource => resource.uri) };
  await writeFile(join(out, 'build.json'), json(buildManifest));
  return {
    build: structuredClone(identity),
    assets, name: config.name, title, version: config.version, tool: config.tool, tools: structuredClone(tools), page, outputDir: out,
    marketplaceName: `${config.name}-local`, requestPolicy,
    inspectProtocol: capabilities => inspectProtocol(protocol, capabilities, identity),
    files: {
      build: join(out, 'build.json'),
      view: join(out, 'view.html'),
      server: join(out, 'dist/server.mjs'),
      plugin: join(out, 'plugin.json'),
      mcp: join(out, 'mcp.json'),
      marketplace: join(out, '.agents/plugins/marketplace.json'), types: typesFile,
    },
  };
}
