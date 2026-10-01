import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distribution, frameStats, compareReports, markdownReport } from '../benchmarks/metrics.mjs';

test('benchmark percentiles use nearest rank and do not mutate raw samples', () => {
  const values = [100, ...Array.from({ length: 99 }, (_, i) => i + 1)];
  const result = distribution(values);
  assert.equal(result.p95, 95);
  assert.equal(result.median, 50);
  assert.equal(result.mean, 50.5);
  assert.equal(values[0], 100);
  for (const invalid of [[], [NaN], [Infinity], [-1]]) assert.throws(() => distribution(invalid));
});

test('frame estimates count missed opportunities, distinguish empty data and ignore refresh jitter', () => {
  const result = frameStats([0, 16.7, 33.3, 83.3], 60);
  assert.equal(result.estimatedMissedSlots, 2);
  assert.equal(result.estimatedMissedRatio, 2 / 5);
  assert.equal(result.intervalsMs.max, 50);
  assert.equal(frameStats([0], 60).intervalsMs, null);
  assert.equal(frameStats([0, 8.33, 16.66], 120).estimatedMissedSlots, 0);
});

test('benchmark Markdown tables have matching header, delimiter and data columns', () => {
  const sample = { firstVerifiedFrameMs: 100, timeToInteractiveMs: 200, inputToCanvasMs: { p95: 20 },
    frameOpportunities: { intervalsMs: { p95: 16.7 }, estimatedMissedRatio: 0 },
    idle: { mainThreadCpuPercent: 1 }, memory: { peakBrowserRssBytes: 1000, peakJsHeapBytes: 200, peakWasmLinearBytes: 500 } };
  const workload = { calls: 8, concurrency: 1, callsPerSecond: 100, latencyMs: { p95: 10 } };
  const markdown = markdownReport({ label: 'test', createdAt: '2026-10-01', settings: { samples: 1 },
    environment: { host: 'test host', machine: { platform: 'linux', arch: 'x64', cpuModel: 'test CPU', logicalCpus: 4, totalMemoryBytes: 1073741824 } },
    versions: { chromium: 'test', ink: '0.18.0' }, scenarios: [{ id: 'small-card', samples: [sample] }],
    server: { sequential: workload, concurrent: { ...workload, concurrency: 4 } },
    sizes: { dependencies: { developmentBytes: 1, productionBytes: 2, installedBytes: 3, unclassifiedOrMetadataBytes: 0 },
      npmPackage: { tarballBytes: 100, unpackedBytes: 200 }, generated: { totalBytes: 300 },
      uiResource: { htmlBytes: 100, protocolJsonBytes: 150, gzipBytes: 50 }, wasm: { rawBytes: 200, gzipBytes: 80 } },
    limitations: ['Test measurement boundaries.'] });
  const tables = markdown.split('\n\n').filter(block => block.startsWith('|'));
  assert.equal(tables.length, 4, 'Scenario, memory, server and size tables must be present');
  for (const table of tables) {
    const rows = table.split('\n').map(row => row.split('|').slice(1, -1).map(cell => cell.trim()));
    const [header, delimiter, ...data] = rows;
    assert.equal(delimiter.length, header.length, `Invalid delimiter width: ${header.join(', ')}`);
    assert.ok(delimiter.every(cell => /^:?-{3,}:?$/.test(cell)), 'Expected GFM table delimiters');
    assert.ok(data.length > 0);
    for (const row of data) assert.equal(row.length, header.length, 'Data cells must match the header');
  }
});

test('A/B comparison rejects incompatible conditions and compares runtime changes without inventing missing metrics', () => {
  const sample = { firstVerifiedFrameMs: 100, timeToInteractiveMs: 200, inputToCanvasMs: { p95: 20 }, frameOpportunities: { intervalsMs: null, estimatedMissedRatio: null },
    idle: { mainThreadCpuPercent: 0 }, memory: { peakBrowserRssBytes: 1000, peakJsHeapBytes: 200, peakWasmLinearBytes: 500 } };
  const before = { schemaVersion: 1, comparisonKey: 'same', label: 'before', versions: { ink: '0.18.0', wasmSha256: 'old' },
    scenarios: [{ id: 'small-card', samples: [sample] }], server: { sequential: { callsPerSecond: 100 }, concurrent: { callsPerSecond: 200 } },
    sizes: { npmPackage: { tarballBytes: 100 }, generated: { totalBytes: 200 }, uiResource: { htmlBytes: 150 } } };
  const after = structuredClone(before);
  after.label = 'after'; after.versions = { ink: 'next', wasmSha256: 'new' };
  after.scenarios[0].samples[0].inputToCanvasMs.p95 = 10;
  const comparison = compareReports(before, after);
  assert.equal(comparison.scenarios[0].changes.inputToCanvasP95Ms.percent, -50);
  assert.equal(comparison.scenarios[0].changes.idleMainThreadCpuPercent.percent, null);
  assert.equal(comparison.scenarios[0].changes.frameIntervalP95Ms, undefined);
  assert.equal(comparison.runtime.afterWasmSha256, 'new');
  after.comparisonKey = 'different';
  assert.throws(() => compareReports(before, after), /different machines/);
  after.schemaVersion = 2;
  assert.throws(() => compareReports(before, after), /Unsupported/);
});
