import { App, PostMessageTransport } from '@modelcontextprotocol/ext-apps';
import { createInkView, type InkView } from '@yodaos-pkg/ink';

declare const __WASM_GZIP_BASE64__: string;
declare const __INK_FILES__: Record<string, string>;

const canvas = document.querySelector<HTMLCanvasElement>('#ink')!;
const status = document.querySelector<HTMLElement>('#status')!;
const expand = document.querySelector<HTMLButtonElement>('#expand')!;
const collapse = document.querySelector<HTMLButtonElement>('#collapse')!;
const app = new App({ name: 'AIUI MCPKit', version: '0.1.0' }, { availableDisplayModes: ['inline', 'fullscreen'] }, { autoResize: false });
let view: InkView | undefined;
let mode: 'inline' | 'fullscreen' = 'inline';
let transitioning = false;
let lastWidth = 0;
let lastHeight = 0;

function applyMode(actual: string) {
  if (actual !== 'inline' && actual !== 'fullscreen') return;
  mode = actual;
  document.body.dataset.mode = actual;
  expand.hidden = actual === 'fullscreen';
  collapse.hidden = actual === 'inline';
  const available = app.getHostContext()?.availableDisplayModes;
  expand.disabled = !available?.includes('fullscreen');
  collapse.disabled = !available?.includes('inline');
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

async function changeMode(requested: 'inline' | 'fullscreen') {
  if (transitioning || requested === mode) return;
  const available = app.getHostContext()?.availableDisplayModes;
  if (!available?.includes(requested)) {
    status.textContent = `${requested} is unavailable in this host`;
    return;
  }
  transitioning = true;
  try {
    const result = await app.requestDisplayMode({ mode: requested });
    applyMode(result.mode);
    status.textContent = result.mode === requested ? `${result.mode} confirmed` : `Host kept ${result.mode}`;
  } catch (error) {
    status.textContent = `Mode request failed: ${String(error)}`;
  } finally {
    transitioning = false;
  }
}

expand.addEventListener('click', () => void changeMode('fullscreen'));
collapse.addEventListener('click', () => void changeMode('inline'));
new ResizeObserver(resize).observe(canvas);
window.addEventListener('resize', resize);
app.onhostcontextchanged = (context) => {
  if (context.displayMode) applyMode(context.displayMode);
  if (context.availableDisplayModes) {
    expand.disabled = !context.availableDisplayModes.includes('fullscreen');
    collapse.disabled = !context.availableDisplayModes.includes('inline');
  }
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
      const data = message.data as { type?: string; count?: number };
      if (data?.type === 'counter-change') status.textContent = `Count ${data.count}`;
    },
  });
  view.bindDomEvents({ canvas });
  view.openBundle({ appId: 'aiui-mcpkit', files: __INK_FILES__, initialPage: 'pages/counter/index' });
  resize();
  status.textContent = 'Ink ready';
  document.body.dataset.ready = 'true';
}

main().catch(error => { status.textContent = `Startup failed: ${String(error)}`; console.error(error); });
