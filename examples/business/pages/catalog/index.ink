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
 updateDraft(event) { getApp().updateDraft(event.detail.value); },
 inspect(event) { getApp().run('inspect_catalog_product', {sku:event.currentTarget.dataset.sku}).catch(error=>this.setData({status:error.message})); },
};
</script>
<page><view class="screen"><view class="shell">
 <view class="header"><text class="brand">MCPKIT / CATALOG</text><text class="search-note">Search: {{query}}</text></view>
 <view class="workspace">
  <view class="main">
   <text class="search-title">Find your next pick.</text>
   <view class="products">
    <button class="product-card" ink:for="{{candidates}}" ink:key="sku" data-sku="{{item.sku}}" bindtap="inspect">
     <text class="sku">{{item.sku}}</text><text class="product-name">{{item.name}}</text><text class="product-price">CNY {{item.unitPrice}}</text><text class="view-label">VIEW DETAILS</text>
    </button>
   </view>
   <text class="empty" ink:if="{{empty}}">No matches. Try another search.</text>
   <text class="compact-selection">Selected: {{selectedName}}</text>
  </view>
  <view class="selection">
 <text class="eyebrow">YOUR SELECTION</text>
 <text class="selection-name">{{selectedName}}</text>
 <text class="selection-meta" ink:if="{{selectedSku}}">{{selectedSku}} · CNY {{selectedPrice}}</text>
 <text class="selection-help" ink:if="{{!restorationActive}}">Explore at your own pace.</text>
 <view class="draft" ink:if="{{restorationActive}}"><text class="eyebrow">PRIVATE NOTE</text><input class="draft-input" value="{{draft}}" placeholder="Add a note for later" maxLength="1000" bindinput="updateDraft" /><text class="save-status">{{saveStatus}}</text></view>
</view>
 </view>
 <view class="footer"><text>DEMO CATALOG</text><text>No purchase is made.</text></view>
<text class="status" ink:if="{{status}}">{{status}}</text>
</view></view></page>
<style>
view, button, input { box-sizing:border-box; }

.screen { width:100%; min-height:100%; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:12px; color:#40ff5e; background-color:#000; }
.shell { width:100%; max-width:1040px; display:flex; flex-direction:column; gap:12px; }
.header { display:flex; flex-direction:row; justify-content:space-between; align-items:center; }
.brand { font-size:10px; font-weight:600; color:rgba(64,255,94,0.7); }
.search-note { font-size:10px; color:rgba(64,255,94,0.5); }
.workspace { display:flex; flex-direction:row; gap:24px; align-items:stretch; }
.main { flex:1; min-width:0; display:flex; flex-direction:column; gap:10px; }
.eyebrow { font-size:10px; color:rgba(64,255,94,0.5); }
.title { font-size:24px; font-weight:600; line-height:1.15; }
.price { font-size:22px; font-weight:500; }
.sku { font-size:10px; color:rgba(64,255,94,0.5); }
.compact-selection { font-size:11px; color:rgba(64,255,94,0.7); }
.selection { display:none; }
.actions { display:flex; flex-direction:row; gap:8px; }
.control { flex:1; min-height:34px; padding:8px 12px; font-size:11px; border-radius:6px; border:1px solid rgba(64,255,94,0.35); background-color:#000; color:#40ff5e; }
.primary { background-color:#40ff5e; color:#000; border-color:#40ff5e; font-weight:600; }
.footer { display:none; }
.draft { display:flex; flex-direction:column; gap:8px; }
.draft-input { width:100%; height:36px; padding:0; font-size:12px; color:#40ff5e; background-color:#000; }
.save-status { font-size:10px; color:rgba(64,255,94,0.6); }
.status { font-size:11px; color:#40ff5e; }
@media (target: _blank) {
 .screen { padding:40px; }
 .shell { gap:28px; }
 .header { padding-bottom:20px; border-bottom:1px solid rgba(64,255,94,0.22); }
 .brand { font-size:13px; }
 .search-note { font-size:12px; }
 .main { gap:24px; }
 .eyebrow { font-size:12px; }
 .title { font-size:48px; }
 .price { font-size:36px; }
 .sku { font-size:12px; }
 .compact-selection { display:none; }
 .selection { width:240px; flex-shrink:0; display:flex; flex-direction:column; justify-content:center; gap:20px; padding:28px; border:1px solid rgba(64,255,94,0.22); border-radius:16px; background-color:#041108; }
 .selection-name { font-size:24px; font-weight:500; }
 .selection-meta { font-size:12px; color:rgba(64,255,94,0.6); }
 .selection-help { font-size:13px; line-height:1.5; color:rgba(64,255,94,0.6); }
 .actions { gap:12px; }
 .control { min-height:46px; padding:14px 18px; font-size:12px; }
 .footer { display:flex; flex-direction:row; justify-content:space-between; padding-top:20px; border-top:1px solid rgba(64,255,94,0.22); }
 .footer text { font-size:11px; color:rgba(64,255,94,0.45); }
}
@media (target: _blank) and (max-width: 720px) {
 .screen { padding:24px; }
 .shell { gap:20px; }
 .workspace { flex-direction:column; gap:20px; }
 .actions { flex-direction:column; }
 .selection { width:100%; padding:20px; gap:10px; }
 .selection-name { font-size:20px; }
 .title { font-size:34px; }
 .price { font-size:28px; }
}
@media (target: _blank) and (max-height: 600px) {
 .screen { padding:20px; }
 .shell { gap:16px; }
 .header { padding-bottom:12px; }
 .main { gap:12px; }
 .actions { flex-direction:row; }
 .selection { display:none; }
 .compact-selection { display:flex; }
 .footer { padding-top:12px; }
 .title { font-size:30px; }
 .price { font-size:24px; }
 .control { min-height:36px; padding:10px 12px; }
}

.search-title { display:none; }
.products { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.product-card { min-width:0; display:flex; flex-direction:column; align-items:flex-start; padding:12px; gap:6px; border:1px solid rgba(64,255,94,0.3); border-radius:8px; background-color:#000; color:#40ff5e; }
.product-name { font-size:16px; font-weight:500; }
.product-price { font-size:16px; }
.product-card .sku { display:none; }
.view-label { display:none; font-size:9px; color:rgba(64,255,94,0.6); }
.empty { font-size:14px; color:rgba(64,255,94,0.6); }
@media (target: _blank) {
 .product-card .sku { display:flex; }
 .view-label { display:flex; }
 .search-title { display:flex; font-size:36px; font-weight:500; }
 .products { gap:16px; }
 .product-card { min-height:220px; justify-content:center; padding:24px; gap:16px; border-radius:16px; background-color:#041108; }
 .product-name { font-size:24px; }
 .product-price { font-size:28px; }
 .view-label { font-size:10px; }
}
@media (target: _blank) and (max-width: 720px) { .search-title { font-size:28px; } .product-card { min-height:180px; padding:16px; } .product-name { font-size:20px; } }
@media (target: _blank) and (max-height: 600px) { .search-title { display:none; } .product-card { min-height:0; padding:12px; gap:8px; } }
</style>
