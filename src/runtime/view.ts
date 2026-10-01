import { App, PostMessageTransport } from '@modelcontextprotocol/ext-apps';
import { AgentToolBridge } from './tool-bridge.js';
import type { RequestPolicy } from './lifecycle.js';
import { createInkView, type InkView } from '@yodaos-pkg/ink';
import { decodeBundle, type BundleEntry } from './bundle.js';

declare const __WASM_GZIP_BASE64__: string;
declare const __INK_FILES__: Record<string, BundleEntry>;
declare const __APP_CONFIG__: { name: string; version: string; title: string; page: string; waitForToolInput: boolean; requestPolicy: RequestPolicy; retrySafeTools: string[] };
const config = __APP_CONFIG__;
const files = decodeBundle(__INK_FILES__);

const canvas = document.querySelector<HTMLCanvasElement>('#ink')!;
const app = new App({ name: config.title, version: config.version }, { availableDisplayModes: ['inline', 'fullscreen'] }, { autoResize: false });
let view: InkView | undefined;
const toolBridge = new AgentToolBridge({
  policy: config.requestPolicy, retrySafeTools: config.retrySafeTools,
  callTool: (params, context) => app.callServerTool(params, {
    signal: context.signal, onprogress: context.progress,
    // Lifecycle owns the budgets; prevent the SDK default from expiring first.
    timeout: 2_147_483_647,
  }),
  send: state => view?.dispatchMessageEvent(state),
});
window.addEventListener('pagehide', () => toolBridge.cancelAll('View closed'));
app.onteardown = () => { toolBridge.cancelAll('View closed'); return {}; };
app.ontoolcancelled = params => {
  toolBridge.cancelAll(params.reason || 'Host cancelled');
  document.body.dataset.requestState = 'cancelled';
};
let mode: 'inline' | 'fullscreen' = 'inline';
let lastWidth = 0;
let lastHeight = 0;
let query: Record<string, unknown> | undefined = config.waitForToolInput ? undefined : {};
let openedQuery: string | undefined;
let pendingResult: Parameters<NonNullable<typeof app.ontoolresult>>[0] | undefined;
function deliverToolResult() {
  if (!view || !pendingResult) return;
  const result = pendingResult; pendingResult = undefined;
  view.dispatchMessageEvent({ type: 'mcpkit:tool-result', structuredContent: result.structuredContent,
    uiOnly: result._meta?.uiOnly, error: result._meta?.businessError, isError: result.isError === true, request: result._meta?.request });
}
const initialPage = document.body.dataset.page || config.page;

function openPage() {
  if (!view || query === undefined || document.body.dataset.requestState === 'cancelled') return;
  document.body.dataset.requestState = 'ready';
  const serialized = JSON.stringify(query);
  if (serialized === openedQuery) { deliverToolResult(); return; }
  toolBridge.cancelAll('Page replaced');
  view.openBundle({ appId: config.name, files, initialPage, query,
    hostOptions: { initialTarget: mode === 'fullscreen' ? '_blank' : '_current' } });
  openedQuery = serialized;
  resize();
  document.body.dataset.ready = 'true';
  deliverToolResult();
}

app.ontoolinput = (input) => { pendingResult = undefined; document.body.dataset.requestState = 'pending'; query = input.arguments ?? {}; openPage(); };
app.ontoolresult = (result) => {
  if (document.body.dataset.requestState === 'cancelled') return;
  const invocation = result._meta?.aiui as { page?: string; query?: Record<string, unknown> } | undefined;
  // Host notifications have no correlation ID: accept only the current launch query.
  if (invocation?.query && query !== undefined && JSON.stringify(invocation.query) !== JSON.stringify(query)) return;
  document.body.dataset.requestState = result.isError ? 'error' : 'ready';
  if (result.structuredContent !== undefined || result._meta?.uiOnly !== undefined || result._meta?.businessError !== undefined) pendingResult = result;
  if (!result.isError && invocation?.page === initialPage && invocation.query) { query = invocation.query; openPage(); }
  else if (view && openedQuery !== undefined) deliverToolResult();
};

function applyMode(actual: string) {
  if (actual !== 'inline' && actual !== 'fullscreen') return;
  mode = actual;
  document.body.dataset.mode = actual;
  view?.setTarget(actual === 'fullscreen' ? '_blank' : '_current');
  resize();
}

function resize() {
  if (!view) return;
  const box = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(box.width));
  const height = Math.max(1, Math.round(box.height));
  if (width !== lastWidth || height !== lastHeight) {
    view.setViewport(width, height, window.devicePixelRatio || 1);
    lastWidth = width;
    lastHeight = height;
  }
  if (mode === 'inline') app.sendSizeChanged({ height: Math.ceil(document.body.scrollHeight) }).catch(() => {});
}

new ResizeObserver(resize).observe(canvas);
window.addEventListener('resize', resize);
app.onhostcontextchanged = (context) => {
  if (context.displayMode) applyMode(context.displayMode);
};

async function wasmBytes(): Promise<Uint8Array> {
  const binary = atob(__WASM_GZIP_BASE64__);
  const gzip = Uint8Array.from(binary, char => char.charCodeAt(0));
  const stream = new Blob([gzip]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function main() {
  await app.connect(new PostMessageTransport(window.parent, window.parent));
  applyMode(app.getHostContext()?.displayMode || 'inline');
  const binary = await wasmBytes();
  const box = canvas.getBoundingClientRect();
  view = await createInkView({
    width: Math.max(1, Math.round(box.width)),
    height: Math.max(1, Math.round(box.height)),
    layoutMode: 'bounded',
    canvas,
    wasm: { moduleOrPath: binary },
    onContentSizeChanged: () => resize(),
    onMessage: (message) => {
      toolBridge.receive(message.data);
      console.debug('Ink message:', JSON.stringify(message.data));
    },
  });
  view.bindDomEvents({ canvas });
  openPage();
}

main().catch(error => { console.error('Ink startup failed:', error); });
