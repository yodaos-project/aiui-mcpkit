<script type="application/json" def>
{
  "tool": "find_products",
  "navigationBarTitleText": "Choose a product",
  "description": "Find demo products and let the user choose one in the app. The app can publish their selection and ask the model about it. No purchase is made.",
  "schema": {
    "data": {
      "type": "object",
      "properties": { "query": { "type": "string", "maxLength": 100 } },
      "required": ["query"],
      "additionalProperties": false
    },
    "output": {
      "type": "object",
      "properties": {
        "candidates": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "sku": { "type": "string" },
              "name": { "type": "string" },
              "unitPrice": { "type": "number" },
              "currency": { "const": "CNY" }
            },
            "required": ["sku", "name", "unitPrice", "currency"],
            "additionalProperties": false
          }
        }
      },
      "required": ["candidates"],
      "additionalProperties": false
    }
  }
}
</script>
<script setup>
export default {
  data: { candidates: [], selectedSku: '', selectedName: 'None', status: 'Loading products', sending: false, privateNote: 'Gift idea — do not share' },
  onMessage(event) {
    const result = event.data;
    if (result.type !== 'mcpkit:tool-result') return;
    if (result.isError) {
      this.setData({ status: result.error ? result.error.message : 'Product search failed' });
      return;
    }
    if (!result.structuredContent || !Array.isArray(result.structuredContent.candidates)) return;
    this.supplier = result.uiOnly && result.uiOnly.supplier;
    this.setData({ candidates: result.structuredContent.candidates, status: result.structuredContent.candidates.length ? 'Choose a product' : 'No matching products' });
  },
  selectCandidate(event) {
    if (this.data.sending) return;
    const sku = event.currentTarget.dataset.sku;
    const product = this.data.candidates.find(candidate => candidate.sku === sku);
    if (product) this.setData({ selectedSku: product.sku, selectedName: product.name, status: 'Ready to ask' });
  },
  async askAboutSelection() {
    if (this.data.sending) return;
    const product = this.data.candidates.find(candidate => candidate.sku === this.data.selectedSku);
    if (!product) { this.setData({ status: 'Choose a product first' }); return; }
    this.setData({ sending: true, status: 'Sharing selection' });
    try {
      const agent = getApp().getAgent();
      // Publish only this explicit projection. Never send Page data or uiOnly wholesale.
      const value = {
        sku: product.sku, name: product.name, unitPrice: product.unitPrice, currency: product.currency,
        selectionId: 'selection-' + Math.random().toString(36).slice(2, 12),
      };
      if (this.selection) await this.selection.update(value);
      else this.selection = await agent.provideContext({
        key: 'product_selection', description: 'Product explicitly selected by the user. selectionId is the reference for this selection.', value,
      });
      // Keep selected values out of the message so model use of context is observable.
      await agent.conversation.sendMessage({
        role: 'user', content: [{ type: 'text', text: 'Describe the product I selected, including its SKU and price, and quote my selection reference. If my selection is unavailable, say so instead of guessing.' }],
      });
      this.setData({ status: 'Message accepted by host' });
    } catch (error) {
      this.setData({ status: error.name + ': ' + error.message });
    } finally {
      this.setData({ sending: false });
    }
  },
  onUnload() { this.selection?.dispose(); },
};
</script>
<page>
  <view class="screen">
    <text class="title">CHOOSE A PRODUCT</text>
    <view class="candidates">
      <button ink:for="{{candidates}}" ink:key="sku" data-sku="{{item.sku}}" bindtap="selectCandidate">{{item.name}} · CNY {{item.unitPrice}}</button>
    </view>
    <text>Selected: {{selectedName}}</text>
    <text class="private">Private note: {{privateNote}}</text>
    <button class="ask" bindtap="askAboutSelection">ASK ABOUT SELECTION</button>
    <text class="status">{{status}}</text>
  </view>
</page>
<style>
.screen { width: 100%; min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 10px; background-color: #000; color: #40ff5e; }
.title { font-size: 16px; }
.candidates { display: flex; flex-direction: row; gap: 8px; }
button { color: #40ff5e; background-color: #000; border: 1px solid #40ff5e; padding: 8px; font-size: 12px; }
.ask { margin-top: 2px; }
.private, .status { font-size: 11px; }
</style>
