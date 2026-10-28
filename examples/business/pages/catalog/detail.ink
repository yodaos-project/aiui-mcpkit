<script setup>
import wx from 'wx';
export default {
 data: { detailName: '', detailPrice: 0, selectedName: 'None', status: '' },
 onShow() { getApp().attach(this, 'detail'); },
 onHide() { getApp().detach(this); },
 onUnload() { getApp().detach(this); },
 onMessage(event) { getApp().receive(event.data); },
 select() { getApp().run('select_catalog_product', {sku:getApp().catalog.detail.sku}).catch(error=>this.setData({status:error.message})); },
 back() { wx.navigateBack(); },
};
</script>
<page><view class="screen"><text>PRODUCT DETAIL</text><text>{{detailName}} · CNY {{detailPrice}}</text><text>Selected: {{selectedName}}</text><button bindtap="select">SELECT THIS PRODUCT</button><button bindtap="back">BACK TO SEARCH</button><text>{{status}}</text></view></page>
<style>.screen { display:flex; flex-direction:column; gap:8px; padding:12px; color:#40ff5e; background-color:#000; } button { color:#40ff5e; background-color:#000; border:1px solid #40ff5e; padding:6px; }</style>
