import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';

const params = new URLSearchParams(location.search);
const frame = document.querySelector<HTMLIFrameElement>('iframe')!;
const displayMode = params.get('mode') === 'inline' ? 'inline' : 'fullscreen';
const bridge = new AppBridge(null, { name: 'MCPKit benchmark host', version: '1' }, {}, {
  hostContext: { displayMode, availableDisplayModes: ['inline', 'fullscreen'] },
});
bridge.oninitialized = () => { void bridge.sendToolInput({ arguments: JSON.parse(params.get('input') || '{}') }); };
void (async () => {
  await bridge.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!));
  frame.src = `/view?scenario=${encodeURIComponent(params.get('scenario')!)}`;
})();
