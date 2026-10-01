import { defineBusinessTool } from '@yodaos-pkg/aiui-mcpkit/tools';

type QuoteInput = { quantity: number; coupon?: string };
type QuoteOutput = { quantity: number; unitPrice: number; total: number; currency: 'CNY' };
type StockInput = { sku: string };
type StockOutput = { sku: string; available: number };

export const quoteOrder = defineBusinessTool<QuoteInput, QuoteOutput>()({
  name: 'quote_order', title: 'Order quote', description: 'Calculate a demo order quote without placing an order.',
  page: 'pages/order/index',
  inputSchema: { type: 'object', properties: { quantity: { type: 'integer', minimum: 1, maximum: 100 }, coupon: { type: 'string' } }, required: ['quantity'], additionalProperties: false },
  outputSchema: { type: 'object', properties: { quantity: { type: 'integer' }, unitPrice: { type: 'number' }, total: { type: 'number' }, currency: { const: 'CNY' } }, required: ['quantity', 'unitPrice', 'total', 'currency'], additionalProperties: false },
});
export const checkStock = defineBusinessTool<StockInput, StockOutput>()({
  name: 'check_stock', title: 'Stock', description: 'Check stock for a demo SKU.', page: 'pages/order/index',
  inputSchema: { type: 'object', properties: { sku: { type: 'string' } }, required: ['sku'], additionalProperties: false },
  outputSchema: { type: 'object', properties: { sku: { type: 'string' }, available: { type: 'integer' } }, required: ['sku', 'available'], additionalProperties: false },
});
export const tools = [quoteOrder, checkStock] as const;
