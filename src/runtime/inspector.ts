import type { RequestPolicy } from './lifecycle.js';
import { validateRecordingOptions, type RecordingOptions } from './interactions.js';

/** Development-only, bounded diagnostics. Values are redacted before retention. */
export interface InspectorOptions {
  /** Record a fresh View from launch. Export values require an explicit per-channel allowlist. */
  recording?: RecordingOptions;
  /** Retained events per View, from 1 to 5000. Default: 500. */
  maxEvents?: number;
  /** Additional case-insensitive field names to remove, at any depth. */
  redactKeys?: string[];
}
export interface InspectorEvent {
  sequence: number;
  time: string;
  kind: string;
  /** Null means the transport did not supply a correlation identifier. */
  requestId: string | null;
  data: unknown;
}
/** Optional application instrumentation; private values are omitted by default. */
export interface AgentInspectionMessage {
  type: 'mcpkit:inspect';
  kind: 'binding' | 'user-event' | 'link';
  name: string;
  requestId?: string;
  relatedRequestId?: string;
  visibility?: 'public' | 'private';
  value?: unknown;
}
export function resolveInspectorOptions(value: boolean | InspectorOptions = false): (InspectorOptions & { maxEvents: number; redactKeys: string[] }) | undefined {
  if (value === false) return undefined;
  if (value !== true && (!value || typeof value !== 'object' || Array.isArray(value))) throw new Error('inspector must be a boolean or options object.');
  const { maxEvents = 500, redactKeys = [], recording } = value === true ? {} : value;
  if (!Number.isSafeInteger(maxEvents) || maxEvents < 1 || maxEvents > 5000) throw new Error('inspector.maxEvents must be an integer between 1 and 5000.');
  if (!Array.isArray(redactKeys) || redactKeys.some(key => typeof key !== 'string' || !key)) throw new Error('inspector.redactKeys must contain nonempty field names.');
  if (recording !== undefined) validateRecordingOptions(recording);
  return { maxEvents, redactKeys: [...redactKeys], ...(recording !== undefined ? { recording: structuredClone(recording) } : {}) };
}

const sensitive = /authorization|cookie|password|passwd|secret|token|credential|api[-_]?key|private|^_meta$|^uiOnly$|^uiMetadata$/i;
function scrub(text: string): string {
  return text
    .replace(/\b(Bearer|Basic)\s+[^\s"'<>]+/gi, '$1 [REDACTED]')
    .replace(/([a-z][a-z\d+.-]*:\/\/)[^\s/@]+@/gi, '$1[REDACTED]@')
    .replace(/([?&][^=&#\s]+)=([^&#\s]*)/g, '$1=[REDACTED]')
    .replace(/((?:password|secret|token|api[-_]?key|authorization)\s*[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .slice(0, 4000);
}
/** Heuristic credential filtering plus explicit application-specific field rules. */
export function redactDiagnostics(value: unknown, redactKeys: readonly string[] = []): unknown {
  const keys = new Set(redactKeys.map(key => key.toLowerCase()));
  const seen = new WeakSet<object>();
  let remaining = 1000;
  let textBudget = 32_768;
  const text = (value: string) => {
    const length = Math.min(value.length, 4000, textBudget);
    textBudget -= length;
    return scrub(value.slice(0, length)) + (value.length > length ? '[TRUNCATED]' : '');
  };
  function visit(value: unknown, depth: number): unknown {
    if (--remaining < 0 || depth > 10) return '[TRUNCATED]';
    if (typeof value === 'string') {
      // Tool content and live-tool results often carry JSON inside text.
      if (/^\s*[\[{]/.test(value)) {
        if (value.length > 32_768) return '[TRUNCATED JSON TEXT]';
        try { return text(JSON.stringify(visit(JSON.parse(value), depth + 1))); } catch { /* Ordinary text. */ }
      }
      return text(value);
    }
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value !== 'object') return null;
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    try {
      if (value instanceof Error) return { name: text(value.name), message: text(value.message) };
      if (Array.isArray(value)) return [...value.slice(0, 100).map(item => visit(item, depth + 1)), ...(value.length > 100 ? ['[TRUNCATED]'] : [])];
      const names = Object.keys(value);
      return Object.fromEntries([...names.slice(0, 100).map(key => [text(key),
        sensitive.test(key) || keys.has(key.toLowerCase()) ? '[REDACTED]' : visit((value as Record<string, unknown>)[key], depth + 1),
      ]), ...(names.length > 100 ? [['[TRUNCATED]', '[TRUNCATED]']] : [])]);
    } finally { seen.delete(value); }
  }
  try { return visit(value, 0); } catch { return '[UNAVAILABLE]'; }
}

/** Same recorder is used by the actual bridge, provider and developer controls. */
export class Inspector {
  private events: InspectorEvent[] = [];
  private sequence = 0;
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(event: InspectorEvent) => void>();
  readonly options: { readonly maxEvents: number; readonly redactKeys: readonly string[] };
  constructor(options: InspectorOptions = {}) {
    const resolved = resolveInspectorOptions(options)!;
    this.options = Object.freeze({ maxEvents: resolved.maxEvents, redactKeys: Object.freeze(resolved.redactKeys) });
  }
  record(kind: string, data?: unknown, requestId: string | null = null): void {
    const event = { sequence: ++this.sequence, time: new Date().toISOString(), kind: scrub(kind),
      requestId: requestId === null ? null : scrub(requestId), data: redactDiagnostics(data, this.options.redactKeys) };
    this.events.push(event);
    this.events = this.events.slice(-this.options.maxEvents);
    for (const listener of this.eventListeners) { try { listener(structuredClone(event)); } catch { /* Observers cannot affect execution. */ } }
    for (const listener of this.listeners) { try { listener(); } catch { /* Diagnostics cannot affect execution. */ } }
  }
  snapshot(requestId?: string): InspectorEvent[] {
    return structuredClone(this.events.filter(event => requestId === undefined || event.requestId === requestId));
  }
  clear(): void { this.events = []; for (const listener of this.listeners) { try { listener(); } catch { /* Observers cannot affect diagnostics. */ } } }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  subscribeEvents(listener: (event: InspectorEvent) => void): () => void { this.eventListeners.add(listener); return () => { this.eventListeners.delete(listener); }; }
  export(): string { return JSON.stringify({ format: 'mcpkit-inspector/1', events: this.snapshot() }, null, 2); }
}

export interface InspectorTool { name: string; inputSchema: unknown; target: 'server' | 'view' }
export interface InspectorControls {
  recording?: { export(): string };
  policy: RequestPolicy;
  tools(): Promise<InspectorTool[]>;
  call(tool: InspectorTool, input: Record<string, unknown>): string;
  cancel(requestId: string): void;
  capabilities(): unknown;
}
