import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
import { equalInteractionValue, type InteractionRecord } from './interactions.js';

declare const __PREVIEW_INPUT__: Record<string, unknown>;
declare const __PREVIEW_MODE__: 'inline' | 'fullscreen';
declare const __PREVIEW_REPLAY__: InteractionRecord | null;

export interface ReplayHost {
  calls: number;
  contexts: unknown[];
  problems: string[];
  input(value: Record<string, unknown>): Promise<void>;
  result(value: Record<string, unknown>): Promise<void>;
  mode(mode: 'inline' | 'fullscreen'): void;
}
declare global { interface Window { __mcpkitReplayHost: ReplayHost } }

const frame = document.querySelector<HTMLIFrameElement>('iframe')!;
const replay = __PREVIEW_REPLAY__;
const bridge = new AppBridge(null, { name: 'MCPKit preview', version: '1' }, replay ? {
  serverTools: {}, updateModelContext: { text: {}, structuredContent: {} }, message: { text: {} },
} : {}, {
  hostContext: { displayMode: __PREVIEW_MODE__, availableDisplayModes: ['inline', 'fullscreen'] },
});
if (replay) {
  const host: ReplayHost = window.__mcpkitReplayHost = {
    calls: 0, contexts: [], problems: [],
    input: value => bridge.sendToolInput({ arguments: value }),
    result: value => {
      const { invocation, ...result } = value;
      return bridge.sendToolResult({ ...result, ...(invocation ? { _meta: { aiui: invocation } } : {}) } as Parameters<AppBridge['sendToolResult']>[0]);
    },
    mode: displayMode => bridge.setHostContext({ displayMode }),
  };
  bridge.oncalltool = async params => {
    const expected = replay.mocks[host.calls++];
    if (!expected || expected.name !== params.name || !equalInteractionValue(expected.input, params.arguments ?? {})) {
      host.problems.push(`Tool request ${host.calls} did not match its mock.`);
      return { isError: true, content: [{ type: 'text', text: 'REPLAY_UNMOCKED_TOOL: real execution is disabled.' }] };
    }
    return structuredClone(expected.result) as Awaited<ReturnType<NonNullable<AppBridge['oncalltool']>>>;
  };
  bridge.onupdatemodelcontext = async params => { host.contexts.push(structuredClone(params)); return {}; };
  bridge.onmessage = async () => { host.problems.push('Replay blocked a conversation message.'); return { isError: true }; };
}
bridge.oninitialized = () => { void bridge.sendToolInput({ arguments: __PREVIEW_INPUT__ }); };
await bridge.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!));
frame.src = '/view.html';
