import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { instrumentPreview } from './runtime/preview-instrument.js';
import type { JsonValue } from './runtime/metadata.js';
import { validateInteractionRecord, type InteractionRecord } from './runtime/interactions.js';
import { runReplay, finishReplay, type ReplayVerification } from './replay.js';
export type { ReplayVerification } from './replay.js';

export type PreviewErrorCode = 'INVALID_OPTIONS' | 'BROWSER_UNAVAILABLE' | 'PREVIEW_FAILED' | 'SCREENSHOT_FAILED'
  | 'RUNTIME_ERROR' | 'UNHANDLED_REJECTION' | 'CONSOLE_ERROR'
  | 'REPLAY_FAILED'
  | 'RUNTIME_READY_TIMEOUT' | 'FIRST_FRAME_TIMEOUT' | 'BUSINESS_READY_TIMEOUT';
export interface PreviewDiagnostic { code: PreviewErrorCode; message: string }
export type PreviewCheck = 'passed' | 'failed' | 'skipped';

export interface VerifyPluginOptions {
  /** Replay an exported record with strict mocked server calls and external network blocked. */
  replay?: InteractionRecord;
  /** Directory returned by buildPlugin().outputDir. No server process is started. */
  pluginDir: string;
  /** Optional page route, without .ink; defaults to the built initial page. */
  page?: string;
  /** Launch arguments delivered through the real MCP Apps AppBridge. */
  input?: Record<string, JsonValue>;
  displayMode?: 'inline' | 'fullscreen';
  /** CSS pixels. Inline canvas retains its built height (normally 220px). */
  viewport?: { width: number; height: number };
  deviceScaleFactor?: number;
  /** Recursive partial match of an Agent's this.postMessage() value. Arrays match exactly. */
  readyWhen?: { message: Record<string, JsonValue> };
  /** Per-stage budgets, in milliseconds. Defaults to 15s each. */
  timeouts?: { runtime?: number; firstFrame?: number; business?: number };
  /** Fail on runtime, rejection and console errors by default; collect keeps them as diagnostics. */
  errorGate?: 'fail' | 'collect';
  /** Optional PNG destination, resolved from the caller's working directory. */
  screenshotPath?: string;
  /** Existing Chromium executable; otherwise use Playwright's separately installed browser. */
  executablePath?: string;
}

export interface PreviewVerificationResult {
  replay?: ReplayVerification;
  /** passed requires all three readiness checks and the configured error gate. */
  status: 'passed' | 'failed' | 'incomplete';
  usable: boolean;
  checks: { runtime: PreviewCheck; firstFrame: PreviewCheck; business: PreviewCheck };
  diagnostics: PreviewDiagnostic[];
  viewport: { width: number; height: number };
  displayMode: 'inline' | 'fullscreen';
  deviceScaleFactor: number;
  /** Actual business message that matched readyWhen. */
  readyMessage?: JsonValue;
  screenshot?: { path: string; width: number; height: number };
}

export class PreviewError extends Error {
  constructor(public readonly code: PreviewErrorCode, message: string) { super(message); this.name = 'PreviewError'; }
}

function jsonObject(value: unknown): value is Record<string, JsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const json = (value: unknown): boolean => value === null || typeof value === 'string' || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))
    || (Array.isArray(value) ? value.every(json) : !!value && typeof value === 'object'
      && Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every(json));
  try { return json(value); } catch { return false; }
}

/**
 * Verify a built Agent in a fresh Chromium context and optionally capture its
 * canvas. Operational failures are returned as diagnostics; invalid options
 * throw PreviewError(INVALID_OPTIONS). Does not log, exit or change cwd.
 * Playwright is loaded only when this function is called.
 */
export async function verifyPlugin(options: VerifyPluginOptions): Promise<PreviewVerificationResult> {
  const invalid = (message: string): never => { throw new PreviewError('INVALID_OPTIONS', message); };
  let replay: InteractionRecord | undefined;
  if (options.replay !== undefined) {
    try { validateInteractionRecord(options.replay); replay = structuredClone(options.replay); }
    catch (error) { invalid(error instanceof Error ? error.message : 'Invalid replay record.'); }
    if (options.input !== undefined || options.viewport !== undefined || options.displayMode !== undefined || options.deviceScaleFactor !== undefined || options.page !== undefined) invalid('Replay environment/input comes from the record; edit a copy to inject synthetic data.');
  }
  const viewport = replay?.viewport ?? options.viewport ?? { width: 420, height: 280 };
  const displayMode = replay?.displayMode ?? options.displayMode ?? 'inline';
  const deviceScaleFactor = replay?.deviceScaleFactor ?? options.deviceScaleFactor ?? 1;
  const budgets = {
    runtime: options.timeouts?.runtime ?? 15000,
    firstFrame: options.timeouts?.firstFrame ?? 15000,
    business: options.timeouts?.business ?? 15000,
  };
  if (typeof options.pluginDir !== 'string' || !options.pluginDir) invalid('pluginDir is required.');
  if (!['inline', 'fullscreen'].includes(displayMode)) invalid('displayMode must be inline or fullscreen.');
  if (![viewport.width, viewport.height].every(n => Number.isSafeInteger(n) && n > 0 && n <= 16384)) invalid('Viewport dimensions must be integers from 1 to 16384.');
  if (!Number.isFinite(deviceScaleFactor) || deviceScaleFactor <= 0 || deviceScaleFactor > 4) invalid('deviceScaleFactor must be greater than 0 and at most 4.');
  if (Object.values(budgets).some(n => !Number.isSafeInteger(n) || n <= 0 || n > 2_147_483_647)) invalid('Timeouts must be positive 32-bit integers.');
  if (options.input !== undefined && !jsonObject(options.input)) invalid('input must be a JSON object.');
  if (options.readyWhen !== undefined && (!jsonObject(options.readyWhen.message) || !Object.keys(options.readyWhen.message).length)) invalid('readyWhen.message must be a nonempty JSON object.');
  if (options.errorGate !== undefined && !['fail', 'collect'].includes(options.errorGate)) invalid('errorGate must be fail or collect.');
  if (options.screenshotPath !== undefined && (typeof options.screenshotPath !== 'string' || !options.screenshotPath.endsWith('.png'))) invalid('screenshotPath must end in .png.');
  if (options.page !== undefined && (!options.page || options.page.includes('\\') || options.page.endsWith('.ink') || options.page.split('/').some(part => !part || part === '.' || part === '..'))) invalid('page must be a relative route without .ink.');

  const result: PreviewVerificationResult = {
    status: 'incomplete', usable: false, checks: { runtime: 'skipped', firstFrame: 'skipped', business: 'skipped' },
    diagnostics: [], viewport: { ...viewport }, displayMode, deviceScaleFactor,
  };
  if (replay) result.replay = { status: 'failed', completedSteps: 0, checks: { state: 0, toolRequests: 0, modelContext: 0 } };
  let browser: import('playwright').Browser | undefined;
  let server: ReturnType<typeof createServer> | undefined;
  const add = (code: PreviewErrorCode, error: unknown) => result.diagnostics.push({ code, message: error instanceof Error ? error.message : String(error) });
  try {
    let chromium: typeof import('playwright').chromium;
    try { ({ chromium } = await import('playwright')); }
    catch { throw new PreviewError('BROWSER_UNAVAILABLE', 'Install the optional preview dependency: npm install --save-dev playwright; npx playwright install chromium.'); }
    try { browser = await chromium.launch({ headless: true, executablePath: options.executablePath ?? process.env.CHROMIUM_PATH }); }
    catch (error) { throw new PreviewError('BROWSER_UNAVAILABLE', `Chromium could not start. Run npx playwright install chromium or set executablePath. ${error instanceof Error ? error.message : error}`); }

    let html = await readFile(join(resolve(options.pluginDir), 'view.html'), 'utf8');
    const route = replay?.page ?? options.page;
    if (route) html = html.replace(/(<body\b[^>]*\bdata-page=")[^"]*"/, (_, prefix) => `${prefix}${route.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}"`);
    const script = (await build({
      entryPoints: [fileURLToPath(new URL('./runtime/preview-host.ts', import.meta.url))],
      bundle: true, write: false, platform: 'browser', format: 'esm', target: 'es2022',
      define: { __PREVIEW_MODE__: JSON.stringify(displayMode), __PREVIEW_INPUT__: JSON.stringify(replay ? (replay.steps[0] as { input: unknown }).input : options.input ?? {}), __PREVIEW_REPLAY__: JSON.stringify(replay ?? null) },
    })).outputFiles[0].text;
    server = createServer((req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      if (req.url === '/favicon.ico') { res.writeHead(204).end(); return; }
      if (req.url === '/host.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(script); return; }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (req.url === '/view.html') res.end(html);
      else if (req.url === '/') res.end('<!doctype html><html><head><style>html,body{margin:0;width:100%;height:100%;background:#000}iframe{display:block;border:0;width:100%;height:100%}</style></head><body><iframe></iframe><script type="module" src="/host.js"></script></body></html>');
      else res.writeHead(404).end();
    });
    await new Promise<void>((resolve, reject) => { server!.once('error', reject); server!.listen(0, '127.0.0.1', resolve); });
    const context = await browser.newContext({ viewport, deviceScaleFactor, ...(replay ? { serviceWorkers: 'block' as const } : {}) });
    const origin = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
    if (replay) {
      await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === origin && ['/', '/view.html', '/host.js', '/favicon.ico'].includes(url.pathname) && request.method() === 'GET') return route.continue();
        add('REPLAY_FAILED', 'Replay blocked an external or write network request.');
        return route.abort('blockedbyclient');
      });
      await context.routeWebSocket('**/*', socket => { add('REPLAY_FAILED', 'Replay blocked a WebSocket connection.'); socket.close(); });
    }
    await context.addInitScript(instrumentPreview);
    const page = await context.newPage();
    page.setDefaultTimeout(Math.max(...Object.values(budgets)));
    await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: budgets.runtime });
    const failOnErrors = options.errorGate !== 'collect';
    // Run predicates in the host so startup failures before iframe navigation
    // are also diagnosed, and every wait has an independent bounded budget.
    async function wait(stage: keyof typeof result.checks, timeout: number, code: PreviewErrorCode) {
      try {
        const handle = await page.waitForFunction(({ stage, expectedJson, failOnErrors }) => {
          const host = window.__mcpkitPreview;
          const win = document.querySelector('iframe')?.contentWindow;
          const state = win?.__mcpkitPreview;
          if (failOnErrors && (host.errors.length || state?.errors.length)) return { failed: true };
          if (!win || !state || win.document.body?.dataset.ready !== 'true') return false;
          if (stage === 'runtime') return { passed: true };
          if (stage === 'business') {
            const matches = (actual: unknown, expected: unknown): boolean => {
              if (expected === null || typeof expected !== 'object') return actual === expected;
              if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((value, i) => matches(actual[i], value));
              return !!actual && typeof actual === 'object' && Object.entries(expected).every(([key, value]) => Object.hasOwn(actual, key) && matches((actual as Record<string, unknown>)[key], value));
            };
            const message = state.messages.find(value => matches(value, JSON.parse(expectedJson)));
            return message === undefined ? false : { passed: true, message };
          }
          if (!state.presented || !state.submissions) return false;
          const canvas = win.document.querySelector<HTMLCanvasElement>('#ink');
          if (!canvas || !canvas.width || !canvas.height) return false;
          const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
          // A uniformly blank/background-only surface is insufficient evidence.
          for (let i = 4; i < pixels.length; i += 4) {
            if (Math.abs(pixels[i] - pixels[0]) > 1 || Math.abs(pixels[i + 1] - pixels[1]) > 1 || Math.abs(pixels[i + 2] - pixels[2]) > 1 || pixels[i + 3] !== pixels[3]) return { passed: true };
          }
          return false;
        }, { stage, expectedJson: JSON.stringify(options.readyWhen?.message ?? null), failOnErrors }, { timeout });
        const value = await handle.jsonValue() as { failed?: boolean; message?: JsonValue };
        await handle.dispose();
        result.checks[stage] = value.failed ? 'failed' : 'passed';
        if (value.message !== undefined) result.readyMessage = value.message;
        return !value.failed;
      } catch (error) {
        if (!(error instanceof Error) || error.name !== 'TimeoutError') throw error;
        result.checks[stage] = 'failed';
        add(code, `${stage} readiness did not pass within ${timeout}ms.`);
        return false;
      }
    }
    const runtime = await wait('runtime', budgets.runtime, 'RUNTIME_READY_TIMEOUT');
    if (runtime) {
      const frame = await wait('firstFrame', budgets.firstFrame, 'FIRST_FRAME_TIMEOUT');
      if (frame && replay) {
        try { result.replay = await runReplay(page, replay, budgets.business); }
        catch (error) {
          if (error instanceof Error && error.cause && typeof error.cause === 'object') result.replay = error.cause as ReplayVerification;
          result.checks.business = 'failed'; add('REPLAY_FAILED', error);
        }
      }
      if (frame && options.readyWhen && result.checks.business !== 'failed') await wait('business', budgets.business, 'BUSINESS_READY_TIMEOUT');
    }
    // Drain pending setData/render work after the business message, including a
    // browser paint opportunity. Business authors must signal after async work.
    const frame = page.frames().find(frame => frame.url().endsWith('/view.html'));
    if (frame && result.checks.firstFrame === 'passed') {
      try {
        const settled = await frame.waitForFunction(() => new Promise<boolean>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))), undefined, { timeout: budgets.firstFrame });
        await settled.dispose();
      } catch (error) {
        if (!(error instanceof Error) || error.name !== 'TimeoutError') throw error;
        result.checks.firstFrame = 'failed';
        add('FIRST_FRAME_TIMEOUT', `Final presentation did not complete within ${budgets.firstFrame}ms.`);
      }
    }
    if (options.screenshotPath && !frame) add('SCREENSHOT_FAILED', 'The Agent frame is unavailable.');
    if (options.screenshotPath && frame) {
      try {
        const path = resolve(options.screenshotPath);
        await mkdir(dirname(path), { recursive: true });
        const png = await frame.locator('#ink').screenshot({ path, type: 'png', timeout: budgets.firstFrame });
        result.screenshot = { path, width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
      } catch (error) { add('SCREENSHOT_FAILED', error); }
    }
    if (replay && result.replay && !result.diagnostics.some(d => d.code === 'REPLAY_FAILED') && result.checks.firstFrame === 'passed') {
      try { await finishReplay(page, replay, result.replay); if (result.checks.business !== 'failed') result.checks.business = 'passed'; }
      catch (error) { result.checks.business = 'failed'; add('REPLAY_FAILED', error); }
    }
    result.diagnostics.push(...await page.evaluate(() => [
      ...window.__mcpkitPreview.errors,
      ...(document.querySelector('iframe')?.contentWindow?.__mcpkitPreview?.errors ?? []),
    ]));
    result.status = Object.values(result.checks).includes('failed') || result.diagnostics.some(d => !['RUNTIME_ERROR', 'UNHANDLED_REJECTION', 'CONSOLE_ERROR'].includes(d.code) || failOnErrors)
      ? 'failed' : result.checks.business === 'passed' ? 'passed' : 'incomplete';
    result.usable = result.status === 'passed';
  } catch (error) {
    add(error instanceof PreviewError ? error.code : 'PREVIEW_FAILED', error);
    result.status = 'failed';
  } finally {
    try { await browser?.close(); }
    catch (error) { add('PREVIEW_FAILED', error); result.status = 'failed'; result.usable = false; }
    finally { if (server) await new Promise<void>(resolve => server!.close(() => resolve())); }
  }
  return result;
}
