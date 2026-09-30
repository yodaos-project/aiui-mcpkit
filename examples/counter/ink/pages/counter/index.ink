<script type="application/json" def>
{
  "tool": "open_counter",
  "navigationBarTitleText": "Counter",
  "description": "Open an interactive counter. Optionally choose its initial count and display label; without an initial count, restore the saved count.",
  "schema": {
    "data": {
      "type": "object",
      "properties": {
        "initialCount": { "type": "integer", "minimum": 0, "maximum": 1000000, "description": "Starting count; overrides the saved count when provided." },
        "label": { "type": "string", "minLength": 1, "maxLength": 40, "description": "Display label for this counter." }
      },
      "additionalProperties": false
    }
  }
}
</script>

<script setup>
import wx from 'wx';

const KEY = 'aiui-mcpkit.counter';

export default {
  data: { label: 'Counter', count: 0, actions: 0, added: 0, history: [] },
  onLoad(query) {
    try {
      const saved = wx.getStorageSync(KEY);
      if (Number.isInteger(saved) && saved >= 0) this.setData({ count: saved });
    } catch (_) { /* Storage may be unavailable in a sandbox. */ }
    if (query.initialCount !== undefined) {
      const count = Number(query.initialCount);
      if (Number.isInteger(count) && count >= 0 && count <= 1000000) this.setData({ count });
    }
    if (query.label) this.setData({ label: query.label });
    this.postMessage({ type: 'counter-loaded', page: 'counter', count: this.data.count, label: this.data.label });
  },
  updateCount(count, label, added) {
    const actions = this.data.actions + 1;
    const history = [{ id: actions, label, value: count }].concat(this.data.history).slice(0, 3);
    this.setData({ count, actions, added: this.data.added + added, history });
    try { wx.setStorageSync(KEY, count); } catch (_) { /* Keep the live state. */ }
    this.postMessage({ type: 'counter-change', count });
  },
  increment() {
    this.updateCount(this.data.count + 1, 'ADD ONE', 1);
  },
  addTen() {
    this.updateCount(this.data.count + 10, 'ADD TEN', 10);
  },
  reset() {
    this.updateCount(0, 'RESET', 0);
  },
};
</script>

<page>
  <view class="screen">
    <view class="summary">
      <text class="eyebrow">AIUI MCPKIT</text>
      <text class="title">{{label}}</text>
      <text class="count">{{count}}</text>
      <button class="control add" bindtap="increment">+ ADD ONE</button>
    </view>
    <view class="details">
      <view class="section">
        <text class="section-title">THIS SESSION</text>
        <view class="row">
          <text class="label">Actions</text>
          <text class="value">{{actions}}</text>
          <text class="label">Total added</text>
          <text class="value">{{added}}</text>
        </view>
      </view>
      <view class="quick-actions">
        <button class="control secondary" bindtap="addTen">+ ADD TEN</button>
        <button class="control secondary" bindtap="reset">RESET</button>
      </view>
      <view class="section">
        <text class="section-title">RECENT ACTIVITY</text>
        <text ink:if="{{actions === 0}}" class="empty">No actions yet. Add one to begin.</text>
        <view ink:for="{{history}}" ink:key="id" class="activity">
          <text class="label">{{item.label}}</text>
          <text class="value">{{item.value}}</text>
        </view>
      </view>
    </view>
  </view>
</page>

<style>
.screen { width: 100%; min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 16px; background-color: #000000; color: rgba(64,255,94,0.72); }
.summary { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.eyebrow { font-size: 11px; font-weight: 500; color: rgba(64,255,94,0.48); }
.title { font-size: 22px; font-weight: 500; }
.count { font-family: monospace; font-size: 48px; font-weight: 500; color: #40ff5e; }
.control { min-height: 32px; background-color: #000000; color: rgba(64,255,94,0.72); border-width: 1px; border-style: solid; border-color: rgba(64,255,94,0.48); border-radius: 4px; padding: 8px 16px; font-size: 11px; font-weight: 500; }
.details { display: none; width: 100%; max-width: 448px; flex-direction: column; gap: 12px; }
.section { display: flex; flex-direction: column; gap: 8px; border-top-width: 1px; border-top-style: solid; border-top-color: rgba(64,255,94,0.24); padding-top: 12px; }
.section-title { font-size: 11px; font-weight: 500; color: rgba(64,255,94,0.48); }
.row { display: flex; flex-direction: row; align-items: center; gap: 12px; }
.label { font-size: 12px; }
.empty { font-size: 12px; }
.value { font-family: monospace; font-size: 13px; color: #40ff5e; }
.quick-actions { display: flex; flex-direction: row; gap: 8px; }
.secondary { flex: 1; }
.activity { display: flex; flex-direction: row; justify-content: space-between; align-items: center; }
@media (target: _blank) {
  .screen { justify-content: flex-start; gap: 12px; }
  .summary { gap: 4px; }
  .count { font-size: 40px; }
  .details { display: flex; gap: 8px; }
  .section { gap: 4px; padding-top: 8px; }
}
</style>
