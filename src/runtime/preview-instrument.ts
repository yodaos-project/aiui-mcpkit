export interface PreviewBrowserState {
  errors: { code: 'RUNTIME_ERROR' | 'UNHANDLED_REJECTION' | 'CONSOLE_ERROR'; message: string }[];
  messages: unknown[];
  submissions: number;
  presented: boolean;
}

declare global {
  interface Window { __mcpkitPreview: PreviewBrowserState }
}

/** Installed by Playwright only in preview contexts, before any app code. */
export function instrumentPreview() {
  const state = window.__mcpkitPreview = { errors: [], messages: [], submissions: 0, presented: false } as PreviewBrowserState;
  window.addEventListener('error', event => state.errors.push({ code: 'RUNTIME_ERROR', message: event.message }));
  window.addEventListener('unhandledrejection', event => state.errors.push({ code: 'UNHANDLED_REJECTION', message: String(event.reason) }));
  const error = console.error;
  console.error = function (...args) {
    state.errors.push({ code: 'CONSOLE_ERROR', message: args.map(String).join(' ') });
    return error.apply(this, args);
  };
  window.addEventListener('mcpkit:message', event => state.messages.push((event as CustomEvent).detail));
  let queued = false;
  // Observe actual surface submissions; canvas existence and data-ready alone
  // do not prove that Ink has drawn anything. Leave production contexts alone.
  for (const name of ['drawImage', 'putImageData', 'fillRect', 'clearRect', 'fill', 'stroke', 'fillText', 'strokeText'] as const) {
    const original = CanvasRenderingContext2D.prototype[name];
    (CanvasRenderingContext2D.prototype[name] as Function) = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
      const result = (original as Function).apply(this, args);
      if (this.canvas.id === 'ink') {
        state.submissions++;
        if (!queued) {
          queued = true;
          // Two animation callbacks provide a browser paint opportunity after
          // the submission, even when the submission occurred inside a rAF.
          requestAnimationFrame(() => requestAnimationFrame(() => { state.presented = true; queued = false; }));
        }
      }
      return result;
    };
  }
}
