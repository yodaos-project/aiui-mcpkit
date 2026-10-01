import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const exec = promisify(execFile);
export async function filesIn(directory, excludeNestedModules = false) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!(excludeNestedModules && entry.name === 'node_modules')) files.push(...await filesIn(path, excludeNestedModules));
    } else if (entry.isFile()) files.push({ path, bytes: (await stat(path)).size });
  }
  return files;
}

export async function footprint(root, pluginDirectory, resource, wasm) {
  const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
  const dependencyPackages = [];
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path.startsWith('node_modules/') || entry.link) continue;
    let files;
    try { files = await filesIn(join(root, path), true); }
    catch (error) { if (error.code === 'ENOENT' && entry.optional) continue; throw error; }
    const installed = JSON.parse(await readFile(join(root, path, 'package.json'), 'utf8'));
    dependencyPackages.push({ path, version: installed.version, developmentOnly: entry.dev === true, bytes: files.reduce((sum, file) => sum + file.bytes, 0) });
  }
  const [pack] = JSON.parse((await exec('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], { cwd: root, maxBuffer: 10 * 1024 * 1024 })).stdout);
  const generated = await Promise.all((await filesIn(pluginDirectory)).map(async file => ({ path: file.path.slice(pluginDirectory.length + 1), bytes: file.bytes,
    sha256: createHash('sha256').update(await readFile(file.path)).digest('hex') })));
  const installedBytes = (await filesIn(join(root, 'node_modules'))).reduce((sum, file) => sum + file.bytes, 0);
  const html = resource.contents[0].text;
  return {
    dependencies: { installedBytes, unclassifiedOrMetadataBytes: installedBytes - dependencyPackages.reduce((sum, p) => sum + p.bytes, 0),
      developmentBytes: dependencyPackages.filter(p => p.developmentOnly).reduce((sum, p) => sum + p.bytes, 0),
      productionBytes: dependencyPackages.filter(p => !p.developmentOnly).reduce((sum, p) => sum + p.bytes, 0), packages: dependencyPackages },
    npmPackage: { tarballBytes: pack.size, unpackedBytes: pack.unpackedSize, fileCount: pack.entryCount },
    generated: { totalBytes: generated.reduce((sum, file) => sum + file.bytes, 0), files: generated },
    uiResource: { htmlBytes: Buffer.byteLength(html), protocolJsonBytes: Buffer.byteLength(JSON.stringify(resource)), gzipBytes: gzipSync(html, { level: 9 }).byteLength },
    wasm: { rawBytes: wasm.byteLength, gzipBytes: gzipSync(wasm, { level: 9 }).byteLength },
  };
}

export async function rssBytes(pids) {
  if (!pids.length) throw new Error('No process IDs available for RSS sampling.');
  const { stdout } = await exec('ps', ['-o', 'pid=,rss=', '-p', pids.join(',')]);
  return stdout.trim().split('\n').reduce((sum, line) => {
    const [pid, kib] = line.trim().split(/\s+/).map(Number);
    if (!Number.isFinite(pid) || !Number.isFinite(kib)) throw new Error('Invalid ps RSS sample.');
    return sum + kib * 1024;
  }, 0);
}
