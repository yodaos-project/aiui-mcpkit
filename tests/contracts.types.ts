import type { BusinessHandlers } from '../examples/business/.mcpkit/tools.js';
declare const typed: BusinessHandlers;
const context = { requestId: 'test', attempt: 1, signal: new AbortController().signal, progress() {} };
void typed.quote_order({ quantity: 2 }, context);
// @ts-expect-error input quantity is a number
void typed.quote_order({ quantity: '2' }, context);
// @ts-expect-error required quantity cannot be omitted
void typed.quote_order({}, context);
// @ts-expect-error unknown handler names are excluded
void typed.nonexistent;
const invalidOutput: BusinessHandlers = {
  // @ts-expect-error structured quote output is required and total is a number
  quote_order: () => ({ content: [], structuredContent: { quantity: 2, unitPrice: 20, total: 'wrong', currency: 'CNY' } }),
  check_stock: typed.check_stock,
  find_products: typed.find_products,
};
void invalidOutput;

import type { BuildPluginOptions, PublicMetadata, ProtocolInspection } from '@yodaos-pkg/aiui-mcpkit';
const metadataOptions: BuildPluginOptions = {
  source: './agent', name: 'metadata-demo',
  toolMetadata: { open_app: { ui: { resourceUri: 'ui://demo/custom' }, 'example/public': { count: 1 } } },
  resourceMetadata: { ui: { prefersBorder: false } },
  uiCsp: { connectDomains: ['https://api.example.com'], resourceDomains: [] },
  assetLimits: { maxAssetBytes: 1024, maxViewBytes: 20000000 },
  uiResources: [{ uri: 'ui://demo/custom', name: 'Custom', html: '<html></html>' }],
};
void metadataOptions;
// @ts-expect-error metadata must be public JSON, not executable code
const executableMetadata: PublicMetadata = { callback: () => {} };
void executableMetadata;
function checkInspection(result: ProtocolInspection) {
  void result.tools[0].inputSchema;
  void result.resources[0]._meta;
  void result.connection.mcpServers;
  // @ts-expect-error inspection excludes custom HTML bodies
  void result.resources[0].html;
}
void checkInspection;

// @ts-expect-error typed CSP only exposes connection and resource lists
const invalidCsp: BuildPluginOptions["uiCsp"] = { frameDomains: [] };
void invalidCsp;

import { verifyPlugin, type VerifyPluginOptions, type PreviewVerificationResult } from '@yodaos-pkg/aiui-mcpkit';
const preview: VerifyPluginOptions = {
  pluginDir: './dist/my-agent', input: { count: 42 }, displayMode: 'fullscreen',
  viewport: { width: 480, height: 352 }, readyWhen: { message: { type: 'ready', count: 42 } },
  screenshotPath: './screenshots/agent.png', errorGate: 'fail', timeouts: { business: 1000 },
};
const verification: Promise<PreviewVerificationResult> = verifyPlugin(preview);
void verification;
// @ts-expect-error only supported MCPKit display modes are accepted
const invalidMode: VerifyPluginOptions['displayMode'] = 'pip';
void invalidMode;

import { Inspector, type AgentInspectionMessage } from '@yodaos-pkg/aiui-mcpkit';
const developmentOptions: BuildPluginOptions = { source: './agent', name: 'inspect', inspector: { maxEvents: 100, redactKeys: ['customerId'] } };
const inspectionMessage: AgentInspectionMessage = { type: 'mcpkit:inspect', kind: 'binding', name: 'total', requestId: 'quote-1', visibility: 'public', value: 40 };
new Inspector({ maxEvents: 100 }).record('agent.binding', inspectionMessage, 'quote-1');
void developmentOptions;
// @ts-expect-error a retention limit is numeric
const invalidInspector: BuildPluginOptions['inspector'] = { maxEvents: 'unbounded' };
void invalidInspector;

import { createMemorySnapshotStore, createSnapshotSession, type SnapshotScope } from '@yodaos-pkg/aiui-mcpkit/state';
const snapshotScope: SnapshotScope = { userId: 'alice', conversationId: 'chat', applicationId: 'catalog', instanceId: 'card' };
const snapshotStore = createMemorySnapshotStore().bind(snapshotScope);
const snapshotSession = createSnapshotSession({ store: snapshotStore, dataVersion: 1, validate: data => typeof data.draft === 'string' }, { applicationId: 'catalog', pages: ['home'] });
void snapshotSession.save({ page: 'home', data: { draft: 'note' } });
// @ts-expect-error identities cannot be changed on an acquired capability
snapshotStore.scope.userId = 'bob';
// @ts-expect-error store reads accept no caller-selected identity or scope
void snapshotStore.read({ signal: new AbortController().signal, userId: 'bob' });
// @ts-expect-error snapshot values must be JSON data
void snapshotSession.save({ page: 'home', data: { callback: () => {} } });
