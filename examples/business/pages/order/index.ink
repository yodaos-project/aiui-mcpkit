<script type="application/json" def>
{
  "tool": "quote_order",
  "navigationBarTitleText": "Order quote",
  "description": "Calculate a demo order quote without placing an order.",
  "schema": {
    "data": {
      "type": "object",
      "properties": {
        "quantity": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "coupon": {
          "type": "string"
        }
      },
      "required": [
        "quantity"
      ],
      "additionalProperties": false
    },
    "output": {
      "type": "object",
      "properties": {
        "quantity": {
          "type": "integer"
        },
        "unitPrice": {
          "type": "number"
        },
        "total": {
          "type": "number"
        },
        "currency": {
          "const": "CNY"
        }
      },
      "required": [
        "quantity",
        "unitPrice",
        "total",
        "currency"
      ],
      "additionalProperties": false
    }
  }
}
</script>

<script setup>
export default {
  data: { quantity: 2, state: 'ready', total: '-', remaining: '-', error: '' },
  onLoad(query) { if (query.quantity) this.setData({ quantity: Number(query.quantity) }); },
  quote() {
    this.sequence = (this.sequence || 0) + 1;
    this.requestId = 'quote-' + this.sequence;
    this.postMessage({ type: 'mcpkit:call-tool', requestId: this.requestId, name: 'quote_order', arguments: { quantity: this.data.quantity } });
  },
  cancel() { if (this.requestId) this.postMessage({ type: 'mcpkit:cancel-tool', requestId: this.requestId }); },
  onMessage(event) {
    const result = event.data;
    if (result.type === 'mcpkit:tool-state') {
      if (result.requestId !== this.requestId) return;
      this.setData({ state: result.state, error: result.error ? result.error.message : '' });
      if (result.state !== 'ready') return;
      this.applyResult(result.result);
    } else if (result.type === 'mcpkit:tool-result') {
      if (result.isError) { this.setData({ state: 'error', error: result.error ? result.error.message : 'Tool failed.' }); return; }
      this.applyResult({ structuredContent: result.structuredContent, _meta: { uiOnly: result.uiOnly } });
    }
  },
  applyResult(result) {
    const quote = result.structuredContent;
    if (quote && quote.total !== undefined) this.setData({ total: quote.total, state: 'ready', remaining: result._meta && result._meta.uiOnly ? result._meta.uiOnly.stockRemaining : '-' });
    this.postMessage({ type: 'quote-rendered', quote, uiOnly: result._meta && result._meta.uiOnly });
  }
};
</script>
<page>
  <view class="screen">
    <text class="title">DEMO ORDER QUOTE</text>
    <text>Quantity: {{quantity}} · {{state}}</text>
    <text class="total">CNY {{total}}</text>
    <text>Remaining stock: {{remaining}}</text>
    <view class="actions">
      <button bindtap="quote">CALCULATE</button>
      <button bindtap="cancel">CANCEL</button>
    </view>
    <text ink:if="{{error}}">{{error}}</text>
  </view>
</page>
<style>
.screen { width: 100%; min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 12px; background-color: #000; color: #40ff5e; }
.title { font-size: 18px; }
.total { font-size: 28px; }
.actions { display: flex; flex-direction: row; gap: 12px; }
button { background-color: #000; color: #40ff5e; border-width: 1px; border-color: #40ff5e; padding: 8px; font-size: 11px; }
</style>
