<script type="application/json" def>
{
  "application": "catalog",
  "navigationBarTitleText": "Shared catalog",
  "tools": [
    {
      "tool": "search_catalog",
      "description": "Search demo products in a shared catalog UI. To update an already open catalog, use its live catalog_search tool.",
      "schema": {
        "data": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "maxLength": 100
            }
          },
          "required": [
            "query"
          ],
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
                  "sku": {
                    "type": "string"
                  },
                  "name": {
                    "type": "string"
                  },
                  "unitPrice": {
                    "type": "number"
                  },
                  "currency": {
                    "const": "CNY"
                  }
                },
                "required": [
                  "sku",
                  "name",
                  "unitPrice",
                  "currency"
                ],
                "additionalProperties": false
              }
            }
          },
          "required": [
            "candidates"
          ],
          "additionalProperties": false
        }
      }
    },
    {
      "tool": "inspect_catalog_product",
      "description": "Inspect a demo product in the catalog UI. Use live catalog_inspect for an existing App.",
      "schema": {
        "data": {
          "type": "object",
          "properties": {
            "sku": {
              "type": "string",
              "minLength": 1,
              "maxLength": 100
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
            "product": {
              "type": "object",
              "properties": {
                "sku": {
                  "type": "string"
                },
                "name": {
                  "type": "string"
                },
                "unitPrice": {
                  "type": "number"
                },
                "currency": {
                  "const": "CNY"
                }
              },
              "required": [
                "sku",
                "name",
                "unitPrice",
                "currency"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "product"
          ],
          "additionalProperties": false
        }
      }
    },
    {
      "tool": "select_catalog_product",
      "description": "Choose a demo product without buying. Use live catalog_select for an existing App.",
      "schema": {
        "data": {
          "type": "object",
          "properties": {
            "sku": {
              "type": "string",
              "minLength": 1,
              "maxLength": 100
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
            "selected": {
              "type": "object",
              "properties": {
                "sku": {
                  "type": "string"
                },
                "name": {
                  "type": "string"
                },
                "unitPrice": {
                  "type": "number"
                },
                "currency": {
                  "const": "CNY"
                }
              },
              "required": [
                "sku",
                "name",
                "unitPrice",
                "currency"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "selected"
          ],
          "additionalProperties": false
        }
      }
    }
  ]
}
</script>
<script setup>
export default {
 data: { query: '', candidates: [], selectedName: 'None', status: 'Loading catalog' },
 onShow() { getApp().attach(this, 'search'); },
 onHide() { getApp().detach(this); },
 onUnload() { getApp().detach(this); },
 onMessage(event) { getApp().receive(event.data); },
 inspect(event) { getApp().run('inspect_catalog_product', {sku:event.currentTarget.dataset.sku}).catch(error=>this.setData({status:error.message})); },
};
</script>
<page><view class="screen">
 <text>SHARED CATALOG · {{query}}</text>
 <button ink:for="{{candidates}}" ink:key="sku" data-sku="{{item.sku}}" bindtap="inspect">{{item.name}} · CNY {{item.unitPrice}}</button>
 <text>Selected: {{selectedName}}</text><text>{{status}}</text>
</view></page>
<style>.screen { display:flex; flex-direction:column; gap:8px; padding:12px; color:#40ff5e; background-color:#000; } button { color:#40ff5e; background-color:#000; border:1px solid #40ff5e; padding:6px; }</style>
