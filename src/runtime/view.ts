import { App, PostMessageTransport } from '@modelcontextprotocol/ext-apps';
import { createInkView, type InkView } from '@yodaos-pkg/ink';

declare const __WASM_GZIP_BASE64__: string;
declare const __INK_FILES__: Record<string, string>;
declare const __APP_CONFIG__: { name: string; version: string; title: string; page: string };
const config = __APP_CONFIG__;

const canvas = document.querySelector<HTMLCanvasElement>('#ink')!;
const app = new App({ name: config.title, version: config.version }, { availableDisplayModes: ['inline', 'fullscreen'] }, { autoResize: false });
let view: InkView | undefined;
let mode: 'inline' | 'fullscreen' = 'inline';
let lastWidth = 0;
let lastHeight = 0;

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
      console.debug('Ink message:', JSON.stringify(message.data));
    },
  });
  view.bindDomEvents({ canvas });
  view.openBundle({ appId: config.name, files: __INK_FILES__, initialPage: config.page, hostOptions: { initialTarget: mode === 'fullscreen' ? '_blank' : '_current' } });
  resize();
  document.body.dataset.ready = 'true';
}

main().catch(error => { console.error('Ink startup failed:', error); });
