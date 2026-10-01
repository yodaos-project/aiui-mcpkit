import type { BusinessHandlers } from '../examples/business/.mcpkit/tools.js';
import { handlers } from '../examples/business/mcp-server/handlers.js';
const typed: BusinessHandlers = handlers;
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
  check_stock: handlers.check_stock,
};
void invalidOutput;

import type { BuildPluginOptions, PublicMetadata, ProtocolInspection } from '@yodaos-pkg/aiui-mcpkit';
const metadataOptions: BuildPluginOptions = {
  source: './agent', name: 'metadata-demo',
  toolMetadata: { open_app: { ui: { resourceUri: 'ui://demo/custom' }, 'example/public': { count: 1 } } },
  resourceMetadata: { ui: { prefersBorder: false } },
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
