import assert from 'node:assert/strict';

export const scenarios = [
  { id: 'small-card', tool: 'benchmark_card', mode: 'inline', width: 420, height: 220, input: { value: 7 },
    workload: 'Increment a card counter once per pointer input.',
    check: state => assert.equal(state.value, 7 + state.sequence) },
  { id: 'virtual-list', tool: 'benchmark_list', mode: 'fullscreen', width: 640, height: 480, input: {},
    workload: '10000 deterministic rows, 20 mounted rows, 18px row height; advance the window and scroll position by 50 rows per input.',
    check: state => { assert.equal(state.first, (state.sequence * 50) % 9981); assert.equal(state.renderedRows, 20); assert.equal(state.totalRows, 10000); } },
  { id: 'live-dashboard', tool: 'benchmark_dashboard', mode: 'fullscreen', width: 640, height: 480, input: {},
    workload: '8 metrics updated at 10Hz: value=(tick*17+index*31)%100. Input changes selected metric. Pause before idle CPU measurement.',
    check: state => { assert.equal(state.selected, state.sequence % 8); assert.equal(state.metrics, 8); } },
  { id: 'dense-canvas', tool: 'benchmark_canvas', mode: 'fullscreen', width: 640, height: 480, input: {},
    workload: 'Redraw 512 rectangles and a 512-segment polyline on a 600x360 Ink Canvas for each input.',
    check: state => { assert.equal(state.bars, 512); assert.equal(state.segments, 512); } },
];

export const limitations = [
  'This is a local headless Chromium MCP Apps AppBridge host using real Ink WASM, not a Codex/Claude/VS Code compatibility or device benchmark.',
  'Cold start uses a fresh browser process and profile per sample, with browser HTTP cache disabled. OS filesystem caches, host thermal state and background load are not controlled.',
  'First verified frame requires a business-state message, a Canvas submission and pixel correctness. Exercised TTI ends at the first successfully rendered pointer action and includes Playwright readiness/polling overhead.',
  'Input-to-display is a proxy: trusted DOM pointerdown to last Canvas2D surface mutation in the render turn with the expected marker pixels. It includes the tap gesture but does not measure compositor completion or physical display scanout.',
  'Frame intervals are browser requestAnimationFrame opportunities, not engine render durations. Missed slots are estimated against the configured target Hz; they are not measured GPU/compositor dropped frames. Canvas submissions are recorded separately.',
  'Idle CPU is CDP TaskDuration delta / wall time for the page main thread, including the benchmark observer. Dashboard feed is paused; the monitor continues during idle.',
  'Memory is sampled, not an exact transient high-water mark. Browser RSS sums isolated Chromium process RSS (shared pages may be counted twice); CDP JS heap and exported WASM linear memory are reported separately. GPU allocations are not measured.',
  'Installed dependency sizes are logical file bytes classified by package-lock dev flags; dependencies shared with production are counted as production. npm tarball, generated files and protocol resource JSON are different size categories.',
  'The stdio server workload is a trivial validated computation, measured separately without opening a browser. Its throughput is not rendering performance or external-service throughput.',
];
