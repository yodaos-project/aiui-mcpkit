<script type="application/json" def>
{
  "tool": "open_workshop",
  "navigationBarTitleText": "The Making Room",
  "description": "Open a workshop reservation demo. Choose a session and 1–4 seats, review the price, then confirm locally. No real booking, payment or message is sent.",
  "schema": { "data": { "type": "object", "properties": { "seats": { "type": "integer", "minimum": 1, "maximum": 4 } }, "additionalProperties": false } }
}
</script>
<script setup>
export default {
  data: { seats: 1, session: 'morning', sessionLabel: '10:00 / MORNING', total: 48, stage: 'choose', status: 'Demo only. No payment or reservation.' },
  onLoad(query) { const seats = Number(query.seats); if (Number.isInteger(seats) && seats >= 1 && seats <= 4) this.setData({ seats, total: seats * 48 }); this.postMessage({ type: 'example-ready', example: 'events' }); },
  pickSession(event) { const session = event.currentTarget.dataset.session; this.setData({ session, sessionLabel: session === 'morning' ? '10:00 / MORNING' : '14:00 / AFTERNOON', stage: 'choose', status: 'Demo only. No payment or reservation.' }); },
  fewer() { this.setSeats(this.data.seats - 1); },
  more() { this.setSeats(this.data.seats + 1); },
  setSeats(seats) { if (seats < 1 || seats > 4) { this.setData({ status: 'Choose between 1 and 4 seats' }); return; } this.setData({ seats, total: seats * 48, stage: 'choose', status: 'Demo only. No payment or reservation.' }); },
  next() {
    if (this.data.stage === 'choose') this.setData({ stage: 'review', status: 'Review your session, seats and total.' });
    else if (this.data.stage === 'review') this.setData({ stage: 'confirmed', status: 'Demo reservation saved locally. No booking made.' });
    else this.setData({ stage: 'choose', status: 'Demo only. No payment or reservation.' });
  },
  state: ModelContext.defineAction({ name: 'workshop_state', description: 'Read this local demo reservation and its review stage. This never creates a real booking.', annotations: { readOnlyHint: true }, execute() { return { session: this.data.session, seats: this.data.seats, total: this.data.total, currency: 'USD', stage: this.data.stage, demo: true }; } }),
};
</script>
<page>
 <view class="screen"><view class="shell"><view class="top"><text class="brand">THE MAKING ROOM</text><text class="edition">WORKSHOP SERIES / 04</text></view>
 <view class="layout"><view class="poster"><text class="poster-label">AN AFTERNOON WITH CLAY</text><text class="title">Less scroll.
More soul.</text><view class="art"><view class="vase"><view class="neck"></view><view class="body"></view><view class="foot"></view></view><view class="small-vase"></view></view><text class="poster-bottom">SHAPE SOMETHING THAT IS YOURS.</text></view>
 <view class="booking"><text class="booking-title">{{stage === 'confirmed' ? 'You are on the list.' : stage === 'review' ? 'One last look.' : 'Take a seat.'}}</text><text class="description">Hand-building with clay / 90 min</text><view class="sessions"><button class="slot {{session === 'morning' ? 'selected' : ''}}" data-session="morning" bindtap="pickSession">10:00 AM</button><button class="slot {{session === 'afternoon' ? 'selected' : ''}}" data-session="afternoon" bindtap="pickSession">02:00 PM</button></view><view class="seat-row"><text class="label">SEATS</text><view class="stepper"><button class="step" bindtap="fewer">-</button><text class="quantity">{{seats}}</text><button class="step" bindtap="more">+</button></view><text class="price">USD {{total}}</text></view><text class="review" ink:if="{{stage !== 'choose'}}">{{sessionLabel}} / {{seats}} SEAT(S)</text><button class="primary" bindtap="next">{{stage === 'confirmed' ? 'START AGAIN' : stage === 'review' ? 'CONFIRM DEMO' : 'REVIEW RESERVATION'}}</button><text class="status">{{status}}</text></view></view>
 </view></view>
</page>
<style>
view, button { box-sizing:border-box; }
button { border:0 solid transparent; }
.screen { width:100%; min-height:100%; padding:12px; background-color:#f5f1e8; color:#333b34; display:flex; align-items:center; justify-content:center; }.shell { width:100%; max-width:1040px; display:flex; flex-direction:column; gap:10px; }.top { display:flex; flex-direction:row; justify-content:space-between; }.brand { font-size:10px; font-weight:700; }.edition { font-size:9px; color:#8e9183; }.layout { display:flex; flex-direction:row; gap:20px; align-items:center; }.poster { width:140px; flex-shrink:0; display:flex; flex-direction:column; gap:10px; }.poster-label, .poster-bottom { display:none; }.title { font-size:22px; font-weight:600; line-height:1.05; white-space:pre-line; }.art { height:92px; flex-shrink:0; width:140px; position:relative; background-color:#e8e3d4; border-radius:50px; overflow:hidden; }.vase { position:absolute; left:27px; top:14px; width:54px; height:80px; }.neck { width:26px; height:22px; margin-left:14px; background-color:#bd7958; border-radius:4px; }.body { width:54px; height:52px; background-color:#c98b67; border-radius:22px; }.foot { width:34px; height:6px; margin-left:10px; background-color:#ad6d4c; }.small-vase { position:absolute; left:86px; top:49px; width:30px; height:38px; border-radius:12px; background-color:#9eaa92; }.booking { flex:1; min-width:0; display:flex; flex-direction:column; gap:6px; }.booking-title { font-size:20px; font-weight:600; }.description { display:none; font-size:10px; color:#8e9183; }.sessions { display:flex; flex-direction:row; gap:6px; }.slot { flex:1; padding:9px 4px; background-color:#e8e3d4; color:#73796b; font-size:9px; border:1px solid #d6d2c5; border-radius:5px; }.selected { background-color:#333b34; color:#f5f1e8; border-color:#333b34; }.seat-row { display:flex; flex-direction:row; align-items:center; justify-content:space-between; gap:6px; }.label { font-size:8px; color:#8e9183; }.stepper { display:flex; flex-direction:row; align-items:center; gap:8px; }.step { font-size:13px; padding:4px 9px; background-color:#e8e3d4; color:#333b34; border-radius:4px; }.quantity { font-size:12px; }.price { font-size:16px; font-weight:600; }.primary { width:100%; padding:10px 5px; font-size:9px; background-color:#bd7958; color:#fff7ef; border-radius:5px; }.status { font-size:8px; color:#73796b; line-height:1.3; }.review { font-size:8px; color:#bd7958; }
@media (min-width:600px) {
 .screen { padding:32px; }.shell { gap:26px; }.brand { font-size:12px; }.edition { font-size:10px; }.layout { gap:40px; }.poster { width:280px; gap:16px; }.poster-label { display:flex; font-size:9px; color:#8e9183; }.title { font-size:44px; }.art { width:280px; height:180px; border-radius:90px; }.vase { transform:scale(1.8); transform-origin:top left; left:66px; top:24px; }.small-vase { transform:scale(1.8); transform-origin:top left; left:173px; top:87px; }.poster-bottom { display:flex; font-size:9px; color:#8e9183; }.booking { gap:18px; }.booking-title { font-size:32px; }.description { display:none; font-size:12px; }.slot { padding:14px 10px; font-size:11px; }.label { font-size:10px; }.stepper { gap:14px; }.step { padding:6px 12px; font-size:18px; }.quantity { font-size:16px; }.price { font-size:24px; }.primary { padding:15px; font-size:11px; }.status, .review { font-size:10px; }
}
@media (max-width:380px) { .screen { padding:12px; }.poster { width:110px; }.title { font-size:18px; }.art { width:110px; height:80px; }.vase { transform:scale(0.8); transform-origin:top left; left:24px; top:12px; }.small-vase { transform:scale(0.8); transform-origin:top left; left:70px; top:42px; }.layout { gap:12px; }.edition { display:none; }.booking-title { font-size:18px; }.price { font-size:14px; } }
</style>
