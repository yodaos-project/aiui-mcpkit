<script type="application/json" def>
{
  "tool": "open_focus",
  "navigationBarTitleText": "Focus Studio",
  "description": "Open a local focus timer with start, pause and reset. Optionally set a duration and a task. The timer runs only while this view is open.",
  "schema": { "data": { "type": "object", "properties": { "minutes": { "type": "integer", "minimum": 1, "maximum": 60 }, "task": { "type": "string", "minLength": 1, "maxLength": 50 } }, "additionalProperties": false } }
}
</script>
<script setup>
export default {
  data: { task: 'Make room for your best work.', remaining: 1500, display: '25:00', running: false, complete: false, progress: 0, status: 'Ready when you are' },
  onLoad(query) {
    this.duration = Math.max(1, Math.min(60, Number(query.minutes) || 25)) * 60;
    this.setData({ task: query.task || this.data.task }); this.update(this.duration);
    this.postMessage({ type: 'example-ready', example: 'focus' });
  },
  update(remaining) { this.setData({ remaining, display: String(Math.floor(remaining / 60)).padStart(2, '0') + ':' + String(remaining % 60).padStart(2, '0'), progress: Math.round((1 - remaining / this.duration) * 100) }); },
  toggle() {
    if (this.data.running) { this.stop(); this.setData({ running: false, status: 'Paused. Take a breath.' }); return; }
    if (!this.data.remaining) this.update(this.duration);
    this.deadline = Date.now() + this.data.remaining * 1000;
    this.setData({ running: true, complete: false, status: 'One thing at a time.' });
    this.timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
      this.update(remaining);
      if (!remaining) { this.stop(); this.setData({ running: false, complete: true, status: 'Session complete. Nicely done.' }); }
    }, 250);
  },
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; },
  reset() { this.stop(); this.update(this.duration); this.setData({ running: false, complete: false, status: 'A fresh start' }); },
  state: ModelContext.defineAction({ name: 'focus_state', description: 'Read this open timer, its task and remaining seconds.', annotations: { readOnlyHint: true }, execute() { return { task: this.data.task, remaining: this.data.remaining, running: this.data.running, complete: this.data.complete }; } }),
  onHide() { if (this.data.running) { this.stop(); this.setData({ running: false, status: 'Paused while away' }); } },
  onUnload() { this.stop(); },
};
</script>
<page>
 <view class="screen"><view class="shell"><view class="top"><text class="brand">FOCUS / STUDIO</text><text class="mode">LESS, BUT BETTER</text></view>
 <view class="layout"><view class="intro"><text class="kicker">A LITTLE SPACE TO THINK</text><text class="title">Find your
flow state.</text><text class="task">{{task}}</text><view class="pills"><text class="pill">DEEP WORK</text><text class="session">SESSION 01</text></view></view>
 <view class="timer"><text class="timer-label">{{complete ? 'WELL DONE' : running ? 'IN THE ZONE' : 'YOUR TIME'}}</text><text class="digits">{{display}}</text><view class="track"><view class="fill" style="width:{{progress}}%"></view></view><view class="actions"><button class="primary" bindtap="toggle">{{running ? 'PAUSE' : complete ? 'GO AGAIN' : 'START FOCUS'}}</button><button class="reset" bindtap="reset">RESET</button></view><text class="status">{{status}}</text></view></view>
 <view class="footer"><text>A CALMER WAY TO GET THERE.</text><text>LOCAL TIMER / NO NOTIFICATIONS</text></view></view></view>
</page>
<style>
view, button { box-sizing:border-box; }
button { border:0 solid transparent; }
.screen { width:100%; min-height:100%; display:flex; align-items:center; justify-content:center; padding:12px; background-color:#fff3e9; color:#49291e; }
.shell { width:100%; max-width:1040px; display:flex; flex-direction:column; gap:12px; }
.top { display:flex; flex-direction:row; justify-content:space-between; }.brand { font-size:10px; font-weight:700; color:#bc4d32; }.mode { font-size:9px; color:#a27865; }
.layout { display:flex; flex-direction:row; gap:20px; align-items:center; }.intro { flex:1; display:flex; flex-direction:column; gap:12px; }.kicker, .pills, .footer { display:none; }.title { font-size:30px; line-height:1.05; font-weight:600; white-space:pre-line; }.task { font-size:11px; color:#a27865; line-height:1.4; }
.timer { flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; gap:6px; padding:12px; border-radius:16px; background-color:#f8ddcd; }.timer-label { font-size:9px; color:#a4593f; }.digits { font-family:monospace; font-size:38px; font-weight:600; color:#bc4d32; }.track { width:100%; height:3px; background-color:#e9bcaa; border-radius:2px; }.fill { height:3px; background-color:#bc4d32; }.actions { width:100%; display:flex; flex-direction:row; gap:5px; }button { padding:9px 8px; font-size:9px; border-radius:5px; }.primary { flex:1; background-color:#bc4d32; color:#fff6ed; }.reset { background-color:#f1cdbb; color:#8b4a33; }.status { font-size:9px; color:#8b4a33; }
@media (min-width:600px) {
 .screen { padding:32px; }.shell { gap:32px; }.brand { font-size:12px; }.mode { font-size:10px; }.layout { gap:36px; }.intro { gap:22px; }.title { font-size:48px; }.task { font-size:15px; max-width:280px; }.kicker { display:flex; font-size:10px; color:#a27865; }.pills { display:flex; flex-direction:row; gap:12px; align-items:center; }.pill { font-size:10px; padding:7px 10px; border-radius:20px; background-color:#f8ddcd; color:#bc4d32; }.session { font-size:10px; color:#a27865; }.timer { padding:30px 24px; gap:20px; border-radius:24px; }.timer-label { font-size:11px; }.digits { font-size:76px; }.actions { gap:8px; }button { padding:14px 16px; font-size:11px; }.status { font-size:11px; }.footer { display:flex; flex-direction:row; justify-content:space-between; border-top:1px solid #ebd1bf; padding-top:18px; }.footer text { font-size:9px; color:#a27865; }
}
@media (max-width:380px) { .screen { padding:12px; }.layout { gap:12px; }.title { font-size:26px; }.digits { font-size:34px; }.timer { padding:16px 8px; }.mode { display:none; } }
</style>
