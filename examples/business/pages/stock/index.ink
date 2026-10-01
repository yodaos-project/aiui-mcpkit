<script type="application/json" def>
{
  "tool": "check_stock",
  "navigationBarTitleText": "Stock",
  "description": "Check stock for a demo SKU.",
  "schema": {
    "data": {
      "type": "object",
      "properties": {
        "sku": {
          "type": "string"
        }
      },
      "required": [
        "sku"
      ],
      "additionalProperties": false
    },
    "output": {
      "type": "object",
      "properties": {
        "sku": {
          "type": "string"
        },
        "available": {
          "type": "integer"
        }
      },
      "required": [
        "sku",
        "available"
      ],
      "additionalProperties": false
    }
  }
}
</script>
<script setup>
export default {
  data: { sku: 'DEMO', available: '-' },
  onLoad(query) { if (query.sku) this.setData({ sku: query.sku }); },
  onMessage(event) {
    const result = event.data;
    if (result.type === 'mcpkit:tool-result' && result.structuredContent) {
      this.setData({ available: result.structuredContent.available });
    }
  }
};
</script>
<page><view class="stock"><text>DEMO STOCK</text><text>{{sku}}: {{available}} available</text></view></page>
<style>.stock { width: 100%; min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #40ff5e; background-color: #000; }</style>
