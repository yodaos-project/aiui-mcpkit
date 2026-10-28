import { Inspector, redactDiagnostics, type InspectorControls, type InspectorTool } from './inspector.js';

/** Self-contained local panel. No network, storage, clipboard or host publication. */
export function mountInspector(inspector: Inspector, controls: InspectorControls): () => void {
  const host = document.createElement('mcpkit-inspector');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
  :host{position:fixed;right:8px;bottom:8px;z-index:2147483647;color:#e7edf6;font:12px/1.5 system-ui,sans-serif;color-scheme:dark}
  *{box-sizing:border-box}button,input,textarea,select{font:inherit;color:inherit;background:#1b293e;border:1px solid #657590;border-radius:5px;padding:6px}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}
  #toggle{float:right}section{clear:both;width:min(640px,calc(100vw - 16px));max-height:calc(100vh - 50px);overflow:auto;background:#0e1726;border:1px solid #657590;border-radius:8px;padding:12px;box-shadow:0 8px 32px #0008}
  [hidden]{display:none}h2{font-size:16px;margin:0 0 8px}p{color:#b8c7db}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#080f1a;padding:8px;max-height:240px;overflow:auto}textarea{width:100%;min-height:64px}label{display:block;margin:8px 0}select{max-width:100%}.actions{display:flex;gap:6px;flex-wrap:wrap}summary{cursor:pointer;overflow-wrap:anywhere}details{border-top:1px solid #35435a;padding:6px 0}#status{min-height:18px}input{max-width:100%}
  </style><button id="toggle" aria-expanded="false" aria-controls="panel">Inspector</button>
  <section id="panel" hidden aria-label="MCPKit Inspector"><h2>MCPKit Inspector</h2>
  <p>Development diagnostics · retained locally, redacted before display and export.</p>
  <details><summary>Host capabilities and effective policy</summary><pre id="configuration"></pre></details>
  <details><summary>Model context and privacy boundary</summary><p>Only explicit context publications reach the model. Private App/Page state and UI metadata are not collected. “Sent” records the actual adapter payload; acknowledgement does not prove model consumption. Host launch notifications without IDs remain uncorrelated.</p><pre id="context">No context sent.</pre></details>
  <details id="tool-controls" open><summary>Call a tool</summary><label>Tool <select id="tool" aria-label="Tool"></select></label>
  <details><summary>Selected tool input schema</summary><pre id="schema"></pre></details>
  <label>JSON input <textarea id="input" aria-label="JSON input" spellcheck="false">{}</textarea></label>
  <div class="actions"><button id="refresh">Refresh tools</button><button id="call">Call tool</button></div></details>
  <button id="cancel" disabled>Cancel request</button>
  <p id="status" role="status"></p>
  <label>Request ID <input id="filter" aria-label="Request ID" placeholder="All requests"></label>
  <div class="actions"><button id="export">Export redacted JSON</button><button id="clear">Clear trace</button></div>
  <p id="count"></p><div id="events"></div></section>`;
  document.body.append(host);
  const element = <T extends HTMLElement>(id: string) => root.getElementById(id) as T;
  const toggle = element<HTMLButtonElement>('toggle'), panel = element('panel');
  const select = element<HTMLSelectElement>('tool'), input = element<HTMLTextAreaElement>('input');
  const filter = element<HTMLInputElement>('filter'), cancel = element<HTMLButtonElement>('cancel');
  const status = element('status');
  let tools: InspectorTool[] = [], active: string | undefined, disposed = false, scheduled = false;
  const json = (value: unknown) => JSON.stringify(redactDiagnostics(value, inspector.options.redactKeys), null, 2);
  const showSchema = () => { element('schema').textContent = json(tools[select.selectedIndex]?.inputSchema); };
  async function refresh() {
    try {
      const selected = select.value;
      const next = await controls.tools();
      if (disposed) return;
      tools = next;
      select.replaceChildren(...tools.map(tool => {
        const option = document.createElement('option'); option.value = `${tool.target}:${tool.name}`; option.textContent = option.value; return option;
      }));
      if (tools.some(tool => `${tool.target}:${tool.name}` === selected)) select.value = selected;
      element<HTMLButtonElement>('call').disabled = !tools.length;
      showSchema();
    } catch (error) { inspector.record('diagnostic.tools', { error, action: 'Wait for the View to initialize, then refresh tools.' }); }
  }
  function render() {
    const all = inspector.snapshot(), events = all.filter(event => !filter.value || event.requestId === filter.value);
    element('configuration').textContent = json({ capabilities: controls.capabilities(), policy: controls.policy,
      cancellation: 'AbortSignal; cannot undo committed operations', retries: 'Only timeout failures of build-time retrySafeTools' });
    const context = all.filter(event => event.kind === 'model-context.sent' || event.kind === 'model-context.acknowledged' || event.kind === 'model-context.failed');
    element('context').textContent = context.length ? json(context) : 'No context sent.';
    element('count').textContent = `${events.length} events · retaining at most ${inspector.options.maxEvents}`;
    const expanded = new Set(Array.from(element('events').querySelectorAll('details[open]')).map(details => (details as HTMLElement).dataset.sequence));
    element('events').replaceChildren(...events.map(event => {
      const details = document.createElement('details'), summary = document.createElement('summary'), pre = document.createElement('pre');
      details.dataset.sequence = String(event.sequence); details.open = expanded.has(String(event.sequence));
      summary.textContent = `${event.sequence} · ${event.kind} · ${event.requestId ?? 'uncorrelated'}${(event.data as { state?: string })?.state ? ` · ${(event.data as { state: string }).state}` : ''}`;
      pre.textContent = json(event); details.append(summary, pre); return details;
    }));
    const terminal = all.some(event => event.requestId === active && ['ready', 'error', 'cancelled'].includes((event.data as { state?: string })?.state || ''));
    cancel.disabled = !active || terminal;
  }
  const unsubscribe = inspector.subscribe(() => {
    if (scheduled || panel.hidden || disposed) return;
    scheduled = true; queueMicrotask(() => { scheduled = false; if (!disposed) render(); });
  });
  toggle.onclick = () => { panel.hidden = !panel.hidden; toggle.setAttribute('aria-expanded', String(!panel.hidden)); if (!panel.hidden) { render(); void refresh(); } };
  element('refresh').onclick = () => { void refresh(); render(); };
  select.onchange = showSchema;
  element('call').onclick = () => {
    try {
      const value = JSON.parse(input.value);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Input must be a JSON object.');
      const tool = tools[select.selectedIndex]; if (!tool) throw new Error('Select an available tool.');
      active = controls.call(tool, value); filter.value = active;
      status.textContent = `Request ${active}`; render();
    } catch (error) { status.textContent = String(error instanceof Error ? error.message : error); }
  };
  cancel.onclick = () => { if (active) controls.cancel(active); };
  filter.oninput = render;
  element('clear').onclick = () => inspector.clear();
  element('export').onclick = () => {
    const url = URL.createObjectURL(new Blob([inspector.export()], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'mcpkit-inspector.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return () => { disposed = true; unsubscribe(); host.remove(); };
}

/** Install before host/WASM startup so failures remain inspectable. */
export function captureBrowserDiagnostics(inspector: Inspector): () => void {
  const error = (event: Event) => {
    if (event.target && event.target !== window) {
      const target = event.target as HTMLElement & { src?: string; href?: string };
      inspector.record('diagnostic.resource', { tag: target.tagName, url: target.src || target.href,
        action: 'Check the resource URL, host CSP resourceDomains, CORS and network response.' });
    } else {
      const failure = event as ErrorEvent;
      inspector.record('diagnostic.browser', { error: failure.error || failure.message, url: failure.filename, line: failure.lineno,
        action: 'Check the failing script and the runtime/host versions.' });
    }
  };
  const rejection = (event: PromiseRejectionEvent) => inspector.record('diagnostic.promise', { error: event.reason,
    action: 'Check the rejected operation, host capability and request trace.' });
  const csp = (event: SecurityPolicyViolationEvent) => inspector.record('diagnostic.csp', {
    directive: event.effectiveDirective, blockedURI: event.blockedURI,
    action: 'Compare the host CSP with uiCsp. WASM requires host script-src wasm-unsafe-eval (or equivalent); bundled fonts require blob: resources. Host restrictions cannot be overridden by the View.',
  });
  window.addEventListener('error', error, true); window.addEventListener('unhandledrejection', rejection);
  document.addEventListener('securitypolicyviolation', csp);
  return () => { window.removeEventListener('error', error, true); window.removeEventListener('unhandledrejection', rejection); document.removeEventListener('securitypolicyviolation', csp); };
}
