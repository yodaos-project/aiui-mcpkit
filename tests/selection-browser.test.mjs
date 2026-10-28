import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { build } from 'esbuild';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// This verifies real server -> Ink UI -> host delivery. It does not run a model.
test('candidate selection publishes only selected fields before a generic message, updates and clears context', async () => {
  const client = new Client({ name: 'selection-browser', version: '1' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } } });
  let browser, server;
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/examples/business/dist/server.mjs'], env: { INK_WORKER_BIN: process.env.INK_WORKER_BIN || 'ink-worker' } }));
    const initial = await client.callTool({ name: 'find_products', arguments: { query: 'travel' } });
    const html = (await client.readResource({ uri: 'ui://business-demo/find_products.html' })).contents[0].text;
    const harness = (await build({ stdin: { resolveDir: process.cwd(), contents: `
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
const frame = document.querySelector('iframe');
const bridge = new AppBridge(null, { name: 'selection-test-host', version: '1' }, { updateModelContext: { structuredContent: {} }, message: { text: {} } });
window.contexts = []; window.messages = []; window.deferContext = true;
bridge.onupdatemodelcontext = async params => {
  window.contexts.push(params);
  if (window.deferContext) await new Promise(resolve => { window.ackContext = resolve; });
  return {};
};
bridge.onmessage = async params => { window.messages.push(params); return {}; };
bridge.oninitialized = () => {
  void bridge.sendToolInput({ arguments: { query: 'travel' } });
  void bridge.sendToolResult(${JSON.stringify(initial)});
};
window.bridge = bridge;
await bridge.connect(new PostMessageTransport(frame.contentWindow, frame.contentWindow)); frame.src = '/view';
` }, bundle: true, write: false, platform: 'browser', format: 'esm' })).outputFiles[0].text;
    server = createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(req.url === '/view' ? html : `<iframe style="width:420px;height:280px;border:0"></iframe><script type="module">${harness}</script>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const executablePath = process.env.CHROMIUM_PATH || await access('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome').then(() => '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', () => undefined);
    browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const canvas = page.frameLocator('iframe').locator('canvas');
    await page.frameLocator('iframe').locator('body[data-ready="true"]').waitFor({ timeout: 15000 });
    // Wait for WASM to render the queued result. Canvas pixels, rather than a DOM
    // placeholder, must contain the actual candidate buttons before interaction.
    await expect.poll(() => canvas.evaluate(canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((v, i) => i % 4 === 1 && v > 40))).toBe(true);
    if (process.env.INK_SCREENSHOTS) await canvas.screenshot({ path: `${process.env.INK_SCREENSHOTS}/selection.png` });
    await canvas.click({ position: { x: 285, y: 80 } });
    await canvas.click({ position: { x: 210, y: 165 } });
    await expect.poll(() => page.evaluate(() => window.contexts.length)).toBe(1);
    const first = (await page.evaluate(() => window.contexts))[0];
    const selection = first.structuredContent.contexts.product_selection.value;
    assert.deepEqual(Object.keys(selection).sort(), ['currency', 'name', 'selectionId', 'sku', 'unitPrice']);
    assert.deepEqual({ ...selection, selectionId: undefined }, { sku: 'TRAVEL-BAG', name: 'Travel bag', unitPrice: 249, currency: 'CNY', selectionId: undefined });
    assert.match(selection.selectionId, /^selection-[a-z0-9]+$/);
    assert.ok(!JSON.stringify(first).includes(initial._meta.uiOnly.supplier));
    assert.ok(!JSON.stringify(first).includes('Gift idea'));
    assert.ok(!JSON.stringify(first).includes('TRAVEL-MUG'));
    assert.deepEqual(await page.evaluate(() => window.messages), []);
    await page.evaluate(() => { window.deferContext = false; window.ackContext(); });
    await expect.poll(() => page.evaluate(() => window.messages.length)).toBe(1);
    const message = (await page.evaluate(() => window.messages))[0];
    assert.equal(message.role, 'user');
    for (const marker of [selection.sku, selection.name, selection.selectionId, '249', 'Gift idea', initial._meta.uiOnly.supplier]) {
      assert.ok(!JSON.stringify(message).includes(marker), marker);
    }
    await canvas.click({ position: { x: 130, y: 80 } });
    await canvas.click({ position: { x: 210, y: 165 } });
    await expect.poll(() => page.evaluate(() => window.messages.length)).toBe(2);
    const second = (await page.evaluate(() => window.contexts)).at(-1).structuredContent.contexts.product_selection.value;
    assert.equal(second.sku, 'TRAVEL-MUG');
    assert.notEqual(second.selectionId, selection.selectionId);
    assert.equal(second.unitPrice, 89);
    await page.evaluate(() => window.bridge.teardownResource({}));
    await expect.poll(() => page.evaluate(() => window.contexts.at(-1))).toEqual({ structuredContent: {} });
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await client.close();
  }
});
