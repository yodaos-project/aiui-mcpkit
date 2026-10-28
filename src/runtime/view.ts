import { App, PostMessageTransport } from '@modelcontextprotocol/ext-apps';
import { AgentToolBridge } from './tool-bridge.js';
import { createMcpHostProvider } from './host-provider.js';
import { RequestLifecycle, type RequestPolicy } from './lifecycle.js';
import { Inspector, type InspectorOptions, type InspectorTool } from './inspector.js';
import { InteractionRecorder } from './interactions.js';
import { mountInspector, captureBrowserDiagnostics } from './inspector-panel.js';
import { createInkView, type InkView } from '@yodaos-pkg/ink';
import { decodeBundle, type BundleEntry } from './bundle.js';
import { browserWebRegistry, mirrorWebTools, type WebRegistry } from './webmcp.js';
import type { BuildIdentity } from './build-info.js';
import { createRestoration } from 'mcpkit:restoration-adapter';
import { createSnapshotSession, SnapshotError, type SnapshotPayload } from './state.js';

declare const __BUILD_INFO__: BuildIdentity;
declare const __WASM_GZIP_BASE64__: string;
declare const __INK_FILES__: Record<string, BundleEntry>;
declare const __APP_CONFIG__: { name: string; version: string; title: string; page: string; waitForToolInput: boolean; requestPolicy: RequestPolicy; retrySafeTools: string[]; sharedPages: string[]; pages: string[]; restoration: boolean; inspector?: InspectorOptions; tools?: InspectorTool[] };
const config = __APP_CONFIG__;
document.body.dataset.mcpkitBuildId = __BUILD_INFO__.id;
document.body.dataset.mcpkitVersion = __BUILD_INFO__.version;
document.body.dataset.mcpkitBuildState = 'unknown';
const inspector = config.inspector ? new Inspector(config.inspector) : undefined;
const recording = inspector && config.inspector?.recording ? new InteractionRecorder(inspector, config.inspector.recording, {
  viewport: { width: document.documentElement.clientWidth, height: window.innerHeight },
  deviceScaleFactor: window.devicePixelRatio || 1, displayMode: 'inline',
  page: document.body.dataset.page || config.page,
}) : undefined;
// Development-only API; no storage, host publication or production state access.
if (recording) Object.defineProperty(window, '__mcpkitInteractions', { value: { snapshot: () => recording.snapshot(), export: () => recording.export() } });
const stopDiagnostics = inspector ? captureBrowserDiagnostics(inspector) : undefined;
let files: ReturnType<typeof decodeBundle>;

const canvas = document.querySelector<HTMLCanvasElement>('#ink')!;
const app = new App({ name: config.title, version: config.version }, { availableDisplayModes: ['inline', 'fullscreen'], tools: { listChanged: true } }, { autoResize: false });
let view: InkView | undefined;
const hostProvider = createMcpHostProvider(app, inspector);
const liveRequests = new RequestLifecycle(config.requestPolicy);
const domEvents = new AbortController();
let inspectorSequence = 0;
let liveSequence = 0;
async function executeViewTool(name: string, input: Record<string, unknown>, signal?: AbortSignal, requestId?: string): Promise<string> {
  requestId ??= `live-${++liveSequence}`;
  inspector?.record('view-tool.input', { name, input }, requestId);
  const handle = liveRequests.start(async context => {
    const owner = view?.modelContext;
    const tool = (await owner?.getTools())?.find(tool => tool.name === name);
    if (!owner || !tool) throw new Error('Ink App tool is unavailable');
    if (context.signal.aborted) throw new DOMException('Tool invocation cancelled', 'AbortError');
    return owner.executeTool(tool, input, { signal: context.signal });
  }, { signal, requestId, onChange: snapshot => inspector?.record('view-tool.state', snapshot, snapshot.requestId) });
  return handle.result;
}
let snapshotSession: ReturnType<typeof createSnapshotSession> | undefined;
let restoredState: SnapshotPayload | undefined;
let restoreId: string | undefined;
let restoreReady = true;
let restoreAccepted = false;
let restoreTimer: ReturnType<typeof setTimeout> | undefined;
let destroyed = false;
let closing = false;
let restorationAbort: AbortController | undefined;
let pendingStateRestore: Record<string, unknown> | undefined;
let saveSequence = 0;
function stateStatus(status: string, error?: unknown) {
  document.body.dataset.restoration = status;
  const code = error instanceof SnapshotError ? error.code : error ? 'STORAGE_ERROR' : undefined;
  if (code) document.body.dataset.restorationError = code;
  else delete document.body.dataset.restorationError;
  view?.dispatchMessageEvent({ type: 'mcpkit:state-status', restoreId, status, ...(code ? { code } : {}) });
}
function receiveStateMessage(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  if (typeof message.type !== 'string' || !message.type.startsWith('mcpkit:state-')) return false;
  // Never log snapshots or forward them into model context/tool input buffers.
  if (message.type === 'mcpkit:state-connect') {
    if (!destroyed && pendingStateRestore) {
      const restoration = pendingStateRestore; pendingStateRestore = undefined;
      view?.dispatchMessageEvent(restoration);
    }
    return true;
  }
  if (!snapshotSession || message.restoreId !== restoreId || destroyed) return true;
  if (message.type === 'mcpkit:state-ready' && !restoreReady) {
    restoreReady = true; restoreAccepted = true; pendingStateRestore = undefined; clearTimeout(restoreTimer); stateStatus('ready'); deliverToolResult();
  } else if (message.type === 'mcpkit:state-save' && restoreReady && restoreAccepted) {
    const owner = restoreId;
    const sequence = ++saveSequence;
    stateStatus('saving');
    void snapshotSession.save({ page: message.page as string, data: message.data as SnapshotPayload['data'] }).then(() => {
      if (!destroyed && owner === restoreId && sequence === saveSequence) stateStatus('saved');
    }, error => { if (!destroyed && owner === restoreId && sequence === saveSequence) stateStatus('error', error); });
  }
  return true;
}
const browserRegistry = browserWebRegistry(
  (document as Document & { modelContext?: WebRegistry }).modelContext,
  (navigator as Navigator & { modelContext?: Parameters<typeof browserWebRegistry>[1] }).modelContext);
const webTools = mirrorWebTools(browserRegistry,
  async () => (await view?.modelContext?.getTools()) || [],
  async (name, input, signal) => JSON.parse(await executeViewTool(name, input, signal)));
document.body.dataset.webmcp = browserRegistry ? 'available' : 'unavailable';
// View-provided tools execute in the owning live App, independently of headless worker tools.
app.onlisttools = async () => ({
  tools: (await view?.modelContext?.getTools() || []).map(tool => ({
    name: tool.name,
    description: tool.description,
    ...(tool.title ? { title: tool.title } : {}),
    inputSchema: { ...(tool.inputSchema || {}), type: 'object' as const },
    ...(typeof tool.annotations?.readOnlyHint === 'boolean'
      ? { annotations: { readOnlyHint: tool.annotations.readOnlyHint } } : {}),
  })),
});
app.oncalltool = async (params, extra) => {
  if (closing || destroyed) throw new Error('Ink App is closing');
  const text = await executeViewTool(params.name, params.arguments || {}, extra.mcpReq.signal, `view:${typeof extra.mcpReq.id}:${extra.mcpReq.id}`);
  const result = JSON.parse(text);
  return { content: [{ type: 'text', text }],
    ...(result && typeof result === 'object' && !Array.isArray(result) ? { structuredContent: result } : {}),
  };
};

const toolBridge = new AgentToolBridge({
  policy: config.requestPolicy, retrySafeTools: config.retrySafeTools, inspector,
  callTool: (params, context) => app.callServerTool(params, {
    signal: context.signal, onprogress: context.progress,
    // Lifecycle owns the budgets; prevent the SDK default from expiring first.
    timeout: 2_147_483_647,
  }),
  send: state => view?.dispatchMessageEvent(state),
});
const stopPanel = inspector ? mountInspector(inspector, {
  recording,
  policy: config.requestPolicy,
  capabilities: () => app.getHostCapabilities(),
  tools: async () => [
    ...(app.getHostCapabilities()?.serverTools ? config.tools || [] : []),
    ...(await view?.modelContext?.getTools() || []).map(tool => ({ name: tool.name, inputSchema: tool.inputSchema, target: 'view' as const })),
  ],
  call: (tool, input) => {
    const requestId = `inspector-${++inspectorSequence}`;
    if (tool.target === 'server') toolBridge.receive({ type: 'mcpkit:call-tool', requestId, name: tool.name, arguments: input });
    else void executeViewTool(tool.name, input, undefined, requestId).catch(() => {});
    return requestId;
  },
  cancel: requestId => { toolBridge.lifecycle.cancel(requestId); liveRequests.cancel(requestId); },
}) : undefined;
function destroyView() {
  if (destroyed) return;
  destroyed = true;
  clearTimeout(restoreTimer); restorationAbort?.abort();
  domEvents.abort(); viewportObserver.disconnect(); window.removeEventListener('resize', resize);
  webTools.close(); toolBridge.cancelAll('View closed'); liveRequests.cancelAll('View closed'); hostProvider.disconnect();
  view?.render(); view?.destroy();
  stopDiagnostics?.(); stopPanel?.();
  recording?.dispose();
}
window.addEventListener('pagehide', () => { void snapshotSession?.close(); destroyView(); });
app.onteardown = async () => {
  closing = true; webTools.close(); toolBridge.cancelAll('View closed'); liveRequests.cancelAll('View closed');
  try { await snapshotSession?.close(); } finally { destroyView(); }
  return {};
};
app.ontoolcancelled = params => {
  hostProvider.cancelled(params.reason);
  toolBridge.cancelAll(params.reason || 'Host cancelled');
  liveRequests.cancelAll(params.reason || 'Host cancelled');
  document.body.dataset.requestState = 'cancelled';
};
let mode: 'inline' | 'fullscreen' = 'inline';
let lastWidth = 0;
let lastHeight = 0;
let query: Record<string, unknown> | undefined = config.waitForToolInput ? undefined : {};
let openedQuery: string | undefined;
let pendingResult: Parameters<NonNullable<typeof app.ontoolresult>>[0] | undefined;
function deliverToolResult() {
  if (!view || !pendingResult || !restoreReady) return;
  const result = pendingResult; pendingResult = undefined;
  inspector?.record('agent.tool-result', { structuredContent: result.structuredContent, uiOnly: result._meta?.uiOnly,
    state: result.isError ? 'error' : 'ready', request: result._meta?.request },
    (result._meta?.request as { requestId?: string } | undefined)?.requestId ?? null);
  view.dispatchMessageEvent({ type: 'mcpkit:tool-result', structuredContent: result.structuredContent,
    tool: (result._meta?.aiui as { tool?: string } | undefined)?.tool,
    input: (result._meta?.aiui as { query?: Record<string, unknown> } | undefined)?.query,
    uiOnly: result._meta?.uiOnly, error: result._meta?.businessError, isError: result.isError === true, request: result._meta?.request });
}
const initialPage = document.body.dataset.page || config.page;

function openPage() {
  if (!view || query === undefined || document.body.dataset.requestState === 'cancelled') return;
  document.body.dataset.requestState = 'ready';
  const serialized = JSON.stringify(query);
  // An existing shared View owns its App and navigation. New data is delivered
  // through result events; it must never reopen the bundle or cancel live work.
  if (config.sharedPages.includes(initialPage) && openedQuery !== undefined) {
    openedQuery = serialized;
    deliverToolResult(); return;
  }
  if (serialized === openedQuery) { deliverToolResult(); return; }
  toolBridge.cancelAll('Page replaced');
  liveRequests.cancelAll('Page replaced');
  const restored = openedQuery === undefined ? restoredState : undefined;
  clearTimeout(restoreTimer);
  restoreReady = !snapshotSession;
  restoreAccepted = false;
  restoreId = crypto.randomUUID();
  pendingStateRestore = config.restoration ? { type: 'mcpkit:restore-state', restoreId, supported: !!snapshotSession, ...(restored ? { snapshot: restored } : {}) } : undefined;
  if (snapshotSession) restoreTimer = setTimeout(() => {
    restoreReady = true; pendingStateRestore = undefined;
    stateStatus('error', new SnapshotError('RESTORE_NOT_HANDLED', 'App did not acknowledge restoration.')); deliverToolResult();
  }, 5000);
  inspector?.record('agent.open', { page: restored?.page ?? initialPage, query });
  view.openBundle({ appId: config.name, files, initialPage: restored?.page ?? initialPage, query,
    hostOptions: { initialTarget: mode === 'fullscreen' ? '_blank' : '_current' } });
  openedQuery = serialized;
  resize();
  document.body.dataset.ready = 'true';
  deliverToolResult();
}

app.ontoolinputpartial = input => hostProvider.input(input.arguments || {}, true);
app.ontoolinput = (input) => { hostProvider.input(input.arguments || {}); pendingResult = undefined; document.body.dataset.requestState = 'pending'; query = input.arguments ?? {}; openPage(); };
app.ontoolresult = (result) => {
  if (document.body.dataset.requestState === 'cancelled') return;
  const invocation = result._meta?.aiui as { page?: string; query?: Record<string, unknown> } | undefined;
  if (config.sharedPages.includes(initialPage) && invocation?.page !== initialPage) return;
  // Host notifications have no correlation ID: accept only the current launch query.
  if (invocation?.query && query !== undefined && JSON.stringify(invocation.query) !== JSON.stringify(query)) return;
  inspector?.record('host.tool-result', { result: { content: result.content,
    ...(result.structuredContent !== undefined ? { structuredContent: result.structuredContent } : {}),
    ...(result.isError !== undefined ? { isError: result.isError } : {}),
    ...(invocation ? { invocation } : {}),
  } });
  const serverBuild = (result._meta?.mcpkit as { build?: BuildIdentity } | undefined)?.build;
  if (serverBuild) {
    document.body.dataset.mcpkitServerBuildId = serverBuild.id;
    document.body.dataset.mcpkitBuildState = serverBuild.id === __BUILD_INFO__.id ? 'current' : 'mismatch';
  } else {
    delete document.body.dataset.mcpkitServerBuildId;
    document.body.dataset.mcpkitBuildState = 'unknown';
  }
  try { hostProvider.result(result); } catch { console.debug('Ink host result content modality is unavailable'); }
  document.body.dataset.requestState = result.isError ? 'error' : 'ready';
  if (result.structuredContent !== undefined || result._meta?.uiOnly !== undefined || result._meta?.businessError !== undefined) pendingResult = result;
  if (!result.isError && invocation?.page === initialPage && invocation.query) { query = invocation.query; openPage(); }
  else if (view && openedQuery !== undefined) deliverToolResult();
};

function applyMode(actual: string) {
  if (actual !== 'inline' && actual !== 'fullscreen') return;
  mode = actual;
  inspector?.record('view.mode', { mode: actual, initial: openedQuery === undefined });
  document.body.dataset.mode = actual;
  view?.setTarget(actual === 'fullscreen' ? '_blank' : '_current');
  resize();
}

function resize() {
  if (!view) return;
  const box = canvas.getBoundingClientRect();
  // Ink pins the canvas and its parent to the last logical pixel width.
  // Measure the host viewport, otherwise resizing keeps that old width forever.
  const width = Math.max(1, document.documentElement.clientWidth);
  const height = Math.max(1, Math.round(box.height));
  if (width !== lastWidth || height !== lastHeight) {
    view.setViewport(width, height, window.devicePixelRatio || 1);
    lastWidth = width;
    lastHeight = height;
  }
  if (mode === 'inline') app.sendSizeChanged({ height: Math.ceil(document.body.scrollHeight) }).catch(() => {});
}

const viewportObserver = new ResizeObserver(resize);
viewportObserver.observe(canvas);
viewportObserver.observe(document.documentElement);
window.addEventListener('resize', resize);
app.onhostcontextchanged = (context) => {
  hostProvider.contextChanged(context);
  if (context.displayMode) applyMode(context.displayMode);
};

async function wasmBytes(): Promise<Uint8Array> {
  const binary = atob(__WASM_GZIP_BASE64__);
  const gzip = Uint8Array.from(binary, char => char.charCodeAt(0));
  const stream = new Blob([gzip]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

let startupStage: 'host' | 'bundle' | 'wasm' | 'agent' = 'host';
async function main() {
  await app.connect(new PostMessageTransport(window.parent, window.parent));
  if (destroyed) return;
  inspector?.record('host.connected', { capabilities: app.getHostCapabilities() });
  applyMode(app.getHostContext()?.displayMode || 'inline');
  startupStage = 'bundle';
  files = decodeBundle(__INK_FILES__);
  stateStatus('unavailable');
  if (config.restoration) {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    restorationAbort = controller;
    try {
      const binding = await Promise.race([createRestoration({ applicationId: config.name, initialPage, signal: controller.signal }), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new SnapshotError('TIMEOUT', 'Restoration adapter timed out.')); }, 5000);
      })]);
      clearTimeout(timer);
      if (binding && !destroyed) {
        snapshotSession = createSnapshotSession(binding, { applicationId: config.name, pages: config.pages });
        restoredState = await snapshotSession.restore();
        stateStatus(restoredState ? 'restored' : 'empty');
      }
    } catch (error) { controller.abort(); snapshotSession = undefined; stateStatus('rejected', error); }
    finally { clearTimeout(timer); }
  }
  if (destroyed) return;
  startupStage = 'wasm';
  const binary = await wasmBytes();
  if (destroyed) return;
  const box = canvas.getBoundingClientRect();
  view = await createInkView({
    width: Math.max(1, Math.round(box.width)),
    height: Math.max(1, Math.round(box.height)),
    layoutMode: 'bounded',
    canvas,
    wasm: { moduleOrPath: binary },
    onContentSizeChanged: () => resize(),
    onMessage: (message) => {
      if (receiveStateMessage(message.data)) return;
      const data = message.data as Record<string, unknown> | null;
      if (data && data.type === 'mcpkit:inspect') {
        if (data.kind === 'binding' && data.visibility === 'public') window.dispatchEvent(new CustomEvent('mcpkit:binding', { detail: { name: data.name, value: data.value } }));
        if (['binding', 'user-event', 'link'].includes(String(data.kind))) inspector?.record(`agent.${data.kind}`, {
          name: data.name, relatedRequestId: data.relatedRequestId, visibility: data.visibility === 'public' ? 'public' : 'private',
          value: data.visibility === 'public' ? data.value : '[PRIVATE UI STATE OMITTED]',
        }, typeof data.requestId === 'string' ? data.requestId : null);
        return;
      }
      toolBridge.receive(message.data);
      window.dispatchEvent(new CustomEvent('mcpkit:message', { detail: message.data }));
      console.debug('Ink message:', JSON.stringify(message.data));
    },
  });
  if (destroyed) { view.destroy(); return; }
  startupStage = 'agent';
  await view.setAgentProvider(hostProvider);
  if (destroyed) return;
  view.modelContext?.addEventListener('toolchange', () => {
    app.sendToolListChanged().catch(() => {});
    void webTools.sync().catch(() => { document.body.dataset.webmcp = 'error'; });
  });
  view.bindDomEvents({ canvas });
  if (inspector) {
    // Capture-phase click precedes Ink's handler and any synchronous assertions.
    for (const type of ['pointerdown', 'click', 'keydown', 'wheel', 'input', 'paste', 'drop']) canvas.addEventListener(type, event => {
      const box = canvas.getBoundingClientRect();
      inspector.record('agent.user-event', { type, target: 'canvas', ...(type === 'click' ? { x: (event as MouseEvent).clientX - box.left, y: (event as MouseEvent).clientY - box.top } : {}), detail: 'No key, text or private Page state collected' });
    }, { signal: domEvents.signal, capture: true });
    canvas.addEventListener('pointermove', event => {
      if (event.buttons) inspector.record('agent.user-event', { type: 'drag', target: 'canvas' });
    }, { signal: domEvents.signal, capture: true });
    inspector.record('runtime.ready', { page: initialPage });
  }
  openPage();
}

main().catch(error => {
  inspector?.record(`diagnostic.${startupStage}`, { error, action: startupStage === 'host' ? 'Open this resource in an MCP Apps host and check its handshake/capabilities.'
    : startupStage === 'wasm' ? 'Check WASM compilation permissions in host CSP, WebAssembly support, gzip decompression and the packaged Ink version.'
    : 'Check bundled app.json/pages, asset paths, host resource CSP and the Ink runtime version.' });
  console.error('Ink startup failed:', error);
});
