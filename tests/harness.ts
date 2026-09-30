import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';

const frame = document.querySelector<HTMLIFrameElement>('iframe')!;
const modeParam = new URLSearchParams(location.search).get('mode');
const capabilities = modeParam === 'inline-only' ? ['inline'] : ['inline', 'fullscreen'];
let current: 'inline' | 'fullscreen' = modeParam === 'initial-fullscreen' ? 'fullscreen' : 'inline';
if (current === 'fullscreen') {
  frame.style.width = '480px';
  frame.style.height = '352px';
}
const bridge = new AppBridge(null, { name: 'MCPKit test host', version: '1' }, {}, {
  hostContext: { displayMode: current, availableDisplayModes: capabilities as ('inline' | 'fullscreen')[] },
});
function setMode(mode: 'inline' | 'fullscreen') {
  if (capabilities.includes(mode)) current = mode;
  frame.style.height = current === 'fullscreen' ? '640px' : '280px';
  bridge.setHostContext({ displayMode: current as 'inline' | 'fullscreen', availableDisplayModes: capabilities as ('inline' | 'fullscreen')[] });
}
(window as any).__setMode = setMode;
void (async () => {
  await bridge.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!));
  (window as any).__bridgeReady = true;
  frame.src = '/view.html';
})();
