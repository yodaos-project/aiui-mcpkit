<script def>
{"tool":"benchmark_dashboard","description":"Deterministic 10Hz live dashboard","schema":{"data":{"type":"object","properties":{},"additionalProperties":false}}}
</script>
<script setup>
import { state, next } from './shared.js';
export default {
  data: { sequence: 0, odd: false, tick: 0, selected: 0, metrics: [] },
  onLoad() {
    this.update(); state(this, 'live-dashboard', { tick: 0, selected: 0, metrics: 8 });
    this.timer = setInterval(() => { this.setData({ tick: this.data.tick + 1 }); this.update(); }, 100);
  },
  onUnload() { clearInterval(this.timer); },
  update() {
    const tick = this.data.tick;
    this.setData({ metrics: Array.from({ length: 8 }, (_, i) => ({ id: i, label: 'Metric ' + i, value: (tick * 17 + i * 31) % 100, width: 20 + ((tick * 17 + i * 31) % 100) * 4 })) });
    this.postMessage({ type: 'benchmark-tick', tick });
  },
  advance() {
    const selected = (this.data.selected + 1) % 8;
    next(this, 'live-dashboard', { selected }, { selected, tick: this.data.tick, metrics: 8 });
  },
  pause() { clearInterval(this.timer); this.postMessage({ type: 'benchmark-paused', tick: this.data.tick }); },
};
</script>
<page><view class="screen">
  <view class="marker"><view ink:if="{{odd}}" class="light" /></view>
  <text class="heading">LIVE / TICK {{tick}} / SELECTED {{selected}}</text>
  <view class="actions"><button bindtap="advance">SELECT NEXT</button><button bindtap="pause">PAUSE FEED</button></view>
  <view ink:for="{{metrics}}" ink:key="id" class="metric">
    <text>{{item.label}}: {{item.value}}</text><view class="bar" style="width: {{item.width}}px;" />
  </view>
</view></page>
<style>
@import './shared.css';
.metric { height: 44px; font-size: 12px; }
.bar { height: 8px; background-color: #40ff5e; }
</style>
