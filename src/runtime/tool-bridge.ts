import { RequestLifecycle, RequestLifecycleError, type RequestContext, type RequestPolicy, type RequestSnapshot } from './lifecycle.js';

export interface AgentToolRequest {
  type: 'mcpkit:call-tool';
  requestId: string;
  name: string;
  arguments?: Record<string, unknown>;
}
export interface ToolBridgeOptions {
  policy?: Partial<RequestPolicy>;
  /** Trusted, build-time allowlist. Agent messages cannot enable retries. */
  retrySafeTools?: readonly string[];
  callTool(params: { name: string; arguments?: Record<string, unknown> }, context: RequestContext): Promise<unknown>;
  send(snapshot: RequestSnapshot & { type: 'mcpkit:tool-state' }): void;
}
/** Routes Agent messages without sharing mutable results between requests. */
export class AgentToolBridge {
  readonly lifecycle: RequestLifecycle;
  private readonly usedIds = new Set<string>();
  constructor(private readonly options: ToolBridgeOptions) { this.lifecycle = new RequestLifecycle(options.policy); }
  receive(message: unknown): boolean {
    if (!message || typeof message !== 'object') return false;
    const data = message as Record<string, unknown>;
    if (data.type === 'mcpkit:cancel-tool' && typeof data.requestId === 'string') {
      this.lifecycle.cancel(data.requestId);
      return true;
    }
    if (data.type !== 'mcpkit:call-tool') return false;
    if (typeof data.requestId !== 'string' || !data.requestId) return true;
    // Reusing an ID cannot create a second operation or replace its state.
    if (this.usedIds.has(data.requestId)) return true;
    this.usedIds.add(data.requestId);
    if (typeof data.name !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(data.name) ||
        (data.arguments !== undefined && (!data.arguments || typeof data.arguments !== 'object' || Array.isArray(data.arguments)))) {
      this.options.send({ type: 'mcpkit:tool-state', requestId: data.requestId, state: 'error', attempt: 0,
        policy: { ...this.lifecycle.policy, maxRetries: 0 }, error: { code: 'invalid_request', message: 'Invalid tool name or arguments' } });
      return true;
    }
    const request = data as unknown as AgentToolRequest;
    const handle = this.lifecycle.start(async context => {
      const result = await this.options.callTool({ name: request.name, arguments: request.arguments }, context);
      if (result && typeof result === 'object' && (result as { isError?: boolean }).isError) {
        throw new RequestLifecycleError('tool_error', JSON.stringify(result));
      }
      return result;
    }, {
      requestId: request.requestId,
      retrySafe: this.options.retrySafeTools?.includes(request.name),
      shouldRetry: error => error instanceof RequestLifecycleError && error.code === 'request_timeout',
      onChange: snapshot => this.options.send({ type: 'mcpkit:tool-state', ...snapshot }),
    });
    void handle.result.catch(() => {});
    return true;
  }
  cancelAll(reason?: string): void { this.lifecycle.cancelAll(reason); }
}
