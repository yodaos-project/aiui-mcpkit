import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { build } from 'esbuild';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const harnessJs = (await build({ entryPoints: ['tests/harness.ts'], bundle: true, write: false, platform: 'browser', format: 'iife' })).outputFiles[0].text;
const client = new Client({ name: 'counter-browser-host', version: '1' });
const views = [];
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/server.mjs'], cwd: `${process.cwd()}/dist/examples/counter` }));
  for (const name of ['open_counter', 'open_countdown']) {
    views.push((await client.readResource({ uri: `ui://ink-counter/${name}.html` })).contents[0].text);
  }
} finally { await client.close(); }
const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (req.url.startsWith('/view')) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; connect-src 'none'; img-src data:; font-src 'none'");
    res.end(views[Number(new URL(req.url, 'http://localhost').searchParams.get('page')) || 0]);
  }
  else res.end(`<html><body><iframe style="width:420px;height:280px;border:0"></iframe><script type="module">${harnessJs}</script></body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => server.close());

for (const scenario of ['host-modes', 'inline-only', 'initial-fullscreen']) {
  test(`real Ink WASM render and mode handling: ${scenario}`, async () => {
    const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : await access('/usr/bin/chromium').then(() => ({ executablePath: '/usr/bin/chromium' }), () => ({}))), headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      const errors = [];
      const counts = [];
      page.on('console', message => {
        if (message.text().startsWith('Ink message: ')) {
          const data = JSON.parse(message.text().slice('Ink message: '.length));
          if (data.type === 'counter-change') counts.push(data.count);
        }
      });
      async function expectCount(count) {
        await new Promise((resolve, reject) => {
          const deadline = Date.now() + 10000;
          function check() {
            if (counts.at(-1) === count) return resolve();
            if (Date.now() > deadline) return reject(new Error(`Expected count ${count}, got ${counts}`));
            setTimeout(check, 20);
          }
          check();
        });
      }
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/?mode=${scenario}`);
      const frame = page.frameLocator('iframe');
      try {
        await frame.locator('body[data-ready="true"]').waitFor({ timeout: 15000 });
      } catch (error) {
        console.error('Browser startup:', await frame.locator('body').getAttribute('data-ready'), 'bridgeReady', await page.evaluate(() => window.__bridgeReady), errors);
        throw error;
      }
      assert.equal(await frame.locator('#controls, #status, button').count(), 0);
      const pixels = await frame.locator('canvas').evaluate(canvas => {
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let green = 0;
        let other = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 1] > data[i] && data[i + 1] > data[i + 2]) green++;
          else if (data[i] > 0 || data[i + 1] > 0 || data[i + 2] > 0) other++;
        }
        return { green, other };
      });
      assert.ok(pixels.green > 100, `canvas appears blank: ${pixels.green} green pixels`);
      assert.equal(pixels.other, 0, 'canvas should use only the monochrome-green palette');
      if (scenario === 'initial-fullscreen') {
        assert.equal(await frame.locator('body').getAttribute('data-mode'), 'fullscreen');
        if (process.env.INK_SCREENSHOTS) await frame.locator('canvas').screenshot({ path: `${process.env.INK_SCREENSHOTS}/fullscreen-480x352.png` });
        // This action exists only in the _blank layout, including on first open.
        await frame.locator('canvas').click({ position: { x: 120, y: 224 } });
        await expectCount(10);
        assert.equal(errors.length, 0, errors.join('\n'));
        return;
      }
      if (process.env.INK_SCREENSHOTS) await frame.locator('canvas').screenshot({ path: `${process.env.INK_SCREENSHOTS}/inline.png` });
      await frame.locator('canvas').click({ position: { x: 210, y: 176 } });
      await expectCount(1);
      await page.evaluate(() => window.__setMode('fullscreen'));
      if (scenario === 'host-modes') {
        await frame.locator('body[data-mode="fullscreen"]').waitFor();
        // The expanded Ink content must be painted below the compact summary.
        await page.waitForFunction(() => {
          const canvas = document.querySelector('iframe').contentDocument.querySelector('canvas');
          const data = canvas.getContext('2d').getImageData(0, Math.round(canvas.height / 3), canvas.width, Math.round(canvas.height / 2)).data;
          return data.some((value, i) => i % 4 === 1 && value > 0);
        });
        if (process.env.INK_SCREENSHOTS) await frame.locator('canvas').screenshot({ path: `${process.env.INK_SCREENSHOTS}/fullscreen.png` });
        await frame.locator('canvas').click({ position: { x: 100, y: 224 } });
        await expectCount(11);
        await frame.locator('canvas').click({ position: { x: 290, y: 224 } });
        await expectCount(0);
        await page.evaluate(() => window.__setMode('inline'));
        await frame.locator('body[data-mode="inline"]').waitFor();
        await frame.locator('canvas').click({ position: { x: 210, y: 176 } });
        await expectCount(1);
      } else {
        assert.equal(await frame.locator('body').getAttribute('data-mode'), 'inline');
      }
      assert.equal(errors.length, 0, errors.join('\n'));
    } finally { await browser.close(); }
  });
}

for (const scenario of [
  { page: 0, args: { initialCount: 5, label: 'Demo' }, loaded: { type: 'counter-loaded', page: 'counter', count: 5, label: 'Demo' }, counts: [6] },
  { page: 1, args: { start: 8, step: 2 }, loaded: { type: 'counter-loaded', page: 'countdown', count: 8, step: 2 }, counts: [6, 4, 2, 0, 0] },
  { page: 1, args: { start: 3 }, loaded: { type: 'counter-loaded', page: 'countdown', count: 3, step: 1 }, counts: [2] },
]) {
  test(`Counter example renders ${scenario.loaded.page} with tool arguments ${JSON.stringify(scenario.args)}`, async () => {
    const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : await access('/usr/bin/chromium').then(() => ({ executablePath: '/usr/bin/chromium' }), () => ({}))), headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      const messages = [];
      const errors = [];
      page.on('console', message => {
        if (message.text().startsWith('Ink message: ')) messages.push(JSON.parse(message.text().slice('Ink message: '.length)));
      });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/?page=${scenario.page}&args=${encodeURIComponent(JSON.stringify(scenario.args))}`);
      const frame = page.frameLocator('iframe');
      await frame.locator('body[data-ready="true"]').waitFor({ timeout: 15000 });
      await expect.poll(() => messages.filter(message => message.type === 'counter-loaded')).toEqual([scenario.loaded]);
      assert.ok(await frame.locator('canvas').evaluate(canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value, i) => i % 4 === 1 && value > 0)), 'page must paint visible content');
      for (const [index, count] of scenario.counts.entries()) {
        await frame.locator('canvas').click({ position: { x: 210, y: 176 } });
        await expect.poll(() => messages.filter(message => message.type === 'counter-change').map(message => message.count)).toEqual(scenario.counts.slice(0, index + 1));
        assert.equal(messages.at(-1).count, count);
      }
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
