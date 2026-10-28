import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPluginToDirectory, type BuildPluginOptions, type BuildPluginResult } from './build.js';
import { sha256, sourceSnapshot, type BuildIdentity, type BuildManifest } from './diagnostics.js';
import type { JsonValue } from './runtime/metadata.js';

export type WatchChangeKind = 'view' | 'server' | 'manifest';
export interface WatchChange { path: string; kind: WatchChangeKind }
export interface WatchDiagnostic { message: string; path?: string; line?: number; column?: number }
export interface WatchState {
  phase: 'building' | 'ready' | 'failed' | 'superseded' | 'closed';
  /** Monotonic attempt number, including failed and superseded attempts. */
  sequence: number;
  /** Last successfully published content-derived build identity. */
  build?: BuildIdentity;
  changes: WatchChange[];
  action: 'reload-view' | 'restart-server' | 'refresh-manifest' | 'none';
  statePolicy: 'reset';
  recovered: boolean;
  diagnostics: WatchDiagnostic[];
  hostSteps: string[];
}
export interface WatchPluginOptions extends BuildPluginOptions {
  /** Content polling handles additions, deletions and editor atomic saves. Default 200ms. */
  pollInterval?: number;
  /** Quiet period before building. Default 100ms. */
  debounce?: number;
  /** Extra files/directories, including external dependencies needed before a first successful build. */
  watchPaths?: string[];
  /** Loopback-only browser preview. Defaults to an ephemeral port; false disables it. */
  preview?: false | { port?: number; input?: Record<string, JsonValue>; displayMode?: 'inline' | 'fullscreen' };
  /** Receives isolated snapshots. Listener exceptions do not stop the watcher. */
  onEvent?: (state: WatchState) => void;
}
export interface PluginWatcher {
  readonly previewUrl?: string;
  readonly state: WatchState;
  /** Queue a complete rebuild and wait until all queued edits have settled. */
  rebuild(): Promise<void>;
  /** Stop polling/preview and wait for any in-flight build to be discarded. */
  close(): Promise<void>;
}

const inside = (parent: string, path: string) => {
  const name = relative(parent, path);
  return name === '' || (!isAbsolute(name) && name !== '..' && !name.startsWith('..' + sep));
};
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';
async function canonical(path: string): Promise<string> {
  try { return await realpath(path); }
  catch (error) {
    if (!missing(error)) throw error;
    return join(await canonical(dirname(path)), relative(dirname(path), path));
  }
}

/** Complete, serialized builds; staged failures/stale results never replace published artifacts. */
export async function watchPlugin(options: WatchPluginOptions): Promise<PluginWatcher> {
  const source = await canonical(resolve(options.source));
  const output = await canonical(resolve(options.outputDir ?? join('dist', options.name)));
  const types = await canonical(resolve(options.typesFile ?? join(output, 'tools.d.ts')));
  const pollInterval = options.pollInterval ?? 200;
  const debounce = options.debounce ?? 100;
  if (!inside(output, types)) throw new Error('watchPlugin typesFile must be inside outputDir so artifacts can be published together.');
  if (inside(output, source)) throw new Error('Output directory must not contain the Agent source directory.');
  if (!Number.isSafeInteger(pollInterval) || pollInterval < 20 || pollInterval > 2_147_483_647) throw new Error('pollInterval must be a 32-bit integer of at least 20ms.');
  if (!Number.isSafeInteger(debounce) || debounce < 0 || debounce > 2_147_483_647) throw new Error('debounce must be a nonnegative 32-bit integer.');
  const preview = options.preview === false ? false : options.preview ?? {};
  if (preview && (preview.port !== undefined && (!Number.isInteger(preview.port) || preview.port < 0 || preview.port > 65535))) throw new Error('preview.port must be an integer from 0 to 65535.');
  if (preview && preview.displayMode !== undefined && !['inline', 'fullscreen'].includes(preview.displayMode)) throw new Error('preview.displayMode must be inline or fullscreen.');
  if (preview && preview.input !== undefined && (!preview.input || typeof preview.input !== 'object' || Array.isArray(preview.input))) throw new Error('preview.input must be a JSON object.');
  // Watch publication owns the whole output directory, including stale Worker files.
  try {
    if ((await readdir(output)).length) {
      const plugin = JSON.parse(await readFile(join(output, 'plugin.json'), 'utf8'));
      if (plugin.name !== options.name) throw new Error('Watch output belongs to another plugin.');
    }
  } catch (error) {
    if (!missing(error) || (await stat(output).catch(() => undefined))) throw new Error(`watchPlugin requires an empty outputDir or an existing ${options.name} plugin: ${output}`, { cause: error });
  }
  const excluded = [output, types];
  const dependencies = new Set(await Promise.all([...(options.watchPaths ?? []).map(path => resolve(path)),
    ...(options.handlers ? [resolve(options.handlers)] : []), ...(options.restoration ? [resolve(options.restoration.adapter)] : [])].map(canonical)));
  const serverInputs = new Set<string>();
  const listeners = options.onEvent;
  let state: WatchState = { phase: 'building', sequence: 0, changes: [], action: 'none', statePolicy: 'reset', recovered: false, diagnostics: [], hostSteps: [] };
  let stopped = false, revision = 0, publishedRevision = -1, changedAt = 0;
  let failed = false;
  let observed: Record<string, string> = {};
  let published: Record<string, string> = {};
  let lastResult: BuildPluginResult | undefined;
  let html: string | undefined;
  let running: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let server: ReturnType<typeof createServer> | undefined;
  let previewUrl: string | undefined;
  const emit = (next: WatchState) => {
    state = next;
    try { listeners?.(structuredClone(state)); } catch { /* Observers cannot interrupt publication. */ }
  };
  const classify = (path: string): WatchChangeKind => path === join(source, 'app.json') ? 'manifest'
    : inside(join(source, 'mcp-server'), path) || serverInputs.has(path)
      // Workers can import shared modules or use a custom manifest script path.
      // Treat their possible JS/JSON dependencies conservatively as server code.
      || (options.worker && inside(source, path) && path !== join(source, 'app.js')
        && (inside(join(source, 'workers'), path) || /\.(?:[cm]?js|json)$/i.test(path))) ? 'server' : 'view';
  async function snapshot() {
    const files: Record<string, string> = {};
    // A missing source remains watchable so creating it recovers the session.
    try { for (const [path, hash] of Object.entries(await sourceSnapshot(source, excluded))) files[join(source, path)] = hash; }
    catch (error) { if (!missing(error)) throw error; }
    for (const path of dependencies) {
      if (inside(source, path) || inside(output, path)) continue;
      try {
        if ((await stat(path)).isDirectory()) {
          for (const [name, hash] of Object.entries(await sourceSnapshot(path, excluded))) files[join(path, name)] = hash;
        } else files[path] = sha256(await readFile(path));
      } catch (error) { if (!missing(error)) throw error; files[path] = 'missing'; }
    }
    return files;
  }
  const changed = (a: Record<string, string>, b: Record<string, string>) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(path => a[path] !== b[path]).sort();
  async function scan() {
    const next = await snapshot();
    if (changed(observed, next).length) { revision++; changedAt = Date.now(); observed = next; }
    return next;
  }
  const diagnostics = (error: unknown): WatchDiagnostic[] => {
    const errors = (error as { errors?: { text: string; location?: { file: string; line: number; column: number } }[] }).errors;
    if (errors?.length) return errors.map(item => ({ message: item.text, ...(item.location ? { path: resolve(item.location.file), line: item.location.line, column: item.location.column + 1 } : {}) }));
    const message = error instanceof Error ? error.message : String(error);
    const location = error as { path?: string; line?: number; column?: number };
    const page = /^(.+\.ink):/.exec(message)?.[1];
    return [{ message, ...(location.path ? { path: location.path, line: location.line, column: location.column } : page ? { path: join(source, page) } : {}) }];
  };
  async function drain() {
    while (!stopped && publishedRevision !== revision) {
      const attempt = revision;
      const before = observed;
      const changes = changed(published, before).map(path => ({ path, kind: classify(path) }));
      const current = { ...state, phase: 'building' as const, sequence: state.sequence + 1, changes, action: 'none' as const, recovered: false, diagnostics: [], hostSteps: [] };
      emit(current);
      let staging: string | undefined;
      try {
        const workspace = join(dirname(output), '.mcpkit');
        await mkdir(workspace, { recursive: true });
        staging = await mkdtemp(join(workspace, 'watch-'));
        const result = await buildPluginToDirectory({ ...options, source, outputDir: output, typesFile: types }, staging);
        // Read all preview/provenance bytes before promotion; a read failure is a failed build.
        const nextHtml = await readFile(join(staging, 'view.html'), 'utf8');
        const manifest: BuildManifest = JSON.parse(await readFile(join(staging, 'build.json'), 'utf8'));
        for (const path of Object.keys(manifest.inputs)) {
          if (path.split(sep).includes('node_modules') || inside(source, path)) continue;
          dependencies.add(path);
          // Seed new transitive dependencies with their build-time hashes so
          // the following scan also catches changes during their first build.
          if (!Object.hasOwn(observed, path)) observed[path] = manifest.inputs[path];
        }
        for (const path of manifest.serverInputs ?? []) serverInputs.add(path);
        await scan();
        // Compare both polling generations and actual source/dependency bytes.
        if (stopped || attempt !== revision) { emit({ ...current, phase: 'superseded' }); continue; }
        const backup = staging + '-previous';
        let moved = false;
        try { await rename(output, backup); moved = true; } catch (error) { if (!missing(error)) throw error; }
        try { await rename(staging, output); }
        catch (error) {
          if (moved) {
            try { await rename(backup, output); }
            catch (restoreError) { throw new AggregateError([error, restoreError], `Publication and rollback failed. Previous artifacts are preserved at ${backup}.`); }
          }
          throw error;
        }
        staging = undefined;
        if (moved) await rm(backup, { recursive: true, force: true }).catch(() => {});
        const contractChanged = lastResult && JSON.stringify(lastResult.tools) !== JSON.stringify(result.tools);
        const action = changes.some(change => change.kind === 'manifest') || contractChanged ? 'refresh-manifest'
          : changes.some(change => change.kind === 'server') ? 'restart-server' : 'reload-view';
        html = nextHtml;
        published = before;
        publishedRevision = attempt;
        lastResult = result;
        emit({ ...current, phase: 'ready', build: result.build, action, recovered: failed,
          hostSteps: [
            `Update the installed plugin from ${output} if the host uses a copied installation.`,
            action === 'refresh-manifest' ? 'Reload the plugin/MCP connection and rediscover tools/resources after manifest or tool-contract changes.'
              : action === 'restart-server' ? 'Restart the host MCP server to load changed server/Worker code, then open a new card.' : 'Reload the host MCP connection to refresh its embedded build identity, then open a new card to load the updated View; existing cards keep their running App.',
            `Compare the actual server _meta.mcpkit.build.id and loaded View build marker with ${result.build.id}. If a new card is stale, inspect host resource caching; this watcher cannot clear host caches.`,
          ] });
        failed = false;
      } catch (error) {
        await scan().catch(() => {});
        if (stopped || attempt !== revision) { emit({ ...current, phase: 'superseded' }); continue; }
        failed = true;
        publishedRevision = attempt;
        emit({ ...current, phase: 'failed', diagnostics: diagnostics(error) });
      } finally { if (staging) await rm(staging, { recursive: true, force: true }); }
    }
  }
  function run() {
    if (!running) running = drain().finally(() => { running = undefined; });
    return running;
  }
  async function poll() {
    try {
      await scan();
      if (revision !== publishedRevision && Date.now() - changedAt >= debounce) await run();
    } catch (error) {
      failed = true;
      publishedRevision = -1;
      emit({ ...state, phase: 'failed', action: 'none', diagnostics: diagnostics(error) });
    }
    finally { if (!stopped) timer = setTimeout(() => { void poll(); }, pollInterval); }
  }
  try {
    observed = await snapshot();
    if (preview) {
      const script = (await build({ entryPoints: [fileURLToPath(new URL('./runtime/watch-host.ts', import.meta.url))], bundle: true, write: false,
        platform: 'browser', format: 'esm', target: 'es2022',
        define: { __PREVIEW_INPUT__: JSON.stringify(preview.input ?? {}), __PREVIEW_MODE__: JSON.stringify(preview.displayMode ?? 'inline') },
      })).outputFiles[0].text;
      server = createServer((req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        const path = new URL(req.url ?? '/', 'http://localhost').pathname;
        if (path === '/__mcpkit/status') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(state)); }
        else if (path === '/host.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(script); }
        else if (path === '/view.html' && html) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); }
        else if (path === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><meta charset="utf-8"><title>MCPKit development preview</title><style>body{margin:0;background:#111;color:#eee;font:14px monospace}pre{white-space:pre-wrap;padding:12px}iframe{border:0;width:100%;height:80vh;display:block}</style><pre id="status">Building…</pre><div id="preview"></div><script type="module" src="/host.js"></script>'); }
        else res.writeHead(404).end();
      });
      await new Promise<void>((resolve, reject) => { server!.once('error', reject); server!.listen(preview.port ?? 0, '127.0.0.1', resolve); });
      previewUrl = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/`;
    }
    await run();
    timer = setTimeout(() => { void poll(); }, pollInterval);
  } catch (error) {
    stopped = true;
    server?.closeAllConnections();
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    throw error;
  }
  return {
    previewUrl,
    get state() { return structuredClone(state); },
    async rebuild() {
      if (stopped) throw new Error('Watcher is closed.');
      await scan();
      revision++;
      do { await run(); } while (!stopped && publishedRevision !== revision);
    },
    async close() {
      if (stopped) { await running; return; }
      stopped = true;
      clearTimeout(timer);
      await running;
      server?.closeAllConnections();
      if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
      emit({ ...state, phase: 'closed' });
    },
  };
}
