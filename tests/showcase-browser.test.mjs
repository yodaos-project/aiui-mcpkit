import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { serveShowcase, liveState, waitForExample } from '../scripts/lib/showcase-browser.mjs';

for (const [id, tool, input] of [
  ['travel', 'trip_state', {}], ['focus', 'focus_state', { minutes: 1, task: 'Write the next chapter' }],
  ['analytics', 'analytics_state', {}], ['events', 'workshop_state', {}],
]) {
  test(`${id}: real Ink buttons change live state in an inline view and retain it in fullscreen`, async () => {
    const host = await serveShowcase(id, input);
    let browser;
    try {
      browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
      const page = await browser.newPage({ viewport: { width: 420, height: 280 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(host.url); await waitForExample(page, tool);
      const canvas = page.frameLocator('iframe').locator('canvas');
      const click = (x, y) => canvas.click({ position: { x, y } });
      if (id === 'travel') {
        await click(86, 106);
        await expect.poll(async () => (await liveState(page, tool)).day).toBe(2);
        await click(270, 49);
        await expect.poll(async () => (await liveState(page, tool)).selected).toBe('bamboo');
        assert.deepEqual(await page.evaluate(() => window.showcase.contexts), [], 'Saving alone must not publish context');
        await click(280, 180);
        await expect.poll(() => page.evaluate(() => window.showcase.messages.length)).toBe(1);
        const context = await page.evaluate(() => window.showcase.contexts.at(-1));
        assert.deepEqual(context.structuredContent.contexts.saved_trip_stop.value, { city: 'Kyoto', day: 2, stop: 'Into the bamboo', time: '08:00' });
        await click(35, 106);
        await expect.poll(async () => (await liveState(page, tool)).selected).toBe('');
      } else if (id === 'focus') {
        assert.equal((await liveState(page, tool)).remaining, 60);
        await click(280, 153);
        await expect.poll(async () => (await liveState(page, tool)).running).toBe(true);
        await expect.poll(async () => (await liveState(page, tool)).remaining).toBeLessThan(60);
        await click(280, 153);
        await expect.poll(async () => (await liveState(page, tool)).running).toBe(false);
        await click(374, 153);
        assert.equal((await liveState(page, tool)).remaining, 60);
      } else if (id === 'analytics') {
        await click(381, 44);
        await expect.poll(async () => (await liveState(page, tool)).period).toBe('month');
        assert.equal((await liveState(page, tool)).revenue, '98,420');
        await click(336, 44);
        await expect.poll(async () => (await liveState(page, tool)).period).toBe('week');
        assert.equal((await liveState(page, tool)).revenue, '24,860');
      } else {
        await click(350, 94); await click(298, 128);
        await expect.poll(async () => (await liveState(page, tool)).seats).toBe(2);
        assert.equal((await liveState(page, tool)).total, 96);
        await click(280, 160);
        await expect.poll(async () => (await liveState(page, tool)).stage).toBe('review');
        await click(280, 167);
        await expect.poll(async () => (await liveState(page, tool)).stage).toBe('confirmed');
        assert.equal((await liveState(page, tool)).session, 'afternoon');
        assert.deepEqual(await page.evaluate(() => window.showcase.messages), [], 'Demo confirmation must not send a real booking');
        // Changing a choice invalidates the previous review/confirmation.
        await click(298, 128);
        await expect.poll(async () => (await liveState(page, tool)).stage).toBe('choose');
      }
      const before = await liveState(page, tool);
      for (const [width, height, mode] of [[800, 500, 'fullscreen'], [360, 280, 'inline']]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(displayMode => window.showcase.bridge.setHostContext({ displayMode }), mode);
        await page.frameLocator('iframe').locator(`body[data-mode="${mode}"]`).waitFor();
        await expect.poll(() => canvas.evaluate(c => Math.round(c.getBoundingClientRect().width))).toBe(width);
        assert.deepEqual(await liveState(page, tool), before);
      }
      await page.evaluate(() => window.showcase.bridge.teardownResource({}));
      if (id === 'travel') assert.deepEqual(await page.evaluate(() => window.showcase.contexts.at(-1)), { structuredContent: {} });
      assert.deepEqual(errors, []);
    } finally { await browser?.close(); await host.close(); }
  });
}
