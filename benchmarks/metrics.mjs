import { createHash } from 'node:crypto';

export function distribution(values) {
  if (!values.length || values.some(value => !Number.isFinite(value) || value < 0)) throw new Error('Expected nonempty, finite, nonnegative samples.');
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = p => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
  return { count: sorted.length, min: sorted[0], median: percentile(0.5), p95: percentile(0.95), max: sorted.at(-1), mean: values.reduce((a, b) => a + b, 0) / values.length };
}

export function frameStats(timestamps, targetHz) {
  if (!Number.isFinite(targetHz) || targetHz <= 0) throw new Error('Expected a positive target frame rate.');
  const intervals = timestamps.slice(1).map((time, i) => time - timestamps[i]);
  if (intervals.length === 0) return { intervalsMs: null, estimatedMissedSlots: 0, estimatedMissedRatio: null };
  const missed = intervals.reduce((sum, ms) => sum + Math.max(0, Math.round(ms * targetHz / 1000) - 1), 0);
  return { intervalsMs: distribution(intervals), estimatedMissedSlots: missed, estimatedMissedRatio: missed / (intervals.length + missed) };
}

export const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function compareReports(before, after) {
  if (before.schemaVersion !== 1 || after.schemaVersion !== 1) throw new Error('Unsupported benchmark report version.');
  if (before.comparisonKey !== after.comparisonKey) throw new Error('Reports have different machines, hosts, fixtures, dependencies or measurement settings; rerun under matching conditions.');
  const change = (a, b) => ({ before: a, after: b, delta: b - a, percent: a === 0 ? null : (b - a) / a * 100 });
  const metrics = {
    firstVerifiedFrameMs: sample => sample.firstVerifiedFrameMs,
    timeToInteractiveMs: sample => sample.timeToInteractiveMs,
    inputToCanvasP95Ms: sample => sample.inputToCanvasMs.p95,
    frameIntervalP95Ms: sample => sample.frameOpportunities.intervalsMs?.p95,
    estimatedMissedRatio: sample => sample.frameOpportunities.estimatedMissedRatio,
    idleMainThreadCpuPercent: sample => sample.idle.mainThreadCpuPercent,
    peakBrowserRssBytes: sample => sample.memory.peakBrowserRssBytes,
    peakJsHeapBytes: sample => sample.memory.peakJsHeapBytes,
    peakWasmLinearBytes: sample => sample.memory.peakWasmLinearBytes,
  };
  const scenarios = after.scenarios.map(scenario => {
    const prior = before.scenarios.find(item => item.id === scenario.id);
    if (!prior || prior.samples.length !== scenario.samples.length) throw new Error(`Missing or incompatible scenario: ${scenario.id}`);
    const changes = Object.fromEntries(Object.entries(metrics).flatMap(([name, read]) => {
      const a = prior.samples.map(read), b = scenario.samples.map(read);
      return a.some(value => value == null) || b.some(value => value == null) ? [] : [[name, change(distribution(a).median, distribution(b).median)]];
    }));
    return { id: scenario.id, changes };
  });
  return { schemaVersion: 1, before: before.label, after: after.label,
    runtime: { before: before.versions.ink, after: after.versions.ink, beforeWasmSha256: before.versions.wasmSha256, afterWasmSha256: after.versions.wasmSha256 },
    scenarios, server: Object.fromEntries(['sequential', 'concurrent'].map(name => [name, change(before.server[name].callsPerSecond, after.server[name].callsPerSecond)])),
    sizes: { npmTarballBytes: change(before.sizes.npmPackage.tarballBytes, after.sizes.npmPackage.tarballBytes),
      generatedBytes: change(before.sizes.generated.totalBytes, after.sizes.generated.totalBytes),
      uiHtmlBytes: change(before.sizes.uiResource.htmlBytes, after.sizes.uiResource.htmlBytes) } };
}

const number = value => value == null ? 'unavailable' : value.toFixed(2);
export function markdownReport(report) {
  const rows = report.scenarios.map(scene => {
    const median = fn => distribution(scene.samples.map(fn)).median;
    return `| ${scene.id} | ${number(median(s => s.firstVerifiedFrameMs))} | ${number(median(s => s.timeToInteractiveMs))} | ${number(median(s => s.inputToCanvasMs.p95))} | ${number(median(s => s.frameOpportunities.intervalsMs.p95))} | ${number(median(s => s.frameOpportunities.estimatedMissedRatio * 100))} | ${number(median(s => s.idle.mainThreadCpuPercent))} | ${number(median(s => s.memory.peakBrowserRssBytes / 1048576))} |`;
  });
  return `# MCPKit benchmark: ${report.label}\n\n${report.createdAt}\n\n` +
    `Host: ${report.environment.host}; Chromium ${report.versions.chromium}; Ink ${report.versions.ink}.\n\n` +
    `Machine: ${report.environment.machine.platform}/${report.environment.machine.arch}, ${report.environment.machine.cpuModel}, ${report.environment.machine.logicalCpus} CPUs, ${(report.environment.machine.totalMemoryBytes / 1073741824).toFixed(1)} GiB RAM.\n\n` +
    `Each row is the median of ${report.settings.samples} independent browser-process samples. Input p95 is calculated per sample.\n\n` +
    `| Scenario | First verified frame ms | Exercised TTI ms | Input → Canvas p95 ms | rAF interval p95 ms | Missed slots estimate % | Idle main-thread CPU % | Sampled peak browser RSS MiB |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n${rows.join('\n')}\n\n` +
    `## Sampled memory\n\nMedian of each sample's peak; these categories must not be added together.\n\n| Scenario | Browser RSS MiB | JS heap MiB | WASM linear MiB |\n| --- | ---: | ---: | ---: |\n` +
    report.scenarios.map(scene => `| ${scene.id} | ${['peakBrowserRssBytes', 'peakJsHeapBytes', 'peakWasmLinearBytes'].map(key => number(distribution(scene.samples.map(s => s.memory[key] / 1048576)).median)).join(' | ')} |`).join('\n') + '\n\n' +
    `## Server, measured separately\n\n| Workload | Calls | Concurrency | Calls/s | Latency p95 ms |\n| --- | ---: | ---: | ---: | ---: |\n` +
    ['sequential', 'concurrent'].map(name => { const s = report.server[name]; return `| ${name} | ${s.calls} | ${s.concurrency} | ${number(s.callsPerSecond)} | ${number(s.latencyMs.p95)} |`; }).join('\n') + '\n\n' +
    `## Sizes (bytes)\n\n| Category | Bytes |\n| --- | ---: |\n` +
    Object.entries({ 'Installed development-only dependencies': report.sizes.dependencies.developmentBytes, 'Installed production/shared dependencies': report.sizes.dependencies.productionBytes,
      'Installed dependencies total': report.sizes.dependencies.installedBytes, 'Unclassified dependencies or install metadata': report.sizes.dependencies.unclassifiedOrMetadataBytes,
      'npm tarball': report.sizes.npmPackage.tarballBytes, 'npm unpacked files': report.sizes.npmPackage.unpackedBytes,
      'Generated plugin total': report.sizes.generated.totalBytes, 'UI HTML': report.sizes.uiResource.htmlBytes,
      'MCP resource JSON': report.sizes.uiResource.protocolJsonBytes, 'UI HTML gzip': report.sizes.uiResource.gzipBytes,
      'Ink WASM raw': report.sizes.wasm.rawBytes, 'Ink WASM gzip': report.sizes.wasm.gzipBytes }).map(([name, bytes]) => `| ${name} | ${bytes} |`).join('\n') +
    `\n\n## Measurement boundaries\n\n${report.limitations.map(item => `- ${item}`).join('\n')}\n\nRaw timings, memory samples, checks, settings, hashes and versions: [report.json](report.json). Screenshot evidence is in screenshots/.\n`;
}
