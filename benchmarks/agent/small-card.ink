<script def>
{"tool":"benchmark_card","description":"Deterministic small card and server computation","schema":{"data":{"type":"object","properties":{"value":{"type":"integer","minimum":0}},"required":["value"],"additionalProperties":false},"output":{"type":"object","properties":{"value":{"type":"integer"}},"required":["value"],"additionalProperties":false}}}
</script>
<script setup>
import { state, next } from './shared.js';
export default {
  data: { sequence: 0, odd: false, value: 7 },
  onLoad(query) { this.setData({ value: Number(query.value) }); state(this, 'small-card', { value: this.data.value }); },
  advance() { const value = this.data.value + 1; next(this, 'small-card', { value }, { value }); },
};
</script>
<page><view class="screen">
  <view class="marker"><view ink:if="{{odd}}" class="light" /></view>
  <text class="heading">SMALL CARD</text>
  <view class="actions"><button bindtap="advance">ADD ONE</button></view>
  <text class="value">{{value}}</text>
  <text>One input, one count, one rendered update.</text>
</view></page>
<style>@import './shared.css';</style>
