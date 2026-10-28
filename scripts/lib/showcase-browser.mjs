import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';

// Real MCP Apps bridge and compiled Ink/WASM UI; all data stays in this local host.
export async function serveShowcase(id, input = {}, mode = 'inline') {
  const html = await readFile(resolve('dist/examples', id, 'view.html'), 'utf8');
  const harness = (await build({ stdin: { resolveDir: process.cwd(), contents: `
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
const frame = document.querySelector('iframe');
const bridge = new AppBridge(null, { name: 'MCPKit example gallery', version: '1' }, {
  updateModelContext: { structuredContent: {} }, message: { text: {} },
}, { hostContext: { displayMode: ${JSON.stringify(mode)}, availableDisplayModes: ['inline','fullscreen'] } });
window.showcase = { bridge, contexts: [], messages: [], errors: [] };
bridge.onupdatemodelcontext = async params => { window.showcase.contexts.push(params); return {}; };
bridge.onmessage = async params => { window.showcase.messages.push(params); return {}; };
bridge.oninitialized = () => { void bridge.sendToolInput({ arguments: ${JSON.stringify(input)} }); };
bridge.setNotificationHandler('notifications/tools/list_changed', () => {});
await bridge.connect(new PostMessageTransport(frame.contentWindow, frame.contentWindow));
frame.src = '/view.html';
` }, bundle: true, write: false, format: 'esm', platform: 'browser' })).outputFiles[0].text;
  const server = createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.url === '/favicon.ico') { res.writeHead(204).end(); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(req.url === '/view.html' ? html : `<!doctype html><style>html,body{margin:0;width:100%;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style><iframe></iframe><script type="module">${harness}</script>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}

export async function liveState(page, name) {
  return page.evaluate(async name => (await window.showcase.bridge.callTool({ name, arguments: {} })).structuredContent, name);
}

export async function waitForExample(page, name) {
  await page.frameLocator('iframe').locator('body[data-ready="true"]').waitFor({ timeout: 20000 });
  await page.waitForFunction(async name => {
    try { return (await window.showcase.bridge.listTools({})).tools.some(tool => tool.name === name); }
    catch { return false; }
  }, name);
  // Two paints after the live tool exists: no DOM placeholder is accepted as UI.
  await page.frameLocator('iframe').locator('canvas').evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
