<script type="application/json" def>
{
  "tool": "open_analytics",
  "navigationBarTitleText": "Signal / Analytics",
  "description": "Explore a deterministic demo analytics dashboard. Switch between week and month to update KPIs and a bar chart. No live financial or customer data.",
  "schema": { "data": { "type": "object", "properties": { "period": { "type": "string", "enum": ["week", "month"] } }, "additionalProperties": false } }
}
</script>
<script setup>
const fixtures = {
  week: { revenue: '24,860', growth: '+18.6%', orders: '386', conversion: '4.8%', bars: [42, 64, 48, 84, 58, 96, 76], labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], range: 'LAST 7 DAYS' },
  month: { revenue: '98,420', growth: '+24.2%', orders: '1,542', conversion: '5.2%', bars: [34, 50, 45, 68, 82, 72, 100], labels: ['01', '05', '10', '15', '20', '25', '30'], range: 'LAST 30 DAYS' },
};
export default {
  data: { period: 'week', bars: [] },
  onLoad(query) { this.change(query.period === 'month' ? 'month' : 'week'); this.postMessage({ type: 'example-ready', example: 'analytics' }); },
  change(period) { const fixture = fixtures[period]; this.setData({ ...fixture, period, bars: fixture.bars.map((height, index) => ({ id: index, height, label: fixture.labels[index] })) }); },
  filter(event) { this.change(event.currentTarget.dataset.period); },
  state: ModelContext.defineAction({ name: 'analytics_state', description: 'Read the selected period and visible demo KPIs.', annotations: { readOnlyHint: true }, execute() { return { period: this.data.period, revenue: this.data.revenue, orders: this.data.orders, conversion: this.data.conversion, demo: true }; } }),
};
</script>
<page>
 <view class="screen"><view class="shell"><view class="top"><text class="brand">SIGNAL / ANALYTICS</text><text class="demo">SAMPLE DATA</text></view>
 <view class="heading"><view class="heading-copy"><text class="title">See the bigger picture.</text><text class="subtitle">A little clarity goes a long way.</text></view><view class="filters"><button class="filter {{period === 'week' ? 'active' : ''}}" data-period="week" bindtap="filter">WEEK</button><button class="filter {{period === 'month' ? 'active' : ''}}" data-period="month" bindtap="filter">MONTH</button></view></view>
 <view class="layout"><view class="hero"><text class="label">REVENUE / USD</text><text class="revenue">{{revenue}}</text><text class="growth">{{growth}} vs. previous period</text><view class="metrics"><view class="metric"><text class="metric-value">{{orders}}</text><text class="label">ORDERS</text></view><view class="metric"><text class="metric-value">{{conversion}}</text><text class="label">CONVERSION</text></view></view></view>
 <view class="chart"><view class="chart-heading"><text class="label">THE MOMENTUM</text><text class="range">{{range}}</text></view><view class="columns"><view class="column" ink:for="{{bars}}" ink:key="id"><view class="bar-track"><view class="bar" style="height:{{item.height}}%"></view></view><text class="axis">{{item.label}}</text></view></view></view></view>
 <view class="footer"><text>GOOD DECISIONS START WITH A CLEAR VIEW.</text><text>DEMO / NOT A LIVE REPORT</text></view></view></view>
</page>
<style>
view, button { box-sizing:border-box; }
button { border:0 solid transparent; }
.screen { width:100%; min-height:100%; display:flex; align-items:center; justify-content:center; padding:12px; background-color:#171426; color:#f3edff; }.shell { width:100%; max-width:1040px; display:flex; flex-direction:column; gap:10px; }.top { display:flex; flex-direction:row; justify-content:space-between; }.brand { font-size:10px; font-weight:700; color:#c0a5ff; }.demo { font-size:9px; color:#8e84ab; }.heading { display:flex; flex-direction:row; justify-content:space-between; align-items:center; gap:10px; }.heading-copy { flex:1; min-width:0; }.title { font-size:19px; font-weight:600; }.subtitle { display:none; }.filters { display:flex; flex-direction:row; padding:3px; border-radius:6px; background-color:#29223e; }.filter { padding:6px 9px; font-size:8px; color:#a59abb; background-color:#29223e; border-radius:4px; }.active { background-color:#c0a5ff; color:#23193a; }
.layout { display:flex; flex-direction:row; gap:16px; }.hero { width:140px; flex-shrink:0; display:flex; flex-direction:column; gap:8px; }.label { font-size:8px; color:#8e84ab; }.revenue { font-size:34px; font-weight:600; }.growth { font-size:9px; color:#c0a5ff; }.metrics { display:flex; flex-direction:row; gap:18px; padding-top:8px; }.metric { display:flex; flex-direction:column; gap:4px; }.metric-value { font-size:16px; }.chart { flex:1; min-width:0; display:flex; flex-direction:column; gap:10px; padding:12px; background-color:#231d35; border-radius:10px; }.chart-heading { display:flex; flex-direction:row; justify-content:space-between; }.range { display:none; font-size:9px; color:#8e84ab; }.columns { display:flex; flex-direction:row; gap:7px; height:98px; }.column { flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; gap:7px; }.bar-track { width:100%; flex:1; display:flex; flex-direction:column; justify-content:flex-end; }.bar { width:100%; background-color:#b298ed; border-radius:3px; }.axis { font-size:8px; color:#8e84ab; }.footer { display:none; }
@media (min-width:600px) {
 .screen { padding:32px; }.shell { gap:28px; }.brand { font-size:12px; }.demo { font-size:10px; }.title { font-size:32px; }.subtitle { display:flex; margin-top:8px; font-size:13px; color:#8e84ab; }.filter { padding:9px 15px; font-size:10px; }.layout { gap:30px; }.hero { width:240px; gap:14px; }.label { font-size:10px; }.revenue { font-size:58px; }.growth { font-size:12px; }.metrics { padding-top:16px; gap:40px; }.metric-value { font-size:24px; }.chart { padding:22px; gap:16px; border-radius:16px; }.range { display:flex; }.columns { height:174px; gap:14px; }.axis { font-size:10px; }.footer { display:flex; flex-direction:row; justify-content:space-between; padding-top:18px; border-top:1px solid #3b3153; }.footer text { font-size:9px; color:#8e84ab; }
}
@media (max-width:380px) { .screen { padding:12px; }.title { font-size:16px; }.hero { width:120px; }.revenue { font-size:30px; }.layout { gap:12px; }.chart { padding:10px; }.columns { gap:5px; } }
</style>
