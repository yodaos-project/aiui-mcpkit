// Runs in an Ink AgentWorker. Page schemas define the public MCP input/output contracts.
const failure = (code, message, uiMetadata) => ({
  isError: true, businessError: { code, message }, ...(uiMetadata ? { uiMetadata } : {}),
});

export default {
  available: 100,
  quoteOrder: ModelContext.defineAction({
    name: 'quote_order',
    description: 'Calculate a demo order quote without placing an order',
    async execute(input, { signal }) {
      signal.throwIfAborted();
      if (input.coupon && input.coupon !== 'DEMO10') return failure('INVALID_COUPON', 'Unknown demo coupon.');
      // Deliberate latency makes cancellation visible. The Action signal cancels this call.
      await new Promise((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(signal.reason); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 500);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      });
      signal.throwIfAborted();
      const unitPrice = input.coupon === 'DEMO10' ? 18 : 20;
      return {
        content: [{ type: 'text', text: `Demo quote: CNY ${input.quantity * unitPrice}. No order was placed.` }],
        structuredContent: { quantity: input.quantity, unitPrice, total: input.quantity * unitPrice, currency: 'CNY' },
        uiMetadata: { stockRemaining: this.available - input.quantity },
      };
    },
  }),
  checkStock: ModelContext.defineAction({
    name: 'check_stock', description: 'Check stock for a demo SKU',
    execute(input, { signal }) {
      signal.throwIfAborted();
      if (input.sku !== 'DEMO') return failure('UNKNOWN_SKU', 'Use demo SKU DEMO.', { knownSku: 'DEMO' });
      return { content: [{ type: 'text', text: '100 demo items available.' }], structuredContent: { sku: input.sku, available: this.available } };
    },
  }),
  findProducts: ModelContext.defineAction({
    name: 'find_products', description: 'Find demo products for the user to choose',
    execute(input, { signal }) {
      signal.throwIfAborted();
      const products = [
        { sku: 'TRAVEL-MUG', name: 'Travel mug', unitPrice: 89, currency: 'CNY' },
        { sku: 'TRAVEL-BAG', name: 'Travel bag', unitPrice: 249, currency: 'CNY' },
        { sku: 'DESK-LAMP', name: 'Desk lamp', unitPrice: 159, currency: 'CNY' },
      ];
      const query = input.query.trim().toLowerCase();
      const candidates = products.filter(product => `${product.sku} ${product.name}`.toLowerCase().includes(query));
      return {
        content: [{ type: 'text', text: `${candidates.length} demo products found. Choose a product in the app, then ask about your selection. No purchase is made.` }],
        structuredContent: { candidates },
        // Demo display metadata; Worker source is packaged with the app and contains no secrets.
        uiMetadata: { supplier: 'demo-supplier' },
      };
    },
  }),
};
