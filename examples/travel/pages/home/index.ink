<script type="application/json" def>
{
  "tool": "open_trip",
  "navigationBarTitleText": "Kyoto, at your pace",
  "description": "Open a two-day Kyoto demo itinerary. Choose a day, save a stop and optionally share that stop with the assistant. Uses curated demo data, not live travel advice.",
  "schema": { "data": { "type": "object", "properties": { "day": { "type": "integer", "enum": [1, 2] } }, "additionalProperties": false } }
}
</script>
<script setup>
const days = {
  1: [{ id: 'canal', time: '09:00', name: 'The quiet canal', detail: 'Philosopher path / 60 min', tag: 'WALK' }, { id: 'tea', time: '11:30', name: 'A pause for matcha', detail: 'Higashiyama / 45 min', tag: 'TASTE' }, { id: 'lanterns', time: '17:00', name: 'Lantern hour', detail: 'Gion lanes / 90 min', tag: 'EXPLORE' }],
  2: [{ id: 'bamboo', time: '08:00', name: 'Into the bamboo', detail: 'Arashiyama / 90 min', tag: 'WALK' }, { id: 'river', time: '12:00', name: 'Lunch by the river', detail: 'Katsura riverside / 60 min', tag: 'TASTE' }, { id: 'garden', time: '15:00', name: 'A garden, slowly', detail: 'North Kyoto / 60 min', tag: 'UNWIND' }],
};
export default {
  data: { day: 1, stops: days[1], selected: '', selectedName: 'Save a little detour.', status: 'Curated demo itinerary', sharing: false },
  onLoad(query) { this.changeDay(Number(query.day) === 2 ? 2 : 1); this.postMessage({ type: 'example-ready', example: 'travel' }); },
  changeDay(day) { this.setData({ day, stops: days[day], selected: '', selectedName: 'Save a little detour.', status: 'Curated demo itinerary' }); },
  pickDay(event) { this.changeDay(Number(event.currentTarget.dataset.day)); },
  saveStop(event) {
    const stop = this.data.stops.find(stop => stop.id === event.currentTarget.dataset.id);
    if (stop) this.setData({ selected: stop.id, selectedName: stop.name, status: 'Stop saved to this trip' });
  },
  state: ModelContext.defineAction({ name: 'trip_state', description: 'Read the day and explicitly saved stop in this open trip.', annotations: { readOnlyHint: true }, execute() { return { day: this.data.day, selected: this.data.selected, selectedName: this.data.selectedName }; } }),
  async share() {
    if (this.data.sharing) return;
    const stop = this.data.stops.find(stop => stop.id === this.data.selected);
    if (!stop) { this.setData({ status: 'Save a stop first' }); return; }
    this.setData({ sharing: true, status: 'Sharing saved stop...' });
    try {
      const value = { city: 'Kyoto', day: this.data.day, stop: stop.name, time: stop.time };
      const agent = getApp().getAgent();
      if (this.context) await this.context.update(value);
      else this.context = await agent.provideContext({ key: 'saved_trip_stop', description: 'A trip stop explicitly saved and shared by the user.', value });
      await agent.conversation.sendMessage({ role: 'user', content: [{ type: 'text', text: 'Help me plan around my saved trip stop. Use the shared stop context; say if it is unavailable.' }] });
      this.setData({ status: 'Saved stop sent to assistant' });
    } catch (error) { this.setData({ status: 'Sharing unavailable in this host' }); }
    finally { this.setData({ sharing: false }); }
  },
  onUnload() { this.context?.dispose(); },
};
</script>
<page>
  <view class="screen"><view class="shell">
    <view class="top"><text class="brand">FIELDNOTES / KYOTO</text><text class="edition">A TWO-DAY ESCAPE</text></view>
    <view class="layout">
      <view class="intro"><text class="kicker">35.0116 N / 135.7681 E</text><text class="title">Take the
slow road.</text><text class="description">Small discoveries. Room to wander.</text><view class="days"><button class="tab {{day === 1 ? 'active' : ''}}" data-day="1" bindtap="pickDay">DAY 01</button><button class="tab {{day === 2 ? 'active' : ''}}" data-day="2" bindtap="pickDay">DAY 02</button></view><text class="big-number">0{{day}}</text></view>
      <view class="itinerary"><button class="stop {{selected === item.id ? 'saved' : ''}}" ink:for="{{stops}}" ink:key="id" data-id="{{item.id}}" bindtap="saveStop"><text class="time">{{item.time}}</text><view class="stop-copy"><text class="stop-name">{{item.name}}</text><text class="detail">{{item.detail}}</text></view><text class="tag">{{selected === item.id ? 'SAVED' : item.tag}}</text></button><view class="bottom"><text class="selection">{{selectedName}}</text><button class="share" bindtap="share">ASK ASSISTANT +</button></view></view>
    </view><text class="status">{{status}}</text>
  </view></view>
</page>
<style>
view, button { box-sizing:border-box; }
button { border:0 solid transparent; }
.screen { width:100%; min-height:100%; padding:12px; background-color:#edf3fb; color:#142d53; display:flex; align-items:center; justify-content:center; }
.shell { width:100%; max-width:1040px; display:flex; flex-direction:column; gap:8px; }
.top { display:flex; flex-direction:row; justify-content:space-between; align-items:center; }
.brand { font-size:10px; font-weight:700; color:#245dd8; }
.edition, .kicker { font-size:9px; color:#647898; }
.layout { display:flex; flex-direction:row; gap:22px; }
.intro { width:134px; flex-shrink:0; display:flex; flex-direction:column; gap:10px; }
.kicker, .description, .big-number { display:none; }
.title { font-size:26px; line-height:1.05; font-weight:600; white-space:pre-line; }
.days { display:flex; flex-direction:row; gap:4px; }
.tab { padding:7px 8px; font-size:9px; color:#647898; background-color:#dfe8f5; border-radius:4px; }
.active { color:#ffffff; background-color:#245dd8; }
.itinerary { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; }
.stop { width:100%; display:flex; flex-direction:row; align-items:center; gap:8px; padding:6px 8px; background-color:#ffffff; border-radius:6px; color:#142d53; border:1px solid #dce6f4; }
.saved { background-color:#d6e4ff; border-color:#245dd8; }
.time { font-size:9px; color:#245dd8; }
.stop-copy { flex:1; display:flex; flex-direction:column; gap:3px; }
.stop-name { font-size:12px; font-weight:600; }
.detail { font-size:9px; color:#647898; }
.tag { display:none; font-size:10px; color:#245dd8; }
.bottom { display:flex; flex-direction:column; gap:5px; }
.selection { display:none; font-size:12px; color:#647898; }
.share { background-color:#245dd8; color:#fff; font-size:9px; padding:8px 10px; border-radius:5px; }
.status { font-size:9px; color:#647898; }
@media (min-width:600px) {
 .screen { padding:32px; }.shell { gap:24px; }.brand { font-size:12px; }.edition { font-size:10px; }.layout { gap:40px; }.intro { width:240px; gap:18px; }.title { font-size:46px; }.kicker, .description, .big-number, .selection { display:flex; }.description { font-size:13px; color:#647898; }.big-number { font-size:70px; font-weight:600; color:#b9cdec; }.tab { padding:10px 16px; font-size:10px; }.itinerary { gap:12px; }.stop { padding:18px 16px; gap:16px; border-radius:10px; }.time { font-size:11px; }.stop-name { font-size:17px; }.detail { font-size:11px; }.tag { display:flex; }.bottom { margin-top:6px; gap:12px; }.share { padding:13px; font-size:11px; }.status { font-size:10px; }
}
@media (max-width:380px) { .screen { padding:12px; }.intro { width:110px; }.title { font-size:20px; }.layout { gap:12px; }.edition { display:none; }.stop { padding:6px 6px; gap:6px; }.stop-name { font-size:11px; } }
</style>
