import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { join, dirname, resolve } from 'node:path';
import { cpus, platform, arch, release, totalmem, hostname } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';
import { browserSample, launchOptions } from './browser.mjs';
import { scenarios, limitations } from './scenarios.mjs';
import { filesIn, footprint } from './footprint.mjs';
import { serverBenchmark } from './server.mjs';
import { fingerprint, markdownReport, compareReports } from './metrics.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const exec = promisify(execFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function main() {
  const { values } = parseArgs({ options: {
    out: { type: 'string', default: 'benchmark-results/latest' }, label: { type: 'string', default: 'baseline' },
    samples: { type: 'string', default: '3' }, operations: { type: 'string', default: '30' },
    'idle-ms': { type: 'string', default: '2000' }, 'think-time-ms': { type: 'string', default: '25' },
    'server-calls': { type: 'string', default: '1000' }, 'server-concurrency': { type: 'string', default: '4' },
    'memory-sample-ms': { type: 'string', default: '100' }, dpr: { type: 'string', default: '1' },
    'target-hz': { type: 'string', default: '60' }, scenario: { type: 'string' }, baseline: { type: 'string' },
    help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log(`Usage: npm run bench -- [options]
  --out <directory>             Report, screenshots and generated plugin (benchmark-results/latest)
  --label <name>                Run label (baseline)
  --samples <n>                 Fresh browser processes per scenario (3)
  --operations <n>              Measured pointer actions after one warmup action (30)
  --idle-ms <n>                 Idle CPU window, dashboard feed paused (2000)
  --think-time-ms <n>           Fixed delay between verified actions (25)
  --server-calls <n>            Calls per stdio workload, after 10 warmups (1000)
  --server-concurrency <n>      Parallel stdio clients' requests (4, one connection)
  --memory-sample-ms <n>        Browser memory sampling interval (100)
  --dpr <n>                    Device scale factor (1)
  --target-hz <n>              Frame-opportunity reference rate (60)
  --scenario <id>              Select one of: ${scenarios.map(s => s.id).join(', ')}
  --baseline <report.json>     Compare under matching measurement conditions

Requires npm run build and Playwright Chromium. CHROMIUM_PATH selects a local browser.
RSS measurement currently supports macOS/Linux. No automatic browser installation.`);
    return;
  }
  if (!['darwin', 'linux'].includes(platform())) throw new Error('Browser RSS sampling requires macOS or Linux ps; this benchmark does not yet support Windows.');
  const settings = {};
  for (const [option, key, min] of [
    ['samples', 'samples', 1], ['operations', 'operations', 3], ['idle-ms', 'idleMs', 100], ['think-time-ms', 'thinkTimeMs', 0],
    ['server-calls', 'serverCalls', 1], ['server-concurrency', 'serverConcurrency', 1], ['memory-sample-ms', 'memorySampleMs', 50],
    ['dpr', 'dpr', 1], ['target-hz', 'targetHz', 1],
  ]) {
    const number = Number(values[option]);
    if (!Number.isSafeInteger(number) || number < min) throw new Error(`--${option} must be an integer >= ${min}`);
    settings[key] = number;
  }
  const selected = values.scenario ? scenarios.filter(s => s.id === values.scenario) : scenarios;
  if (!selected.length) throw new Error(`Unknown scenario: ${values.scenario}`);
  const output = resolve(values.out);
  const baselineReport = values.baseline ? JSON.parse(await readFile(resolve(values.baseline), 'utf8')) : undefined;
  const fixture = join(root, 'benchmarks/agent');
  await mkdir(join(output, 'screenshots'), { recursive: true });
  // Invalidate a previous success before starting; failures must not leave a
  // stale successful report looking like the result of this run.
  await writeFile(join(output, 'status.json'), JSON.stringify({ state: 'running', label: values.label }) + '\n');
  let http;
  try {
    const buildStart = performance.now();
    const plugin = await buildPlugin({ source: fixture, name: 'mcpkit-benchmark', outputDir: join(output, 'plugin') });
    const buildMs = performance.now() - buildStart;
    const server = await serverBenchmark(plugin.files.server, settings);
    const { resource, ...serverMetrics } = server;
    const views = new Map(plugin.tools.map(tool => [tool.page, resource.contents[0].text.replace(/<body data-page="[^"]*">/, `<body data-page="${tool.page}">`)]));
    const host = (await build({ entryPoints: [join(root, 'benchmarks/host.ts')], bundle: true, write: false, platform: 'browser', format: 'esm', target: 'es2022', minify: false })).outputFiles[0].text;
    http = createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (url.pathname === '/view') {
        const html = views.get(url.searchParams.get('scenario'));
        if (!html) { res.writeHead(404); res.end('Unknown scenario'); return; }
        res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; connect-src 'none'; img-src data:; font-src 'none'");
        res.end(html);
      } else if (url.pathname === '/') {
        const scene = selected.find(s => s.id === url.searchParams.get('scenario'));
        if (!scene) { res.writeHead(404); res.end('Unknown scenario'); return; }
        res.end(`<html><body style="margin:0;background:black"><iframe style="width:${scene.width}px;height:${scene.height}px;border:0"></iframe><script type="module">${host}</script></body></html>`);
      } else { res.writeHead(404); res.end(); }
    });
    await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${http.address().port}`;
    const results = [];
    for (const scene of selected) {
      const samples = [];
      for (let index = 1; index <= settings.samples; index++) {
        console.log(`${scene.id}: sample ${index}/${settings.samples}`);
        samples.push(await browserSample(scene, settings, base, output, index));
      }
      results.push({ id: scene.id, viewport: { width: scene.width, height: scene.height, dpr: settings.dpr }, displayMode: scene.mode, workload: scene.workload, samples });
    }
    const versions = { node: process.version };
    for (const [name, key] of [['@yodaos-pkg/ink', 'ink'], ['@modelcontextprotocol/sdk', 'mcpSdk'], ['@modelcontextprotocol/ext-apps', 'mcpApps'], ['@playwright/test', 'playwright'], ['esbuild', 'esbuild'], ['typescript', 'typescript'], ['@yodaos-pkg/aiui-mcpkit', 'mcpkit']]) {
      // Some packages deliberately do not export package.json.
      let path;
      try { path = name === '@yodaos-pkg/aiui-mcpkit' ? join(root, 'package.json') : require.resolve(`${name}/package.json`); }
      catch { path = join(root, 'node_modules', name, 'package.json'); }
      let metadata = JSON.parse(await readFile(path, 'utf8'));
      if (!metadata.version) metadata = JSON.parse(await readFile(join(root, 'node_modules', name, 'package.json'), 'utf8'));
      if (typeof metadata.version !== 'string') throw new Error(`Cannot identify installed version: ${name}`);
      versions[key] = metadata.version;
    }
    versions.chromium = results[0].samples[0].chromium;
    const wasm = await readFile(join(dirname(require.resolve('@yodaos-pkg/ink/package.json')), 'pkg/ink_web_bg.wasm'));
    versions.wasmSha256 = hash(wasm);
    const fixtureFiles = await filesIn(fixture);
    const fixtureHash = hash(Buffer.concat(await Promise.all(fixtureFiles.sort((a, b) => a.path.localeCompare(b.path)).map(async f => Buffer.concat([Buffer.from(f.path.slice(fixture.length)), await readFile(f.path)])))));
    const hostHash = hash(host);
    const methodologyHash = hash(Buffer.concat(await Promise.all(['browser.mjs', 'instrumentation.mjs', 'metrics.mjs', 'server.mjs', 'footprint.mjs', 'scenarios.mjs', 'run.mjs'].map(name => readFile(join(root, 'benchmarks', name))))));
    const environment = { host: 'MCPKit benchmark AppBridge host v1 (local headless Chromium)', hostHash,
      launchOptions: await launchOptions(), machine: { hostId: hash(hostname()), platform: platform(), arch: arch(), osRelease: release(), cpuModel: cpus()[0].model, logicalCpus: cpus().length, totalMemoryBytes: totalmem() } };
    const revision = await exec('git', ['rev-parse', 'HEAD'], { cwd: root }).then(r => r.stdout.trim(), () => null);
    const worktreeDirty = await exec('git', ['status', '--porcelain'], { cwd: root }).then(r => r.stdout.trim().length > 0, () => null);
    const comparisonKey = fingerprint({ method: 1, methodologyHash, environment, settings, fixtureHash, scenarios: selected.map(s => s.id),
      versions: { node: versions.node, chromium: versions.chromium, mcpSdk: versions.mcpSdk, mcpApps: versions.mcpApps, playwright: versions.playwright, esbuild: versions.esbuild, typescript: versions.typescript } });
    const report = { schemaVersion: 1, methodVersion: 1, label: values.label, createdAt: new Date().toISOString(), comparisonKey,
      revision, worktreeDirty, fixtureHash, methodologyHash, environment, settings, versions, build: { durationMs: buildMs, target: 'node22/es2022', viewMinified: true, wasmGzipLevel: 9 },
      sizes: await footprint(root, plugin.outputDir, resource, wasm), scenarios: results, server: serverMetrics, limitations };
    await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await writeFile(join(output, 'report.md'), markdownReport(report));
    if (baselineReport) {
      await writeFile(join(output, 'comparison.json'), JSON.stringify(compareReports(baselineReport, report), null, 2) + '\n');
    }
    await writeFile(join(output, 'status.json'), JSON.stringify({ state: 'passed', label: values.label }) + '\n');
    console.log(`Verified benchmark report: ${join(output, 'report.md')}`);
  } catch (error) {
    await writeFile(join(output, 'status.json'), JSON.stringify({ state: 'failed', label: values.label, error: error.message }) + '\n');
    throw error;
  } finally { if (http) await new Promise(resolve => http.close(resolve)); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
