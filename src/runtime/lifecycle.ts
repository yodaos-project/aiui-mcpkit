/** Shared policy for server handlers and Agent-initiated tool calls. */
export interface RequestPolicy {
  /** Wall-clock budget for all attempts and retry delays; never reset. */
  totalTimeoutMs: number;
  /** Per-attempt budget, optionally reset by progress. */
  requestTimeoutMs: number;
  resetTimeoutOnProgress: boolean;
  /** Extra attempts. Ignored unless both retrySafe and shouldRetry are supplied. */
  maxRetries: number;
  retryDelayMs: number;
}
export const DEFAULT_REQUEST_POLICY: Readonly<RequestPolicy> = Object.freeze({
  totalTimeoutMs: 60_000, requestTimeoutMs: 60_000,
  resetTimeoutOnProgress: false, maxRetries: 0, retryDelayMs: 0,
});
export function resolveRequestPolicy(input: Partial<RequestPolicy> = {}): RequestPolicy {
  const policy = { ...DEFAULT_REQUEST_POLICY, ...input };
  for (const key of ['totalTimeoutMs', 'requestTimeoutMs', 'retryDelayMs', 'maxRetries'] as const) {
    const value = policy[key];
    if (!Number.isSafeInteger(value) || value < (key.endsWith('TimeoutMs') ? 1 : 0) || value > 2_147_483_647) {
      throw new Error(`${key} must be an integer between ${key.endsWith('TimeoutMs') ? 1 : 0} and 2147483647.`);
    }
  }
  if (typeof policy.resetTimeoutOnProgress !== 'boolean') throw new Error('resetTimeoutOnProgress must be boolean.');
  return policy;
}
export type RequestState = 'pending' | 'ready' | 'error' | 'cancelled';
export class RequestLifecycleError extends Error {
  constructor(public readonly code: 'cancelled' | 'request_timeout' | 'total_timeout' | 'tool_error', message: string) {
    super(message); this.name = 'RequestLifecycleError';
  }
}
export interface RequestSnapshot<T = unknown> {
  requestId: string;
  state: RequestState;
  attempt: number;
  policy: RequestPolicy;
  result?: T;
  progress?: unknown;
  error?: { code: string; message: string };
}
export interface RequestContext {
  requestId: string;
  attempt: number;
  signal: AbortSignal;
  progress(value: unknown): void;
}
export interface RequestOptions<T> {
  requestId?: string;
  signal?: AbortSignal;
  policy?: Partial<RequestPolicy>;
  retrySafe?: boolean;
  shouldRetry?: (error: unknown) => boolean;
  onChange?: (snapshot: RequestSnapshot<T>) => void;
}
export interface RequestHandle<T> {
  result: Promise<T>;
  snapshot(): RequestSnapshot<T>;
  cancel(reason?: string): void;
}
let sequence = 0;

/** Owns only active requests. Consumers retain handles for terminal inspection. */
export class RequestLifecycle {
  private readonly active = new Map<string, RequestHandle<unknown>>();
  readonly policy: Readonly<RequestPolicy>;
  constructor(policy: Partial<RequestPolicy> = {}) { this.policy = Object.freeze(resolveRequestPolicy(policy)); }
  inspect(): RequestSnapshot[] { return [...this.active.values()].map(handle => handle.snapshot()); }
  cancel(requestId: string, reason?: string): boolean {
    const handle = this.active.get(requestId);
    if (!handle) return false;
    handle.cancel(reason); return true;
  }
  cancelAll(reason = 'Request cancelled'): void { for (const handle of this.active.values()) handle.cancel(reason); }
  start<T>(operation: (context: RequestContext) => Promise<T>, options: RequestOptions<T> = {}): RequestHandle<T> {
    const requestId = options.requestId ?? `mcpkit-${++sequence}`;
    if (!requestId || this.active.has(requestId)) throw new Error(`Request ID is empty or active: ${requestId}`);
    const policy = resolveRequestPolicy({ ...this.policy, ...options.policy });
    // The effective policy must reflect whether automatic retries can actually run.
    if (!options.retrySafe || !options.shouldRetry) policy.maxRetries = 0;
    let state: RequestSnapshot<T> = { requestId, state: 'pending', attempt: 0, policy };
    const snapshot = () => ({ ...state, policy: { ...policy } });
    const publish = () => { try { options.onChange?.(snapshot()); } catch { /* Observers cannot control request settlement. */ } };
    let controller: AbortController | undefined;
    let totalTimer: ReturnType<typeof setTimeout> | undefined;
    let attemptTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const result = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    const pending = () => state.state === 'pending';
    const finish = (terminal: RequestState, value: unknown) => {
      if (!pending()) return;
      state = { ...state, state: terminal };
      if (terminal === 'ready') state.result = value as T;
      else state.error = { code: value instanceof RequestLifecycleError ? value.code : 'tool_error', message: value instanceof Error ? value.message : String(value) };
      clearTimeout(totalTimer); clearTimeout(attemptTimer); clearTimeout(retryTimer);
      options.signal?.removeEventListener('abort', externalAbort);
      this.active.delete(requestId);
      if (terminal !== 'ready') controller?.abort(value);
      publish();
      if (terminal === 'ready') resolve(value as T); else reject(value);
    };
    const cancel = (reason = 'Request cancelled') => finish('cancelled', new RequestLifecycleError('cancelled', reason));
    const externalAbort = () => cancel(options.signal?.reason instanceof Error ? options.signal.reason.message : 'Request cancelled');
    const handle: RequestHandle<T> = { result, snapshot, cancel };
    this.active.set(requestId, handle);
    const run = () => {
      if (!pending()) return;
      const current = new AbortController(); controller = current;
      state = { ...state, attempt: state.attempt + 1, progress: undefined }; publish();
      const live = () => pending() && controller === current && !current.signal.aborted;
      const fail = (error: unknown) => {
        if (!live()) return;
        clearTimeout(attemptTimer);
        current.abort(error);
        let retry = false;
        try { retry = state.attempt <= policy.maxRetries && options.shouldRetry?.(error) === true; }
        catch (predicateError) { finish('error', predicateError); return; }
        if (!pending()) return;
        if (retry) retryTimer = setTimeout(run, policy.retryDelayMs);
        else finish('error', error);
      };
      const arm = () => {
        clearTimeout(attemptTimer);
        attemptTimer = setTimeout(() => fail(new RequestLifecycleError('request_timeout', 'Request attempt timed out')), policy.requestTimeoutMs);
      };
      if (!live()) return;
      arm();
      // A terminal observer can synchronously cancel this attempt.
      if (!live()) return;
      Promise.resolve().then(() => {
        if (!live()) return;
        return operation({ requestId, attempt: state.attempt, signal: current.signal, progress: value => {
          if (!live()) return;
          if (policy.resetTimeoutOnProgress) arm();
          state = { ...state, progress: value }; publish();
        } });
      }).then(value => { if (live()) finish('ready', value); }, fail);
    };
    totalTimer = setTimeout(() => finish('error', new RequestLifecycleError('total_timeout', 'Total request budget exceeded')), policy.totalTimeoutMs);
    options.signal?.addEventListener('abort', externalAbort, { once: true });
    if (options.signal?.aborted) externalAbort(); else run();
    return handle;
  }
}
