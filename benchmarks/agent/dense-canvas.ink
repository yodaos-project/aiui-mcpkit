<script def>
{"tool":"benchmark_canvas","description":"512 bars and 512 line segments per input","schema":{"data":{"type":"object","properties":{},"additionalProperties":false}}}
</script>
<script setup>
import wx from 'wx';
import { state, next } from './shared.js';
export default {
  data: { sequence: 0, odd: false },
  onLoad() { this.draw(); state(this, 'dense-canvas', { bars: 512, segments: 512 }); },
  draw() {
    const ctx = wx.createCanvasContext('plot');
    if (!ctx) throw new Error('Benchmark canvas context unavailable');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 600, 360);
    ctx.fillStyle = '#40ff5e';
    for (let i = 0; i < 512; i++) {
      const height = 2 + ((i * 37 + this.data.sequence * 19) % 16);
      ctx.fillRect((i % 32) * 18, Math.floor(i / 32) * 20, 12, height);
    }
    ctx.strokeStyle = '#40ff5e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 340);
    for (let i = 0; i < 512; i++) ctx.lineTo(i * 600 / 512, 326 + ((i * 13 + this.data.sequence * 7) % 32));
    ctx.stroke();
    ctx.flush();
  },
  advance() {
    next(this, 'dense-canvas', {}, { bars: 512, segments: 512 }); this.draw();
  },
};
</script>
<page><view class="screen">
  <view class="marker"><view ink:if="{{odd}}" class="light" /></view>
  <text class="heading">DENSE CANVAS / PHASE {{sequence}}</text>
  <view class="actions"><button bindtap="advance">NEXT PHASE</button></view>
  <canvas id="plot" class="plot" width="600" height="360" />
</view></page>
<style>
@import './shared.css';
.plot { width: 600px; height: 360px; }
</style>
