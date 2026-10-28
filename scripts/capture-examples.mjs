import assert from 'node:assert/strict';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { serveShowcase, liveState, waitForExample } from './lib/showcase-browser.mjs';

const assets = 'docs/assets/examples';
const textures = 'videos/showcase/out/captures';
await mkdir(assets, { recursive: true }); await mkdir(textures, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const manifest = { renderer: 'Ink/WASM through MCP Apps AppBridge', data: 'Curated, deterministic demo fixtures; no live services', captures: [] };
try {
  for (const [id, tool] of [['travel', 'trip_state'], ['focus', 'focus_state'], ['analytics', 'analytics_state'], ['events', 'workshop_state']]) {
    const host = await serveShowcase(id, {}, 'fullscreen');
    const page = await browser.newPage({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 3 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(host.url); await waitForExample(page, tool);
      const canvas = page.frameLocator('iframe').locator('canvas');
      const click = (x, y) => canvas.click({ position: { x, y } });
      const state = () => liveState(page, tool);
      async function capture(name, action) {
        await canvas.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await canvas.screenshot({ path: `${textures}/${name}.png` });
        manifest.captures.push({ id, file: `${name}.png`, viewport: { width: 800, height: 500 }, dpr: 3, mode: 'fullscreen', action, state: await state(), layout: { canvas: { x: 0, y: 0, width: 800, height: 500 } }, errors: [...errors] });
      }
      await capture(`${id}-before`, 'Initial tool input');
      await copyFile(`${textures}/${id}-before.png`, `${assets}/${id}.png`);
      if (id === 'travel') {
        await click(135, 278); await expect.poll(async () => (await state()).day).toBe(2);
        await capture('travel-day2', { click: { x: 135, y: 278 } });
        await click(520, 120); await expect.poll(async () => (await state()).selected).toBe('bamboo');
        await capture('travel-saved', { click: { x: 520, y: 120 } });
        await click(540, 397); await expect.poll(() => page.evaluate(() => window.showcase.messages.length)).toBe(1);
        await capture('travel-after', { click: { x: 540, y: 397 }, context: 'saved_trip_stop', message: 'Accepted by local demo host; no model runs' });
      } else if (id === 'focus') {
        await click(543, 309); await expect.poll(async () => (await state()).running).toBe(true);
        await capture('focus-running', { click: { x: 543, y: 309 } });
        await expect.poll(async () => (await state()).remaining).toBeLessThan(1500);
        await capture('focus-ticking', 'Actual timer tick');
        await click(543, 309); await expect.poll(async () => (await state()).running).toBe(false);
        await capture('focus-after', { click: { x: 543, y: 309 } });
      } else if (id === 'analytics') {
        await click(730, 106); await expect.poll(async () => (await state()).period).toBe('month');
        await capture('analytics-after', { click: { x: 730, y: 106 } });
      } else {
        await click(665, 226); await expect.poll(async () => (await state()).session).toBe('afternoon');
        await capture('events-session', { click: { x: 665, y: 226 } });
        await click(567, 284); await expect.poll(async () => (await state()).seats).toBe(2);
        await capture('events-seats', { clicks: [{ x: 665, y: 226 }, { x: 567, y: 284 }] });
        await click(540, 339); await expect.poll(async () => (await state()).stage).toBe('review');
        await capture('events-review', { click: { x: 540, y: 339 } });
        await click(540, 350); await expect.poll(async () => (await state()).stage).toBe('confirmed');
        await capture('events-after', { click: { x: 540, y: 350 } });
      }
      assert.deepEqual(errors, []);
    } finally { await page.close(); await host.close(); }
    for (const width of [420, 360]) {
      const host = await serveShowcase(id);
      const page = await browser.newPage({ viewport: { width, height: 280 }, deviceScaleFactor: 2 });
      try {
        await page.goto(host.url); await waitForExample(page, tool);
        await page.frameLocator('iframe').locator('canvas').screenshot({ path: `${assets}/${id}-${width === 420 ? 'inline' : 'narrow'}.png` });
      } finally { await page.close(); await host.close(); }
    }
    console.log(`Captured ${id}: real initial/interactive states, inline and narrow layouts`);
  }
  await writeFile(`${textures}/layout.json`, JSON.stringify(manifest, null, 2) + '\n');
} finally { await browser.close(); }
