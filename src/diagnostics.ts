import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { BuildIdentity } from './runtime/build-info.js';
export type { BuildIdentity } from './runtime/build-info.js';

export interface BuildManifest {
  schemaVersion: 1;
  build: BuildIdentity;
  /** Local provenance only; never exposed through MCP or embedded in the View. */
  source: { directory: string; excluded: string[]; files: Record<string, string> };
  inputs: Record<string, string>;
  artifacts: Record<string, string>;
  resources: string[];
}

export function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function hashRecord(value: unknown): value is Record<string, string> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.values(value).every(digest => typeof digest === 'string' && /^[a-f0-9]{64}$/.test(digest));
}

/** Snapshot includes added/deleted files but excludes outputs and local secrets. */
export async function sourceSnapshot(directory: string, excluded: string[]): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  async function walk(path: string) {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const next = join(path, entry.name);
      const name = relative(directory, next).replaceAll('\\', '/');
      if (excluded.some(value => next === value || next.startsWith(value + sep)) || ['.git', 'node_modules', '.mcpkit', 'dist'].includes(name) || entry.name === '.env' || entry.name.startsWith('.env.')) continue;
      if (entry.isDirectory()) await walk(next);
      else if (entry.isFile()) files[name] = sha256(await readFile(next));
      else throw new Error(`Unsupported source entry: ${next}`);
    }
  }
  await walk(directory);
  return files;
}

export interface BuildInspection {
  directory: string;
  build: BuildIdentity | null;
  integrity: 'ok' | 'modified' | 'legacy';
  changedArtifacts: string[];
  source: 'current' | 'changed' | 'unavailable' | 'unchecked';
  changedInputs: string[];
}

/** Verify bytes, rather than trusting a copied build.json alone. */
export async function inspectBuild(directory: string, checkSource = false): Promise<BuildInspection> {
  directory = resolve(directory);
  const result: BuildInspection = { directory, build: null, integrity: 'legacy', changedArtifacts: [], source: 'unchecked', changedInputs: [] };
  let manifest: BuildManifest;
  try { manifest = JSON.parse(await readFile(join(directory, 'build.json'), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return result; throw error; }
  if (!manifest || manifest.schemaVersion !== 1 || !manifest.build || manifest.build.schemaVersion !== 1
    || !/^[a-f0-9]{64}$/.test(manifest.build.id) || typeof manifest.build.name !== 'string' || typeof manifest.build.version !== 'string'
    || !hashRecord(manifest.artifacts) || !['view.html', 'dist/server.mjs', 'plugin.json', 'mcp.json'].every(path => Object.hasOwn(manifest.artifacts, path))
    || !hashRecord(manifest.inputs) || !manifest.source || !isAbsolute(manifest.source.directory)
    || !Array.isArray(manifest.source.excluded) || manifest.source.excluded.some(path => typeof path !== 'string' || !isAbsolute(path))
    || !hashRecord(manifest.source.files)) throw new Error('Unsupported or invalid build.json. Rebuild the plugin.');
  result.build = manifest.build;
  for (const [path, expected] of Object.entries(manifest.artifacts)) {
    if (isAbsolute(path) || path.split(/[\\/]/).some(part => part === '..')) throw new Error('Invalid artifact path in build.json.');
    const digest = await readFile(join(directory, path)).then(sha256, error => { if (error.code === 'ENOENT') return null; throw error; });
    if (digest !== expected) result.changedArtifacts.push(path);
  }
  result.integrity = result.changedArtifacts.length ? 'modified' : 'ok';
  if (checkSource) {
    try {
      const files = await sourceSnapshot(manifest.source.directory, manifest.source.excluded);
      result.changedInputs = [...new Set([...Object.keys(files), ...Object.keys(manifest.source.files)])]
        .filter(path => files[path] !== manifest.source.files[path]).map(path => join(manifest.source.directory, path));
      for (const [path, expected] of Object.entries(manifest.inputs)) {
        const digest = await readFile(path).then(sha256, error => { if (error.code === 'ENOENT') return null; throw error; });
        if (digest !== expected) result.changedInputs.push(path);
      }
      result.source = result.changedInputs.length ? 'changed' : 'current';
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      result.source = 'unavailable';
    }
  }
  return result;
}

export interface DiagnoseOptions {
  buildDir: string;
  installedDir?: string;
  /** Observed in the desktop client's actual tool/resource response, not a new server process. */
  serverBuildId?: string;
  /** Read from the loaded document's meta[name=mcpkit-build-id] or body.dataset.mcpkitBuildId. */
  viewBuildId?: string;
  /** Set only after observing whether the inspected card was newly opened. */
  newCard?: boolean;
}

export async function diagnosePlugin(options: DiagnoseOptions) {
  const built = await inspectBuild(options.buildDir, true);
  const installed = options.installedDir ? await inspectBuild(options.installedDir) : undefined;
  const findings: { code: string; message: string }[] = [];
  const add = (code: string, message: string) => findings.push({ code, message });
  if (!built.build) add('REBUILD_REQUIRED', 'No build identity. Rebuild with the current MCPKit.');
  if (built.source === 'changed') add('REBUILD_REQUIRED', 'Source or build dependencies changed. Rebuild before updating the installation.');
  if (built.source === 'unavailable') add('SOURCE_UNAVAILABLE', 'Build provenance paths are unavailable on this machine; source freshness is unknown.');
  if (built.integrity === 'modified') add('BUILD_ARTIFACTS_MODIFIED', 'Generated artifact bytes differ from build.json. Rebuild.');
  if (installed && (!installed.build || installed.build.id !== built.build?.id || installed.integrity !== 'ok')) add('INSTALL_UPDATE_REQUIRED', 'Installed artifacts differ from the source build. Update the configured installation directory.');
  const expected = (installed ?? built).build?.id;
  if (!options.serverBuildId) add('SERVER_NOT_OBSERVED', 'Inspect _meta.mcpkit.build.id in an actual client tool/resource response; absent metadata may indicate a legacy server.');
  else if (options.serverBuildId !== expected) add('SERVER_RELOAD_REQUIRED', 'The observed server differs from the files on disk. Reload the client MCP server.');
  if (!options.viewBuildId) add('VIEW_NOT_OBSERVED', 'Inspect the loaded document build marker. Older Views have no marker; open a new card after reloading.');
  else if (options.viewBuildId !== expected) {
    if (options.serverBuildId !== expected) add('VIEW_REFRESH_REQUIRED', 'Reload the server, then open a new card and inspect again.');
    else if (options.newCard === true) add('HOST_CACHE_SUSPECTED', 'A newly opened View differs from the current server/files. Check the configured connection and host resource cache; MCPKit cannot forcibly clear host caches.');
    else if (options.newCard === false) add('EXISTING_CARD', 'This existing card retains an older View. Open a new card; reloading files does not replace its running App.');
    else add('VIEW_STALE', 'View differs from server/files. Inspect a new card to distinguish an existing card from possible host caching.');
  }
  if (!findings.length) add('CURRENT', 'Source, generated files and all supplied installation/server/View observations match.');
  return { built, installed, observed: { serverBuildId: options.serverBuildId, viewBuildId: options.viewBuildId, newCard: options.newCard }, findings };
}
