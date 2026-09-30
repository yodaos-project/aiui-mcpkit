import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';

const harnessJs = (await build({ entryPoints: ['tests/harness.ts'], bundle: true, write: false, platform: 'browser', format: 'iife' })).outputFiles[0].text;
const view = await readFile('plugins/aiui-mcpkit/view.html');
const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (req.url.startsWith('/view')) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; connect-src 'none'; img-src data:; font-src 'none'");
    res.end(view);
  }
  else res.end(`<html><body><iframe style="width:420px;height:280px;border:0"></iframe><script type="module">${harnessJs}</script></body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => server.close());

for (const scenario of ['accept', 'refuse', 'inline-only']) {
  test(`real Ink WASM render and mode handling: ${scenario}`, async () => {
    const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/?mode=${scenario}`);
      const frame = page.frameLocator('iframe');
      try {
        await frame.locator('body[data-ready="true"]').waitFor({ timeout: 15000 });
      } catch (error) {
        console.error('Browser startup:', await frame.locator('#status').textContent().catch(() => 'no status'), 'bridgeReady', await page.evaluate(() => window.__bridgeReady), errors);
        throw error;
      }
      const pixels = await frame.locator('canvas').evaluate(canvas => {
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        return new Set(Array.from(data.filter((_, i) => i % 4 === 0))).size;
      });
      assert.ok(pixels > 2, `canvas appears blank: ${pixels} red channel values`);
      await frame.locator('canvas').click({ position: { x: 210, y: 176 } });
      await frame.locator('#status').getByText('Count 1').waitFor({ timeout: 10000 });
      if (scenario !== 'inline-only') await frame.locator('#expand').click();
      if (scenario === 'accept') {
        await frame.locator('body[data-mode="fullscreen"]').waitFor();
        await frame.locator('#collapse').click();
        await frame.locator('body[data-mode="inline"]').waitFor();
        await frame.locator('canvas').click({ position: { x: 210, y: 176 } });
        await frame.locator('#status').getByText('Count 2').waitFor({ timeout: 10000 });
        assert.equal((await page.evaluate(() => window.__requests)).length, 2);
      } else {
        assert.equal(await frame.locator('body').getAttribute('data-mode'), 'inline');
        if (scenario === 'refuse') await frame.locator('#status').getByText('Host kept inline').waitFor();
        else {
          assert.equal(await frame.locator('#expand').isDisabled(), true);
          assert.equal((await page.evaluate(() => window.__requests)).length, 0);
        }
      }
      assert.equal(errors.length, 0, errors.join('\n'));
    } finally { await browser.close(); }
  });
}
