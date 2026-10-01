import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

const harnessJs = (await build({ entryPoints: ['tests/harness.ts'], bundle: true, write: false, platform: 'browser', format: 'iife' })).outputFiles[0].text;

test('real Ink renders bundled binary image and font under declared CSP without external requests', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcpkit-assets-browser-'));
  const client = new Client({ name: 'assets-browser', version: '1' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } } });
  let browser, server;
  try {
    const result = await buildPlugin({ source: resolve('tests/fixtures/assets'), name: 'assets-browser', outputDir: root });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [result.files.server] }));
    const resource = (await client.readResource({ uri: 'ui://assets-browser/app.html' })).contents[0];
    assert.deepEqual(resource._meta, result.inspectProtocol().resources[0]._meta);
    assert.deepEqual(resource._meta.ui.csp, { connectDomains: [], resourceDomains: ['blob:'] });
    assert.equal(resource.text, await readFile(result.files.view, 'utf8'));
    const domains = resource._meta.ui.csp;
    server = createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (req.url.startsWith('/view')) {
        res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; connect-src ${domains.connectDomains.join(' ') || "'none'"}; img-src data: ${domains.resourceDomains.join(' ')}; font-src ${domains.resourceDomains.join(' ')}`);
        res.end(resource.text);
      } else res.end(`<html><body><iframe style="width:420px;height:280px;border:0"></iframe><script type="module">${harnessJs}</script></body></html>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : await access('/usr/bin/chromium').then(() => ({ executablePath: '/usr/bin/chromium' }), () => ({}))), headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const errors = [], external = [], violations = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith(base) && !request.url().startsWith('blob:') && !request.url().startsWith('data:')) external.push(request.url()); });
    await page.exposeFunction('recordCspViolation', event => violations.push(event));
    await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => window.recordCspViolation({ directive: event.violatedDirective, blockedURI: event.blockedURI, sourceFile: event.sourceFile, lineNumber: event.lineNumber, columnNumber: event.columnNumber })));
    await page.goto(base);
    try { await page.frameLocator('iframe').locator('body[data-ready="true"]').waitFor({ timeout: 20000 }); }
    catch (error) { console.error('Asset startup:', errors, violations); throw error; }
    // Confirm the actual registered font loaded, not a fallback with the same text.
    await page.waitForFunction(() => [...document.querySelector('iframe').contentDocument.fonts].some(font => font.family === 'MCPKitFixture' && font.status === 'loaded'));
    // White image renders green; the fixture's A is a solid rectangle, unlike fallback A.
    await page.waitForFunction(() => {
      const canvas = document.querySelector('iframe').contentDocument.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      const count = (x, y, w, h) => {
        const data = ctx.getImageData(x, y, w, h).data;
        let lit = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i + 1] > 100) lit++;
        return lit;
      };
      return count(0, 0, 80, 80) > 5000 && count(0, 80, 160, 60) > 3000;
    });
    assert.deepEqual(errors, []);
    // ext-apps includes its own bundled validator which probes eval and catches
    // the denial. Keep unsafe-eval disabled; no asset/network denial is allowed.
    assert.ok(violations.every(event => event.directive === 'script-src' && event.blockedURI === 'eval'), JSON.stringify(violations));
    assert.deepEqual(external, []);
  } finally {
    await browser?.close(); await client.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
