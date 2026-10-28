import { redactDiagnostics, type Inspector, type InspectorEvent } from './inspector.js';
import type { JsonValue } from './metadata.js';

export type InteractionChannel = 'input' | 'result' | 'state' | 'context' | 'toolInput' | 'toolResult';
export interface RecordingOptions {
  /** Explicitly public JSON pointers per payload channel. No business values are exported by default. */
  allow?: Partial<Record<InteractionChannel, string[]>>;
  /** A full recording fails on overflow; it never silently discards its beginning. Default: 1000. */
  maxSteps?: number;
}
export type InteractionStep =
  | { type: 'tool-input'; input: Record<string, JsonValue> }
  | { type: 'tool-result'; result: Record<string, JsonValue> }
  | { type: 'click'; x: number; y: number }
  | { type: 'display-mode'; mode: 'inline' | 'fullscreen' }
  | { type: 'assert-state'; name: string; value: JsonValue }
  | { type: 'assert-context'; value: JsonValue };
export interface InteractionMock {
  name: string;
  input: Record<string, JsonValue>;
  result: Record<string, JsonValue>;
}
export interface InteractionRecord {
  format: 'mcpkit-interactions';
  version: 1;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  displayMode: 'inline' | 'fullscreen';
  /** Initial built page route, without .ink. */
  page: string;
  /** False for overflow, unfinished requests or unsupported actions. */
  complete: boolean;
  steps: InteractionStep[];
  /** Strict invocation order, independent of completion order. All server calls must match. */
  mocks: InteractionMock[];
}

const channels: InteractionChannel[] = ['input', 'result', 'state', 'context', 'toolInput', 'toolResult'];
export const OMITTED = '[MCPKIT: EXPORT NOT AUTHORIZED]';
export function validateRecordingOptions(options: RecordingOptions): void {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('recording must be an options object.');
  if (options.maxSteps !== undefined && (!Number.isSafeInteger(options.maxSteps) || options.maxSteps < 1 || options.maxSteps > 5000)) throw new Error('recording.maxSteps must be between 1 and 5000.');
  if (options.allow !== undefined && (!options.allow || typeof options.allow !== 'object' || Array.isArray(options.allow))) throw new Error('recording.allow must be a channel-to-JSON-pointer map.');
  for (const [channel, pointers] of Object.entries(options.allow ?? {})) {
    if (!channels.includes(channel as InteractionChannel) || !Array.isArray(pointers)
      || pointers.some(pointer => typeof pointer !== 'string' || (pointer !== '' && !/^\/(?:[^~]|~[01])*$/.test(pointer))
        || pointer.split('/').some(part => ['__proto__', 'prototype', 'constructor'].includes(part)))) throw new Error('recording.allow requires supported channels and valid JSON pointers.');
  }
}

/** Exact structural equality, independent of JSON object property order. */
export function equalInteractionValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const left = Object.keys(a), right = Object.keys(b);
  return left.length === right.length && left.every(key => Object.hasOwn(b, key)
    && equalInteractionValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

function project(value: unknown, pointers: string[], redactKeys: readonly string[]): JsonValue {
  // Authorizing a subtree also authorizes its descendants. Credentials are still removed.
  const visit = (value: unknown, path: string): unknown => {
    if (pointers.some(pointer => path === pointer || path.startsWith(`${pointer}/`))) return value;
    if (value && typeof value === 'object') {
      if (!Object.keys(value).length) return Array.isArray(value) ? [] : {};
      const entries = Object.entries(value).map(([key, child]) => [key, visit(child, `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`)]);
      return Array.isArray(value) ? entries.map(([, child]) => child) : Object.fromEntries(entries);
    }
    return OMITTED;
  };
  return redactDiagnostics(visit(value, ''), redactKeys) as JsonValue;
}

/** Records only redacted, explicitly authorized projections of actual Inspector events. */
export class InteractionRecorder {
  private record: InteractionRecord;
  private pending = new Map<string, number>();
  private contexts = new Set<string>();
  private stop: () => void;
  private readonly options: RecordingOptions;
  constructor(inspector: Inspector, options: RecordingOptions, environment: Pick<InteractionRecord, 'viewport' | 'deviceScaleFactor' | 'displayMode' | 'page'>) {
    validateRecordingOptions(options);
    this.options = structuredClone(options);
    this.record = { format: 'mcpkit-interactions', version: 1, ...structuredClone(environment), complete: true, steps: [], mocks: [] };
    const payload = (channel: InteractionChannel, value: unknown) => project(value, this.options.allow?.[channel] ?? [], inspector.options.redactKeys);
    this.stop = inspector.subscribeEvents((event: InspectorEvent) => {
      const data = event.data as Record<string, unknown> | null;
      if (!data) return;
      if (event.kind === 'host.input' && event.requestId === null) this.append({ type: 'tool-input', input: payload('input', data.input) as Record<string, JsonValue> });
      else if (event.kind === 'host.tool-result') this.append({ type: 'tool-result', result: payload('result', data.result) as Record<string, JsonValue> });
      else if (event.kind === 'view.mode') {
        if (data.mode !== 'inline' && data.mode !== 'fullscreen') { this.record.complete = false; return; }
        if (data.initial || !this.record.steps.length) this.record.displayMode = data.mode;
        else if (data.mode !== this.record.steps.filter(step => step.type === 'display-mode').at(-1)?.mode) this.append({ type: 'display-mode', mode: data.mode });
      } else if (event.kind === 'agent.user-event' && data.target === 'canvas') {
        if (data.type === 'click' && typeof data.x === 'number' && typeof data.y === 'number') this.append({ type: 'click', x: data.x, y: data.y });
        else if (data.type !== 'pointerdown') this.record.complete = false;
      } else if (event.kind === 'agent.binding' && data.visibility === 'public') {
        if (typeof data.name !== 'string') { this.record.complete = false; return; }
        this.append({ type: 'assert-state', name: data.name, value: payload('state', data.value) });
      } else if (event.kind === 'model-context.sent') {
        this.append({ type: 'assert-context', value: payload('context', data.payload) });
        if (event.requestId) this.contexts.add(event.requestId);
      } else if (event.kind === 'model-context.acknowledged' || event.kind === 'model-context.failed') {
        if (event.requestId) this.contexts.delete(event.requestId);
        if (event.kind === 'model-context.failed') this.record.complete = false;
      } else if (event.requestId && (event.kind === 'tool.input' || (event.kind === 'host.request' && data.operation === 'tools.call'))) {
        if (this.record.mocks.length >= (this.options.maxSteps ?? 1000)) { this.record.complete = false; return; }
        const params = data.payload as Record<string, unknown> | undefined;
        const input = event.kind === 'tool.input' ? data : { name: params?.name, arguments: params?.input };
        if (typeof input.name !== 'string') { this.record.complete = false; return; }
        this.pending.set(event.requestId, this.record.mocks.length);
        this.record.mocks.push({ name: input.name, input: payload('toolInput', input.arguments ?? {}) as Record<string, JsonValue>, result: { content: [] } });
      } else if (event.requestId && this.pending.has(event.requestId) && ['tool.state', 'host.result'].includes(event.kind) && typeof data.state === 'string' && ['ready', 'error', 'cancelled'].includes(data.state)) {
        const index = this.pending.get(event.requestId)!; this.pending.delete(event.requestId);
        if (data.state !== 'ready') { this.record.complete = false; return; }
        // UI-only metadata is intentionally not a replay data source.
        const { content, structuredContent, isError } = (data.result ?? {}) as Record<string, unknown>;
        this.record.mocks[index].result = payload('toolResult', { ...(content ? { content } : {}), ...(structuredContent !== undefined ? { structuredContent } : {}), ...(isError !== undefined ? { isError } : {}) }) as Record<string, JsonValue>;
      } else if (event.kind === 'host.partialInput' || event.kind === 'host.cancelled' || event.kind === 'view-tool.input'
        || (event.kind === 'tool.state' && typeof data.attempt === 'number' && data.attempt > 1)
        || (event.kind === 'host.request' && !['tools.call', 'conversation.updateContext'].includes(String(data.operation)))) this.record.complete = false;
    });
  }
  private append(step: InteractionStep): void {
    if (this.record.steps.length >= (this.options.maxSteps ?? 1000)) { this.record.complete = false; return; }
    this.record.steps.push(step);
  }
  snapshot(): InteractionRecord {
    return structuredClone({ ...this.record, complete: this.record.complete && this.pending.size === 0 && this.contexts.size === 0 });
  }
  export(): string { return JSON.stringify(this.snapshot(), null, 2); }
  dispose(): void { this.stop(); }
}

/** Validate imported files before launching any browser or executing any step. */
export function validateInteractionRecord(value: unknown): asserts value is InteractionRecord {
  const invalid = (message: string): never => { throw new Error(`Invalid interaction record: ${message}`); };
  let nodes = 0;
  const json = (value: unknown, depth: number): boolean => {
    if (++nodes > 100_000 || depth > 32) return false;
    return value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
      || (!!value && typeof value === 'object' && (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype)
        && Object.entries(value).every(([key, child]) => !['__proto__', 'constructor', 'prototype'].includes(key) && json(child, depth + 1)));
  };
  if (!json(value, 0)) invalid('expected bounded JSON data.');
  const record = value as InteractionRecord;
  const object = (value: unknown) => !!value && typeof value === 'object' && !Array.isArray(value);
  if (!object(record) || record.format !== 'mcpkit-interactions' || record.version !== 1) invalid('unsupported format/version.');
  if (record.complete !== true) invalid('recording is incomplete.');
  if (typeof record.page !== 'string' || !record.page || record.page.includes('\\') || record.page.endsWith('.ink') || record.page.split('/').some(part => !part || part === '.' || part === '..')) invalid('invalid initial page.');
  if (!object(record.viewport) || ![record.viewport.width, record.viewport.height].every(n => Number.isSafeInteger(n) && n > 0 && n <= 16384)
    || !Number.isFinite(record.deviceScaleFactor) || record.deviceScaleFactor <= 0 || record.deviceScaleFactor > 4
    || !['inline', 'fullscreen'].includes(record.displayMode)) invalid('invalid environment.');
  if (!Array.isArray(record.steps) || !record.steps.length || record.steps.length > 5000 || record.steps[0]?.type !== 'tool-input') invalid('the first step must be tool-input; at most 5000 steps.');
  for (const step of record.steps) {
    if (!object(step)) invalid('invalid step.');
    switch (step.type) {
      case 'tool-input': if (!object(step.input)) invalid('tool-input requires an object.'); break;
      case 'tool-result': if (!object(step.result) || !Array.isArray(step.result.content)) invalid('tool-result requires content.'); break;
      case 'display-mode': if (!['inline', 'fullscreen'].includes(step.mode)) invalid('unsupported display mode.'); break;
      case 'click': if (![step.x, step.y].every(n => Number.isFinite(n) && n >= 0 && n <= 16384)) invalid('invalid canvas coordinates.'); break;
      case 'assert-state': if (typeof step.name !== 'string' || !step.name || !Object.hasOwn(step, 'value')) invalid('invalid state assertion.'); break;
      case 'assert-context': if (!Object.hasOwn(step, 'value')) invalid('missing context assertion.'); break;
      default: invalid('unsupported step type.');
    }
  }
  if (!record.steps.some(step => step.type === 'assert-state' || step.type === 'assert-context')) invalid('at least one semantic assertion is required.');
  if (!Array.isArray(record.mocks) || record.mocks.length > 5000) invalid('invalid mocks.');
  for (const mock of record.mocks) if (!object(mock) || typeof mock.name !== 'string' || !/^[\w-]{1,128}$/.test(mock.name) || !object(mock.input) || !object(mock.result) || !Array.isArray(mock.result.content)) invalid('invalid tool mock.');
  const text = JSON.stringify(record);
  if (/\[MCPKIT: EXPORT NOT AUTHORIZED\]|\[REDACTED\]|\[TRUNCATED|\[UNAVAILABLE\]|\[CIRCULAR\]/.test(text)) invalid('redacted values require explicit synthetic replacements before replay.');
}
