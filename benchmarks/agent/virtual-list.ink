<script def>
{"tool":"benchmark_list","description":"Windowed 10000-row list","schema":{"data":{"type":"object","properties":{},"additionalProperties":false}}}
</script>
<script setup>
import { state, next } from './shared.js';
const ROW_HEIGHT = 18;
const WINDOW = 20;
const TOTAL = 10000;
const ITEMS = Array.from({ length: TOTAL }, (_, id) => ({ id, label: 'Row ' + id, value: (id * 37) % 1000 }));
export default {
  data: { sequence: 0, odd: false, first: 0, rows: [], top: 0, bottom: 0, scrollTop: 0 },
  onLoad() { this.windowAt(0); this.publish(); },
  onUnload() { if (this.scrollTimer !== undefined) clearTimeout(this.scrollTimer); },
  windowAt(first) {
    first = Math.max(0, Math.min(TOTAL - WINDOW, first));
    const rows = ITEMS.slice(first, first + WINDOW);
    this.setData({ first, rows, top: first * ROW_HEIGHT, bottom: (TOTAL - first - WINDOW) * ROW_HEIGHT });
  },
  publish() { state(this, 'virtual-list', { first: this.data.first, renderedRows: this.data.rows.length, totalRows: TOTAL }); },
  advance() {
    this.pendingFirst = ((this.data.sequence + 1) * 50) % (TOTAL - WINDOW + 1);
    this.setData({ scrollTop: this.pendingFirst * ROW_HEIGHT });
  },
  scroll(event, ended = false) {
    this.windowAt(Math.floor(event.detail.scrollTop / ROW_HEIGHT));
    // Ink may animate a programmed scroll. Acknowledge only the final window,
    // not an intermediate scroll position with the new input sequence.
    if (this.scrollTimer !== undefined) clearTimeout(this.scrollTimer);
    // The fixture also works on released runtimes without scrollend delivery.
    // A fixed 100ms quiet window is part of this scenario's measured latency.
    if (ended) this.finishScroll(event.detail.scrollTop);
    else this.scrollTimer = setTimeout(() => this.finishScroll(event.detail.scrollTop), 100);
  },
  finishScroll(scrollTop) {
    if (this.pendingFirst !== undefined && Math.abs(scrollTop - this.pendingFirst * ROW_HEIGHT) < ROW_HEIGHT / 2) {
      const first = this.pendingFirst;
      this.pendingFirst = undefined;
      this.windowAt(first);
      next(this, 'virtual-list', {}, { first, renderedRows: WINDOW, totalRows: TOTAL });
    }
  },
  scrollEnd(event) { this.scroll(event, true); },
};
</script>
<page><view class="screen">
  <view class="marker"><view ink:if="{{odd}}" class="light" /></view>
  <text class="heading">WINDOW {{first}} / 10000</text>
  <view class="actions"><button bindtap="advance">NEXT 50 ROWS</button></view>
  <scroll-view scroll-y="true" scroll-top="{{scrollTop}}" bindscroll="scroll" bindscrollend="scrollEnd" class="list">
    <view style="height: {{top}}px;" />
    <view ink:for="{{rows}}" ink:key="id" class="row"><text>{{item.label}} = {{item.value}}</text></view>
    <view style="height: {{bottom}}px;" />
  </scroll-view>
</view></page>
<style>
@import './shared.css';
.list { height: 360px; width: 100%; }
.row { height: 18px; font-size: 12px; }
</style>
