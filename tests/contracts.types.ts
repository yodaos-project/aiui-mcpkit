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
