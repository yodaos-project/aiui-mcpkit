import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { build } from 'esbuild';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('business example renders structured/UI data and calls/cancels its real server from Ink', async () => {
  // The unified build:examples command produces both plugins before npm test.
  const client = new Client({ name: 'business-browser', version: '1' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } } }); let browser, http;
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/examples/business/dist/server.mjs'] }));
    await client.listTools();
    const initial = await client.callTool({ name: 'quote_order', arguments: { quantity: 2 } });
    const html = (await client.readResource({ uri: 'ui://business-demo/quote_order.html' })).contents[0].text;
    const harness = (await build({ stdin: { resolveDir: process.cwd(), contents: `
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
const frame = document.querySelector('iframe');
const bridge = new AppBridge(null, { name: 'business-host', version: '1' }, { serverTools: {} });
window.aborted = 0; window.calls = 0;
bridge.oncalltool = async (params, extra) => {
  window.calls++;
  const controller = new AbortController();
  extra.mcpReq.signal.addEventListener('abort', () => { window.aborted++; controller.abort(); });
  const response = await fetch('/tool', { method: 'POST', body: JSON.stringify(params), signal: controller.signal });
  return response.json();
};
bridge.oninitialized = () => {
  // Send the result before WASM startup, exercising queued initial rendering data.
  void bridge.sendToolInput({ arguments: { quantity: 2 } });
  void bridge.sendToolResult(${JSON.stringify(initial)});
};
await bridge.connect(new PostMessageTransport(frame.contentWindow, frame.contentWindow)); frame.src = '/view';
` }, bundle: true, write: false, platform: 'browser', format: 'esm' })).outputFiles[0].text;
    http = createServer(async (req, res) => {
      if (req.url === '/tool') {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const params = JSON.parse(Buffer.concat(chunks).toString());
        const controller = new AbortController(); res.on('close', () => { if (!res.writableEnded) controller.abort(); });
        try {
          const result = await client.callTool(params, undefined, { signal: controller.signal });
          res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result));
        } catch { if (!res.destroyed) res.end(JSON.stringify({ isError: true, content: [] })); }
      } else {
        res.setHeader('Content-Type', 'text/html'); res.end(req.url === '/view' ? html : `<iframe style="width:420px;height:280px;border:0"></iframe><script type="module">${harness}</script>`);
      }
    });
    await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : await access('/usr/bin/chromium').then(() => ({ executablePath: '/usr/bin/chromium' }), () => ({}))), headless: true });
    const page = await browser.newPage(); const messages = []; const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.text().startsWith('Ink message: ')) messages.push(JSON.parse(message.text().slice('Ink message: '.length))); });
    await page.goto(`http://127.0.0.1:${http.address().port}`);
    const frame = page.frameLocator('iframe'); await frame.locator('body[data-ready="true"]').waitFor({ timeout: 15000 });
    await expect.poll(() => messages.filter(message => message.type === 'quote-rendered').length).toBe(1);
    const rendered = messages.find(message => message.type === 'quote-rendered');
    assert.deepEqual(rendered.quote, { quantity: 2, unitPrice: 20, total: 40, currency: 'CNY' });
    assert.equal(rendered.uiOnly.stockRemaining, 98);
    assert.ok(await frame.locator('canvas').evaluate(canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value, i) => i % 4 === 1 && value > 0)));
    if (process.env.INK_SCREENSHOTS) await frame.locator('canvas').screenshot({ path: `${process.env.INK_SCREENSHOTS}/business.png` });
    // Buttons occupy the bottom action row in the 420 x 220 canvas.
    await frame.locator('canvas').click({ position: { x: 150, y: 180 } });
    await expect.poll(() => page.evaluate(() => window.calls)).toBe(1);
    await expect.poll(() => messages.filter(message => message.type === 'quote-rendered').length).toBe(2);
    await frame.locator('canvas').click({ position: { x: 150, y: 180 } });
    await expect.poll(() => page.evaluate(() => window.calls)).toBe(2);
    await frame.locator('canvas').click({ position: { x: 260, y: 180 } });
    await expect.poll(() => page.evaluate(() => window.aborted)).toBe(1);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close(); if (http) await new Promise(resolve => http.close(resolve)); await client.close();
  }
});
