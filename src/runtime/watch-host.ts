import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
import type { WatchState } from '../watch.js';

declare const __PREVIEW_INPUT__: Record<string, unknown>;
declare const __PREVIEW_MODE__: 'inline' | 'fullscreen';

let loaded: string | undefined;
let bridge: AppBridge | undefined;
const status = document.querySelector<HTMLPreElement>('#status')!;
const container = document.querySelector<HTMLDivElement>('#preview')!;
async function poll() {
  try {
    const state: WatchState = await (await fetch('/__mcpkit/status', { cache: 'no-store' })).json();
    status.textContent = `Attempt ${state.sequence}: ${state.phase}\nBuild: ${state.build?.id ?? 'none'}\nReload resets App/Page memory and navigation; browser storage remains.\n`
      + state.diagnostics.map(error => `${error.path ?? ''}${error.line ? `:${error.line}:${error.column}` : ''} ${error.message}`).join('\n');
    if (state.build && loaded !== state.build.id) {
      await bridge?.close();
      const frame = document.createElement('iframe');
      container.replaceChildren(frame);
      const current = new AppBridge(null, { name: 'MCPKit watch preview', version: '1' }, {}, {
        hostContext: { displayMode: __PREVIEW_MODE__, availableDisplayModes: ['inline', 'fullscreen'] },
      });
      bridge = current;
      current.oninitialized = () => { void current.sendToolInput({ arguments: __PREVIEW_INPUT__ }); };
      await current.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!));
      frame.src = '/view.html?build=' + state.build.id;
      loaded = state.build.id;
    }
  } catch (error) { status.textContent = `Preview disconnected: ${error instanceof Error ? error.message : error}`; }
  setTimeout(() => { void poll(); }, 250);
}
void poll();
