<script type="application/json" def>
{
  "tool": "open_countdown",
  "navigationBarTitleText": "Countdown",
  "description": "Open a countdown counter on a separate page, starting from the requested value and decreasing by the chosen step with each click.",
  "schema": {
    "data": {
      "type": "object",
      "properties": {
        "start": { "type": "integer", "minimum": 1, "maximum": 1000000, "description": "Required starting value for the countdown." },
        "step": { "type": "integer", "minimum": 1, "maximum": 1000000, "description": "Amount to subtract on each click; defaults to 1." }
      },
      "required": ["start"],
      "additionalProperties": false
    }
  }
}
</script>

<script setup>
export default {
  data: { count: 0, step: 1 },
  onLoad(query) {
    const start = Number(query.start);
    const step = query.step === undefined ? 1 : Number(query.step);
    this.setData({
      count: Number.isInteger(start) && start > 0 && start <= 1000000 ? start : 0,
      step: Number.isInteger(step) && step > 0 && step <= 1000000 ? step : 1,
    });
    this.postMessage({ type: 'counter-loaded', page: 'countdown', count: this.data.count, step: this.data.step });
  },
  decrement() {
    const count = Math.max(0, this.data.count - this.data.step);
    this.setData({ count });
    this.postMessage({ type: 'counter-change', count });
  },
};
</script>

<page>
  <view class="screen">
    <view class="summary">
      <text class="eyebrow">AIUI MCPKIT</text>
      <text class="title">Countdown</text>
      <text class="count">{{count}}</text>
      <button class="control" bindtap="decrement">- SUBTRACT {{step}}</button>
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
</style>
