/** Browser-safe snapshot contracts. A trusted host supplies an already scoped store. */
export type SnapshotJson = null | boolean | number | string | SnapshotJson[] | { [key: string]: SnapshotJson };
export interface SnapshotScope {
  readonly userId: string;
  readonly conversationId: string;
  readonly applicationId: string;
  readonly instanceId: string;
}
export interface SnapshotPayload {
  page: string;
  data: { [key: string]: SnapshotJson };
}
export interface AgentSnapshot {
  formatVersion: 1;
  dataVersion: number;
  scope: SnapshotScope;
  payload: SnapshotPayload;
}
export interface SnapshotRecord { revision: string; snapshot: AgentSnapshot }
export interface ScopedSnapshotStore {
  /** Assigned by the trusted host/backend, never by tool arguments or Ink messages. */
  readonly scope: SnapshotScope;
  read(options: { signal: AbortSignal }): Promise<SnapshotRecord | undefined>;
  write(snapshot: AgentSnapshot, options: { expectedRevision: string | null; signal: AbortSignal }): Promise<string>;
  remove(options: { expectedRevision: string | null; signal: AbortSignal }): Promise<void>;
}
export interface RestorationBinding {
  store: ScopedSnapshotStore;
  dataVersion: number;
  validate(data: SnapshotPayload['data'], page: string): boolean;
  /** Only older data versions are migrated. Scope and envelope cannot be changed. */
  migrate?(payload: SnapshotPayload, from: number, to: number): SnapshotPayload | Promise<SnapshotPayload>;
}
export interface RestorationContext {
  applicationId: string;
  initialPage: string;
  signal: AbortSignal;
}
export type RestorationAdapter = (context: RestorationContext) => RestorationBinding | undefined | Promise<RestorationBinding | undefined>;

export class SnapshotError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'SnapshotError'; }
}
const fail = (code: string) => new SnapshotError(code, `Snapshot operation failed (${code}).`);
const storeCodes = new Set(['CONFLICT', 'SCOPE_MISMATCH', 'INVALID_SCOPE', 'INVALID_DATA', 'TOO_LARGE', 'TIMEOUT', 'STORAGE_ERROR']);
const scopeNames = ['userId', 'conversationId', 'applicationId', 'instanceId'] as const;
function scopeCopy(value: SnapshotScope): SnapshotScope {
  if (!value || scopeNames.some(key => typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 512)) throw fail('INVALID_SCOPE');
  return Object.freeze(Object.fromEntries(scopeNames.map(key => [key, value[key]]))) as unknown as SnapshotScope;
}
const scopeKey = (scope: SnapshotScope) => JSON.stringify(scopeNames.map(key => scope[key]));
function jsonCopy<T>(value: T): T {
  const ancestors = new Set<object>();
  function copy(value: unknown, depth: number): SnapshotJson {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object' || depth > 64 || ancestors.has(value)) throw fail('INVALID_DATA');
    if (Object.getOwnPropertySymbols(value).length) throw fail('INVALID_DATA');
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw fail('INVALID_DATA');
    ancestors.add(value);
    const result: Record<string, SnapshotJson> = {};
    const entries = Object.entries(Object.getOwnPropertyDescriptors(value)).filter(([key]) => !(Array.isArray(value) && key === 'length'));
    for (const [key, descriptor] of entries) {
      if (['__proto__', 'constructor', 'prototype'].includes(key) || !descriptor.enumerable || !('value' in descriptor)) throw fail('INVALID_DATA');
      result[key] = copy(descriptor.value, depth + 1);
    }
    ancestors.delete(value);
    if (Array.isArray(value)) {
      if (entries.length !== value.length || entries.some(([key], i) => key !== String(i))) throw fail('INVALID_DATA');
      return entries.map(([key]) => result[key]);
    }
    return result;
  }
  const result = copy(value, 0);
  if (new TextEncoder().encode(JSON.stringify(result)).length > 256 * 1024) throw fail('TOO_LARGE');
  return result as T;
}

/** Factory stays in trusted host code. Give an App only its returned capability. */
export function createMemorySnapshotStore() {
  const records = new Map<string, SnapshotRecord>();
  let sequence = 0;
  return { bind(input: SnapshotScope): ScopedSnapshotStore {
    const scope = scopeCopy(input), key = scopeKey(scope);
    const check = (revision: string | null, signal: AbortSignal) => {
      signal.throwIfAborted();
      if ((records.get(key)?.revision ?? null) !== revision) throw fail('CONFLICT');
    };
    return Object.freeze({
      scope,
      async read({ signal }: { signal: AbortSignal }) {
        signal.throwIfAborted();
        const record = records.get(key);
        return record ? jsonCopy(record) : undefined;
      },
      async write(snapshot: AgentSnapshot, { expectedRevision, signal }: { expectedRevision: string | null; signal: AbortSignal }) {
        check(expectedRevision, signal);
        if (scopeKey(scopeCopy(snapshot.scope)) !== key) throw fail('SCOPE_MISMATCH');
        const record = jsonCopy({ snapshot, revision: String(++sequence) });
        records.set(key, record); return record.revision;
      },
      async remove({ expectedRevision, signal }: { expectedRevision: string | null; signal: AbortSignal }) {
        check(expectedRevision, signal); records.delete(key);
      },
    });
  } };
}

/** One session per View. CAS prevents a stale reconstructed View overwriting a newer one. */
export function createSnapshotSession(binding: RestorationBinding, options: { applicationId: string; pages: string[]; timeoutMs?: number }) {
  const scope = scopeCopy(binding.store.scope);
  if (scope.applicationId !== options.applicationId) throw fail('SCOPE_MISMATCH');
  if (!Number.isSafeInteger(binding.dataVersion) || binding.dataVersion < 1 || typeof binding.validate !== 'function') throw fail('INVALID_CONTRACT');
  const timeout = options.timeoutMs ?? 5000;
  const pages = new Set(options.pages);
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 2_147_483_647) throw fail('INVALID_TIMEOUT');
  const validate = (value: SnapshotPayload) => {
    const payload = jsonCopy(value);
    let valid = false;
    try { valid = !!payload && !!payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data) && binding.validate(payload.data, payload.page); } catch { /* Validation diagnostics cannot expose private state. */ }
    if (!payload || Object.keys(payload).some(key => key !== 'page' && key !== 'data') || !pages.has(payload.page) || !valid) throw fail('INVALID_DATA');
    return payload;
  };
  async function operation<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([Promise.resolve().then(() => run(controller.signal)), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(fail('TIMEOUT')); }, timeout);
      })]);
    } catch (error) { throw fail(error instanceof SnapshotError && storeCodes.has(error.code) ? error.code : 'STORAGE_ERROR'); }
    finally { clearTimeout(timer); }
  }
  let revision: string | null = null, writable = true, closed = false;
  let tail: Promise<unknown> = Promise.resolve();
  let initialization: Promise<SnapshotPayload | undefined> | undefined;
  function initialize(): Promise<SnapshotPayload | undefined> {
    return initialization ??= (async () => {
      try {
        const record = await operation(signal => binding.store.read({ signal }));
        if (!record) return undefined;
        const snapshot = jsonCopy(record.snapshot);
        if (typeof record.revision !== 'string' || !record.revision || snapshot.formatVersion !== 1) throw fail('INVALID_SNAPSHOT');
        if (scopeKey(scopeCopy(snapshot.scope)) !== scopeKey(scope)) throw fail('SCOPE_MISMATCH');
        revision = record.revision;
        if (!Number.isSafeInteger(snapshot.dataVersion) || snapshot.dataVersion < 1 || snapshot.dataVersion > binding.dataVersion) throw fail('VERSION_UNSUPPORTED');
        let payload = snapshot.payload;
        if (snapshot.dataVersion !== binding.dataVersion) {
          if (!binding.migrate) throw fail('VERSION_UNSUPPORTED');
          payload = await operation(() => Promise.resolve(binding.migrate!(jsonCopy(payload), snapshot.dataVersion, binding.dataVersion)));
          payload = validate(payload);
          revision = await operation(signal => binding.store.write({formatVersion:1, dataVersion:binding.dataVersion, scope, payload}, {expectedRevision:revision, signal}));
        }
        return validate(payload);
      } catch (error) { writable = false; throw error instanceof SnapshotError ? error : fail('INVALID_SNAPSHOT'); }
    })();
  }
  return {
    scope,
    restore() { return closed ? Promise.reject(fail('CLOSED')) : initialize(); },
    save(value: SnapshotPayload): Promise<void> {
      if (closed) return Promise.reject(fail('CLOSED'));
      let payload: SnapshotPayload;
      try { payload = validate(value); } catch (error) { return Promise.reject(error); }
      const work = tail.then(async () => {
        await initialize();
        if (!writable) throw fail('NOT_WRITABLE');
        try {
          revision = await operation(signal => binding.store.write({formatVersion:1, dataVersion:binding.dataVersion, scope, payload}, {expectedRevision:revision, signal}));
        } catch (error) { writable = false; throw error; }
      });
      tail = work.catch(() => {}); return work;
    },
    async close() { closed = true; await tail; await initialization?.catch(() => {}); },
  };
}
