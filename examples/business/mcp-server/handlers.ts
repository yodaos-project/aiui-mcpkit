import { BusinessToolError } from '@yodaos-pkg/aiui-mcpkit/tools';
import type { BusinessHandlers } from '../.mcpkit/tools.js';

// Read credentials/configuration at server runtime; these are never embedded in view.html.
const internalSupplier = process.env.MCPKIT_DEMO_SUPPLIER ?? 'server-only-demo-supplier';

export const handlers: BusinessHandlers = {
  async quote_order(input, { signal, progress }) {
    if (input.coupon && input.coupon !== 'DEMO10') throw new BusinessToolError('INVALID_COUPON', 'Unknown demo coupon.');
    progress({ progress: 0, total: 1, message: 'Calculating quote' });
    // Deliberate latency makes loading/cancellation visible in the example.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 500);
      const abort = () => { clearTimeout(timer); reject(signal.reason); };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
    const unitPrice = input.coupon === 'DEMO10' ? 18 : 20;
    return {
      content: [{ type: 'text', text: `Demo quote: CNY ${input.quantity * unitPrice}. No order was placed.` }],
      structuredContent: { quantity: input.quantity, unitPrice, total: input.quantity * unitPrice, currency: 'CNY' },
      uiOnly: { stockRemaining: 100 - input.quantity, supplier: internalSupplier },
    };
  },
  check_stock(input) {
    if (input.sku !== 'DEMO') throw new BusinessToolError('UNKNOWN_SKU', 'Use demo SKU DEMO.', { knownSku: 'DEMO' });
    return { content: [{ type: 'text', text: '100 demo items available.' }], structuredContent: { sku: input.sku, available: 100 } };
  },
};
