import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

const schema = {
  type: 'object', properties: {
    city: { type: 'string', minLength: 1, description: 'City to display', default: 'Beijing' },
    days: { type: 'integer', minimum: 1, maximum: 7, default: 1 },
    units: { type: 'string', enum: ['C', 'F'] },
    options: { type: 'object', properties: { detailed: { type: 'boolean' } }, required: ['detailed'], additionalProperties: false },
    tags: { type: 'array', items: { type: 'string' } },
  }, required: ['city'], additionalProperties: false,
};
function ink(route, definition) {
  return `<script type="application/json" def>${JSON.stringify(definition)}</script>
<script setup>export default { data: { city: '' }, onLoad(query) { this.setData({ city: query.city }); this.postMessage({ type: 'loaded', route: '${route}', query }); } };</script>
<page><text style="color:#40ff5e">${route}: {{city}}</text></page>`;
}

test('page schemas expose separate MCP tools and launch the corresponding real Ink page with arguments', async () => {
  const project = await mkdtemp(join(tmpdir(), 'mcpkit-pages-'));
  const source = join(project, 'agent');
  const output = join(project, 'plugin');
  const client = new Client({ name: 'pages-test', version: '1' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } } });
  let browser, http;
  try {
    await mkdir(join(source, 'pages'), { recursive: true });
    await writeFile(join(source, 'app.json'), JSON.stringify({ name: 'Cards', pages: ['pages/weather', 'pages/air', 'pages/internal'] }));
    await writeFile(join(source, 'pages/weather.ink'), ink('weather', { tool: 'show_weather', navigationBarTitleText: 'Weather', description: 'Show city weather', schema: { data: schema } }));
    await writeFile(join(source, 'pages/air.ink'), ink('air', { description: 'Show air quality', schema: { data: schema } }));
    await writeFile(join(source, 'pages/internal.ink'), '<page><text>Internal navigation only</text></page>');
    const result = await buildPlugin({ source, name: 'cards', outputDir: output });
    assert.deepEqual(result.tools.map(tool => [tool.name, tool.page]), [['show_weather', 'pages/weather'], ['open_pages_air', 'pages/air']]);
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [result.files.server] }));
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name), ['show_weather', 'open_pages_air']);
    assert.deepEqual(tools[0].inputSchema, schema);
    assert.equal(tools[0].description, 'Show city weather');
    assert.notEqual(tools[0]._meta.ui.resourceUri, tools[1]._meta.ui.resourceUri);
    const optional = await client.callTool({ name: 'show_weather', arguments: { city: 'Paris' } });
    assert.equal(optional.isError, undefined);
    assert.deepEqual(optional._meta.aiui.query, { city: 'Paris' });
    for (const args of [{}, { city: 3 }, { city: 'Paris', days: 8 }, { city: 'Paris', units: 'K' }, { city: 'Paris', options: { detailed: 'yes' } }, { city: 'Paris', tags: [1] }, { city: 'Paris', unknown: true }]) {
      const response = await client.callTool({ name: 'show_weather', arguments: args });
      assert.equal(response.isError, true, JSON.stringify(args));
    }
    const args = { city: '上海 & "Paris"', days: 3, units: 'C', options: { detailed: true }, tags: ['a', 'b'] };
    const views = [];
    for (const tool of tools) {
      const response = await client.callTool({ name: tool.name, arguments: args });
      assert.equal(response.isError, undefined);
      assert.deepEqual(response._meta.aiui.query, args);
      assert.equal(response._meta.aiui.page, result.tools.find(item => item.name === tool.name).page);
      views.push((await client.readResource({ uri: tool._meta.ui.resourceUri })).contents[0].text);
    }
    const harness = (await build({ entryPoints: ['tests/harness.ts'], bundle: true, write: false, platform: 'browser', format: 'iife' })).outputFiles[0].text;
    http = createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (req.url.startsWith('/view')) res.end(views[Number(new URL(req.url, 'http://localhost').searchParams.get('page')) || 0]);
      else res.end(`<html><body><iframe style="width:420px;height:280px;border:0"></iframe><script>${harness}</script></body></html>`);
    });
    await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : await access('/usr/bin/chromium').then(() => ({ executablePath: '/usr/bin/chromium' }), () => ({}))), headless: true });
    for (const [index, route] of ['weather', 'air'].entries()) {
      const page = await browser.newPage();
      const loaded = [];
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.text().startsWith('Ink message: ')) loaded.push(JSON.parse(message.text().slice('Ink message: '.length))); });
      await page.goto(`http://127.0.0.1:${http.address().port}/?page=${index}&args=${encodeURIComponent(JSON.stringify(args))}&delay=${index ? 1000 : 0}`);
      await page.frameLocator('iframe').locator('body[data-ready="true"]').waitFor({ timeout: 15000 });
      // Ink's launch-query contract exposes scalar strings and JSON-encoded structured values.
      assert.deepEqual(loaded, [{ type: 'loaded', route, query: { ...args, days: '3', options: JSON.stringify(args.options), tags: JSON.stringify(args.tags) } }]);
      assert.deepEqual(errors, []);
      await page.close();
    }
    // Configuration errors fail before writing artifacts.
    await writeFile(join(source, 'pages/air.ink'), ink('air', { tool: 'show_weather', description: 'Air', schema: { data: schema } }));
    await assert.rejects(buildPlugin({ source, name: 'cards', outputDir: join(project, 'invalid') }), /Duplicate tool name/);
    await assert.rejects(access(join(project, 'invalid')));
    await writeFile(join(source, 'pages/air.ink'), '<script def>{ broken }</script><page />');
    await assert.rejects(buildPlugin({ source, name: 'cards', outputDir: join(project, 'invalid') }), /pages\/air.ink/);
    await writeFile(join(source, 'pages/air.ink'), ink('air', { description: 'Air', schema: { data: { type: 'string' } } }));
    await assert.rejects(buildPlugin({ source, name: 'cards', outputDir: join(project, 'invalid') }), /schema.data must have type/);
  } finally {
    await browser?.close();
    await client.close();
    if (http) await new Promise(resolve => http.close(resolve));
    await rm(project, { recursive: true, force: true });
  }
});
