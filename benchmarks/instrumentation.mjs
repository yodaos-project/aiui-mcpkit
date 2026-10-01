// Installed only in benchmark browser contexts, before the generated UI starts.
export function instrument() {
  if (window === window.parent) return;
  const data = window.__benchmark = {
    states: [], ticks: [], paused: false, presentedSequence: -1, firstVerifiedFrameMs: null,
    inputs: [], latencies: [], rafTimes: [], presentations: [], phase: 'startup', wasmMemories: [], errors: [],
  };
  let pending;
  const debug = console.debug;
  console.debug = function (...args) {
    if (args[0] === 'Ink message:' && typeof args[1] === 'string') {
      const value = JSON.parse(args[1]);
      if (value.type === 'benchmark-state') data.states.push(value);
      if (value.type === 'benchmark-tick') data.ticks.push(value.tick);
      if (value.type === 'benchmark-paused') data.paused = true;
    }
    return debug.apply(this, args);
  };
  document.addEventListener('pointerdown', event => {
    if (event.target?.id !== 'ink') return;
    pending = { at: performance.now(), sequence: data.presentedSequence + 1, phase: data.phase };
    data.inputs.push(pending);
  }, true);
  window.addEventListener('error', event => data.errors.push(event.message));
  window.addEventListener('unhandledrejection', event => data.errors.push(String(event.reason)));
  const error = console.error;
  console.error = function (...args) {
    data.errors.push(args.map(String).join(' '));
    return error.apply(this, args);
  };
  let canvasCheckQueued = false, lastSubmissionAt = 0;
  function verifyCanvas(context) {
    canvasCheckQueued = false;
    const now = lastSubmissionAt;
    if (data.phase === 'active') data.presentations.push(now);
    const state = data.states.at(-1);
    if (!state || state.sequence === data.presentedSequence) return;
    const pixel = context.getImageData(Math.round(8 * devicePixelRatio), Math.round(8 * devicePixelRatio), 1, 1).data;
    const on = pixel[1] > 200 && pixel[0] < 100;
    if (on !== (state.sequence % 2 === 1)) return;
    data.presentedSequence = state.sequence;
    if (data.firstVerifiedFrameMs === null) data.firstVerifiedFrameMs = now;
    if (pending && state.sequence === pending.sequence) {
      if (state.sequence === 1) data.firstInteractiveAtMs = now;
      if (pending.phase === 'active') data.latencies.push(now - pending.at);
      pending = undefined;
    }
  }
  // Ink can paint directly through Canvas2D commands or submit a bitmap. Batch
  // all surface mutations in the current JS turn into one observed submission.
  for (const name of ['drawImage', 'putImageData', 'fillRect', 'clearRect', 'fill', 'stroke', 'fillText', 'strokeText']) {
    const original = CanvasRenderingContext2D.prototype[name];
    CanvasRenderingContext2D.prototype[name] = function (...args) {
      const result = original.apply(this, args);
      if (this.canvas.id === 'ink') {
        lastSubmissionAt = performance.now();
        if (!canvasCheckQueued) {
          canvasCheckQueued = true;
          // The SDK drains app messages after rendering. Verify after that drain,
          // but retain the timestamp of the last actual surface mutation.
          queueMicrotask(() => verifyCanvas(this));
        }
      }
      return result;
    };
  }
  function raf(time) {
    if (data.phase === 'active') data.rafTimes.push(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
  for (const name of ['instantiate', 'instantiateStreaming']) {
    const original = WebAssembly[name];
    WebAssembly[name] = async function (...args) {
      const result = await original.apply(this, args);
      const instance = result.instance || result;
      for (const value of Object.values(instance.exports || {})) if (value instanceof WebAssembly.Memory) data.wasmMemories.push(value);
      return result;
    };
  }
}
