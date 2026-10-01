import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access, mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { build } from 'esbuild';
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

test('real Ink Agent receives isolated states, progress, safe retries and transport cancellation', async () => {
  const project = await mkdtemp(join(tmpdir(), 'mcpkit-bridge-'));
  let browser; let server;
  try {
    const source = join(project, 'agent'); await mkdir(source);
    await writeFile(join(source, 'app.json'), JSON.stringify({ pages: ['home'] }));
    await writeFile(join(source, 'home.ink'), `<script setup>
export default {
  onLoad(query) {
    this.postMessage({ type: 'loaded-phase', phase: query.phase || 'initial' });
    if (query.phase === 'hostcancel' || query.phase === 'teardown') { this.postMessage({ type: 'mcpkit:call-tool', requestId: query.phase, name: query.phase }); return; }
    if (query.phase === 'late') return;
    for (const name of ['fast', 'safe', 'business', 'cancel', 'error']) this.postMessage({ type: 'mcpkit:call-tool', requestId: name, name });
    setTimeout(() => this.postMessage({ type: 'mcpkit:cancel-tool', requestId: 'cancel' }), 100);
  },
  onMessage(event) {
    this.postMessage({ type: 'observed-state', state: event.data });
  }
};
</script><page><text>Lifecycle test</text></page>`);
    const result = await buildPlugin({ source, name: 'bridge-test', outputDir: join(project, 'out'), requestPolicy: { requestTimeoutMs: 400, totalTimeoutMs: 2000, maxRetries: 1 }, retrySafeTools: ['safe'] });
    const html = await readFile(result.files.view, 'utf8');
    const harness = (await build({ stdin: { resolveDir: process.cwd(), contents: `
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
const frame = document.querySelector('iframe');
window.calls = {}; window.aborted = [];
const bridge = new AppBridge(null, { name: 'host', version: '1' }, { serverTools: {} });
bridge.oncalltool = async (params, extra) => {
  const name = params.name; window.calls[name] = (window.calls[name] || 0) + 1;
  extra.mcpReq.signal.addEventListener('abort', () => window.aborted.push(name));
  if (name === 'fast' || (name === 'safe' && window.calls[name] === 2)) return { content: [{ type: 'text', text: name }] };
  if (name === 'error') return { isError: true, content: [{ type: 'text', text: 'business error' }] };
  const token = extra.mcpReq._meta?.progressToken;
  if (token !== undefined) await extra.mcpReq.notify({ method: 'notifications/progress', params: { progressToken: token, progress: 1 } });
  return new Promise(resolve => setTimeout(() => resolve({ content: [{ type: 'text', text: 'late' }] }), 800));
};
window.bridge = bridge;
await bridge.connect(new PostMessageTransport(frame.contentWindow, frame.contentWindow)); frame.src = '/view';
` }, bundle: true, write: false, platform: 'browser', format: 'esm' })).outputFiles[0].text;
    server = createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(req.url === '/view' ? html : `<iframe style="width:420px;height:280px"></iframe><script type="module">${harness}</script>`); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : await access('/usr/bin/chromium').then(() => ({ executablePath: '/usr/bin/chromium' }), () => ({}))), headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage(); const states = []; const errors = []; const phases = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.text().startsWith('Ink message: ')) {
      const data = JSON.parse(message.text().slice('Ink message: '.length)); if (data.type === 'observed-state') states.push(data.state); if (data.type === 'loaded-phase') phases.push(data.phase);
    } });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await expect.poll(() => states.filter(state => state.state !== 'pending').length, { timeout: 15000 }).toBe(5);
    const terminal = Object.fromEntries(states.filter(state => state.state !== 'pending').map(state => [state.requestId, state]));
    assert.equal(terminal.fast.state, 'ready'); assert.equal(terminal.safe.state, 'ready'); assert.equal(terminal.safe.attempt, 2);
    assert.equal(terminal.business.error.code, 'request_timeout'); assert.equal(terminal.cancel.state, 'cancelled'); assert.equal(terminal.error.error.code, 'tool_error');
    assert.ok(states.some(state => state.requestId === 'safe' && state.progress?.progress === 1));
    await expect.poll(() => page.evaluate(() => window.aborted.sort())).toEqual(['business', 'cancel', 'safe']);
    assert.deepEqual(await page.evaluate(() => window.calls), { fast: 1, safe: 2, business: 1, cancel: 1, error: 1 });
    // Wait past the deliberately late responses: no second terminal result may appear.
    await page.waitForTimeout(900);
    assert.equal(states.filter(state => state.state !== 'pending').length, 5);
    await page.evaluate(() => window.bridge.sendToolInput({ arguments: { phase: 'hostcancel' } }));
    await expect.poll(() => page.evaluate(() => window.calls.hostcancel)).toBe(1);
    await page.evaluate(() => window.bridge.sendToolCancelled({ reason: 'User stopped' }));
    await expect.poll(() => states.find(state => state.requestId === 'hostcancel' && state.state === 'cancelled')?.error.message).toBe('User stopped');
    await expect.poll(() => page.evaluate(() => window.aborted.includes('hostcancel'))).toBe(true);
    await page.evaluate(() => window.bridge.sendToolInput({ arguments: { phase: 'late' } }));
    await expect.poll(() => phases.at(-1)).toBe('late');
    await page.evaluate(() => window.bridge.sendToolResult({ content: [], _meta: { aiui: { page: 'home', query: { phase: 'hostcancel' } } } }));
    await page.waitForTimeout(100);
    assert.deepEqual(phases, ['initial', 'hostcancel', 'late']);
    await page.evaluate(() => window.bridge.sendToolInput({ arguments: { phase: 'teardown' } }));
    await expect.poll(() => page.evaluate(() => window.calls.teardown)).toBe(1);
    await page.evaluate(() => window.bridge.teardownResource({}));
    await expect.poll(() => states.find(state => state.requestId === 'teardown' && state.state === 'cancelled')?.error.message).toBe('View closed');
    await expect.poll(() => page.evaluate(() => window.aborted.includes('teardown'))).toBe(true);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close(); await new Promise(resolve => server ? server.close(resolve) : resolve()); await rm(project, { recursive: true, force: true });
  }
});
