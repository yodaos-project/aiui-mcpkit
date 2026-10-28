import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';

declare const __PREVIEW_INPUT__: Record<string, unknown>;
declare const __PREVIEW_MODE__: 'inline' | 'fullscreen';

const frame = document.querySelector<HTMLIFrameElement>('iframe')!;
const bridge = new AppBridge(null, { name: 'MCPKit preview', version: '1' }, {}, {
  hostContext: { displayMode: __PREVIEW_MODE__, availableDisplayModes: ['inline', 'fullscreen'] },
});
bridge.oninitialized = () => { void bridge.sendToolInput({ arguments: __PREVIEW_INPUT__ }); };
await bridge.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!));
frame.src = '/view.html';
