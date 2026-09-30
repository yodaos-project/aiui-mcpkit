<script def>
{"navigationBarTitleText":"AIUI MCPKit"}
</script>

<script setup>
import wx from 'wx';

const KEY = 'aiui-mcpkit.counter';

export default {
  data: { count: 0 },
  onLoad() {
    try {
      const saved = wx.getStorageSync(KEY);
      if (Number.isInteger(saved) && saved >= 0) this.setData({ count: saved });
    } catch (_) { /* Storage may be unavailable in a sandbox. */ }
  },
  increment() {
    const count = this.data.count + 1;
    this.setData({ count });
    try { wx.setStorageSync(KEY, count); } catch (_) { /* Keep the live state. */ }
    this.postMessage({ type: 'counter-change', count });
  },
};
</script>

<page>
  <view class="screen">
    <text class="eyebrow">AIUI MCPKIT · INK</text>
    <text class="title">Counter</text>
    <text class="count">{{count}}</text>
    <button class="add" bindtap="increment">+  Add one</button>
    <text class="hint">Rendered by Ink Web / Canvas2D</text>
  </view>
</page>

<style>
.screen { width: 100%; min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; background-color: #f7f8fc; color: #16213a; gap: 10px; }
.eyebrow { font-size: 11px; color: #62708a; }
.title { font-size: 23px; font-weight: 700; }
.count { font-size: 64px; font-weight: 700; color: #2d4bef; }
.add { background-color: #2d4bef; color: #ffffff; border-radius: 12px; padding: 10px 22px; font-size: 16px; }
.hint { font-size: 11px; color: #62708a; }
</style>
