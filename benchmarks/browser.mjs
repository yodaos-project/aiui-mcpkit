import assert from 'node:assert/strict';
import { access, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { join } from 'node:path';
import { instrument } from './instrumentation.mjs';
import { distribution, frameStats } from './metrics.mjs';
import { rssBytes } from './footprint.mjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function launchOptions() {
  const executablePath = process.env.CHROMIUM_PATH || await access('/usr/bin/chromium').then(() => '/usr/bin/chromium', () => undefined);
  return { ...(executablePath ? { executablePath } : {}), headless: true };
}

async function pixels(frame) {
  return frame.locator('canvas#ink').evaluate(canvas => {
    const ctx = canvas.getContext('2d');
    const y = Math.round(80 * devicePixelRatio);
    const bytes = ctx.getImageData(0, y, canvas.width, canvas.height - y).data;
    let green = 0, hash = 2166136261;
    for (let i = 0; i < bytes.length; i += 4) {
      if (bytes[i + 1] > bytes[i] && bytes[i + 1] > bytes[i + 2]) green++;
      hash = Math.imul(hash ^ bytes[i + 1], 16777619) >>> 0;
    }
    const marker = ctx.getImageData(Math.round(8 * devicePixelRatio), Math.round(8 * devicePixelRatio), 1, 1).data;
    return { green, hash, width: canvas.width, height: canvas.height, markerOn: marker[1] > 200 && marker[0] < 100 };
  });
}

async function waitForSequence(frame, sequence) {
  await frame.waitForFunction(expected => window.__benchmark.errors.length || window.__benchmark.presentedSequence === expected, sequence);
  assert.deepEqual(await frame.evaluate(() => window.__benchmark.errors), []);
}

export async function browserSample(scene, settings, base, outputDirectory, index) {
  const options = await launchOptions();
  const browser = await chromium.launch(options);
  let sampling = true, sampler, page;
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 800, height: 800 }, deviceScaleFactor: settings.dpr, reducedMotion: 'no-preference' });
    await context.addInitScript(instrument);
    page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    const cdp = await context.newCDPSession(page);
    const processCdp = await browser.newBrowserCDPSession();
    await cdp.send('Performance.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const frame = page.frameLocator('iframe');
    const memory = [];
    async function sampleMemory() {
      const { processInfo } = await processCdp.send('SystemInfo.getProcessInfo');
      const rss = await rssBytes(processInfo.map(info => info.id));
      const { metrics } = await cdp.send('Performance.getMetrics');
      const heap = metrics.find(m => m.name === 'JSHeapUsedSize')?.value;
      const wasm = await page.evaluate(() => document.querySelector('iframe')?.contentWindow?.__benchmark?.wasmMemories.reduce((sum, memory) => sum + memory.buffer.byteLength, 0) || 0);
      assert.ok(Number.isFinite(heap), 'CDP JS heap measurement unavailable');
      memory.push({ atMs: performance.now(), browserRssBytes: rss, jsHeapBytes: heap, wasmLinearBytes: wasm });
    }
    // Sample initialization too, rather than only the already-open view.
    sampler = (async () => { while (sampling) { await sampleMemory(); await delay(settings.memorySampleMs); } })();
    // Keep a rejection observed until cleanup awaits the sampling task.
    void sampler.catch(() => {});
    await page.goto(`${base}/?scenario=${scene.id}&mode=${scene.mode}&width=${scene.width}&height=${scene.height}&input=${encodeURIComponent(JSON.stringify(scene.input))}`);
    const appFrame = () => page.frames().find(f => f.url().includes('/view?'));
    await frame.locator('body[data-ready="true"]').waitFor({ timeout: 30000 });
    const iframe = appFrame();
    assert.ok(iframe, 'No benchmark app frame');
    await waitForSequence(iframe, 0);
    const initialState = await iframe.evaluate(() => window.__benchmark.states.at(-1));
    assert.equal(initialState.scenario, scene.id); scene.check(initialState);
    const initialPixels = await pixels(frame);
    assert.ok(initialPixels.green > 100, `${scene.id}: initial content is blank`);
    assert.equal(initialPixels.markerOn, false);
    assert.equal(initialPixels.width, scene.width * settings.dpr);
    assert.equal(initialPixels.height, scene.height * settings.dpr);
    const canvas = frame.locator('canvas#ink');
    await canvas.click({ position: { x: 80, y: 58 } });
    await waitForSequence(iframe, 1);
    const timeToInteractiveMs = await iframe.evaluate(() => window.__benchmark.firstInteractiveAtMs);
    await canvas.screenshot({ path: join(outputDirectory, 'screenshots', `${scene.id}-${index}-warmup.png`) });
    await iframe.evaluate(() => { window.__benchmark.phase = 'active'; window.__benchmark.activeStart = performance.now(); });
    for (let sequence = 2; sequence <= settings.operations + 1; sequence++) {
      await canvas.click({ position: { x: 80, y: 58 } });
      await waitForSequence(iframe, sequence);
      const state = await iframe.evaluate(() => window.__benchmark.states.at(-1));
      assert.equal(state.sequence, sequence); scene.check(state);
      // Fixed think time allows the 10Hz feed to update independently of input.
      await delay(settings.thinkTimeMs);
    }
    const active = await iframe.evaluate(() => {
      const d = window.__benchmark; d.phase = 'settling';
      return { durationMs: performance.now() - d.activeStart, latencies: d.latencies, rafTimes: d.rafTimes, presentations: d.presentations,
        firstVerifiedFrameMs: d.firstVerifiedFrameMs, errors: d.errors, state: d.states.at(-1), ticks: d.ticks };
    });
    assert.equal(active.latencies.length, settings.operations, 'Every input must produce verified pixels');
    assert.deepEqual(active.errors, []);
    if (scene.id === 'live-dashboard') {
      assert.ok(active.ticks.at(-1) >= 2, 'Live feed did not update');
      await canvas.click({ position: { x: 240, y: 58 } });
      await iframe.waitForFunction(() => window.__benchmark.paused);
    }
    await delay(100); // let input/paint work settle before the idle window
    const before = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    await delay(settings.idleMs);
    const after = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const idleSeconds = after.Timestamp - before.Timestamp;
    assert.ok(idleSeconds > 0 && Number.isFinite(after.TaskDuration - before.TaskDuration), 'Idle CPU measurement unavailable');
    const finalPixels = await pixels(frame);
    assert.ok(finalPixels.green > 100, `${scene.id}: final content is blank`);
    assert.equal(finalPixels.markerOn, (settings.operations + 1) % 2 === 1, 'Final marker must remain correct after idle');
    assert.notEqual(initialPixels.hash, finalPixels.hash, `${scene.id}: business content did not change`);
    await canvas.screenshot({ path: join(outputDirectory, 'screenshots', `${scene.id}-${index}-final.png`) });
    await sampleMemory();
    sampling = false; await sampler;
    assert.deepEqual(errors, []);
    assert.ok(memory.some(s => s.wasmLinearBytes > 0), 'Exported WASM linear memory measurement unavailable');
    return { index, chromium: browser.version(), firstVerifiedFrameMs: active.firstVerifiedFrameMs, timeToInteractiveMs,
      inputToCanvasMs: distribution(active.latencies), frameOpportunities: frameStats(active.rafTimes, settings.targetHz),
      canvasSubmissions: { count: active.presentations.length, perSecond: active.presentations.length * 1000 / active.durationMs, intervals: frameStats(active.presentations, settings.targetHz).intervalsMs },
      activeDurationMs: active.durationMs,
      idle: { durationMs: idleSeconds * 1000, mainThreadCpuPercent: (after.TaskDuration - before.TaskDuration) / idleSeconds * 100 },
      memory: { sampleIntervalMs: settings.memorySampleMs, peakBrowserRssBytes: Math.max(...memory.map(s => s.browserRssBytes)),
        peakJsHeapBytes: Math.max(...memory.map(s => s.jsHeapBytes)), peakWasmLinearBytes: Math.max(...memory.map(s => s.wasmLinearBytes)), samples: memory },
      correctness: { passed: true, initialState, finalState: active.state, initialPixels, finalPixels, liveTicks: active.ticks.at(-1) ?? null, errors },
      raw: { inputToCanvasMs: active.latencies, rafTimestampsMs: active.rafTimes, canvasSubmissionTimestampsMs: active.presentations } };
  } catch (error) {
    if (page) {
      const diagnostic = await page.evaluate(() => {
        const frame = document.querySelector('iframe');
        const d = frame?.contentWindow?.__benchmark;
        return { ready: frame?.contentDocument?.body?.dataset.ready, states: d?.states, presentedSequence: d?.presentedSequence, errors: d?.errors };
      }).catch(() => null);
      await writeFile(join(outputDirectory, `${scene.id}-${index}-failure.json`), JSON.stringify({ error: error.message, errors, diagnostic }, null, 2) + '\n');
      await page.screenshot({ path: join(outputDirectory, 'screenshots', `${scene.id}-${index}-failure.png`) }).catch(() => {});
    }
    throw error;
  } finally {
    sampling = false;
    try { await sampler; } finally { await browser.close(); }
  }
}
