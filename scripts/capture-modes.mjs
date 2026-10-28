import assert from 'node:assert/strict';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { serveShowcase, liveState, waitForExample } from './lib/showcase-browser.mjs';

const out = 'videos/showcase/public/textures';
await mkdir(out, { recursive: true });
for (const id of ['focus', 'analytics', 'events']) {
  await copyFile(`docs/assets/examples/${id}-inline.png`, `${out}/${id}-inline.png`);
}
const host = await serveShowcase('travel');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 420, height: 280 }, deviceScaleFactor: 3 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const captures = [];
try {
  await page.goto(host.url); await waitForExample(page, 'trip_state');
  const canvas = page.frameLocator('iframe').locator('canvas');
  const state = () => liveState(page, 'trip_state');
  async function capture(name, mode, action) {
    await canvas.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await canvas.screenshot({ path: `${out}/${name}.png` });
    captures.push({ name, mode, action, state: await state(), canvas: await canvas.boundingBox(), errors: [...errors] });
  }
  await capture('inline-start', 'inline', 'Open trip in the existing View');
  await canvas.click({ position: { x: 86, y: 106 } });
  await expect.poll(async () => (await state()).day).toBe(2);
  await capture('inline-day2', 'inline', { click: { x: 86, y: 106 } });
  await canvas.click({ position: { x: 270, y: 49 } });
  await expect.poll(async () => (await state()).selected).toBe('bamboo');
  const selected = await state();
  await capture('inline-bamboo', 'inline', { click: { x: 270, y: 49 } });
  await page.setViewportSize({ width: 800, height: 500 });
  await page.evaluate(() => window.showcase.bridge.setHostContext({ displayMode: 'fullscreen' }));
  await page.frameLocator('iframe').locator('body[data-mode="fullscreen"]').waitFor();
  await expect.poll(() => canvas.evaluate(c => c.width / devicePixelRatio)).toBe(800);
  assert.deepEqual(await state(), selected, 'Expanding must retain the exact selected stop in the existing View');
  await capture('expanded-bamboo', 'fullscreen', 'Host display-mode change on the same View');
  await canvas.click({ position: { x: 520, y: 295 } });
  await expect.poll(async () => (await state()).selected).toBe('garden');
  const changed = await state();
  await capture('expanded-garden', 'fullscreen', { click: { x: 520, y: 295 } });
  await page.setViewportSize({ width: 420, height: 280 });
  await page.evaluate(() => window.showcase.bridge.setHostContext({ displayMode: 'inline' }));
  await page.frameLocator('iframe').locator('body[data-mode="inline"]').waitFor();
  await expect.poll(() => canvas.evaluate(c => c.width / devicePixelRatio)).toBe(420);
  assert.deepEqual(await state(), changed, 'Returning inline must retain the fullscreen edit');
  await capture('inline-garden', 'inline', 'Return the same View to inline mode');
  assert.deepEqual(errors, []);
  await writeFile(`${out}/modes.json`, JSON.stringify({
    host: 'Local MCP Apps AppBridge. Codex shell in the film is an explicitly approved illustration.',
    instance: 'One View and one bridge for the entire sequence; no reload, recreation or synthesized state.',
    dpr: 3, assertions: { expansionRetainsSelection: true, returnRetainsEdit: true, noPageErrors: true }, captures,
  }, null, 2) + '\n');
  console.log('Captured actual inline → fullscreen → inline flow; selection survives both mode changes.');
} finally { await page.close(); await browser.close(); await host.close(); }
