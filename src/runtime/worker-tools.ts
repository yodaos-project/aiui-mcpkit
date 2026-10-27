import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type {
  BusinessToolHandler,
  BusinessToolResult,
} from './business-tools.js';
import type { RequestContext } from './lifecycle.js';

interface Pending {
  resolve(value: unknown): void;
  reject(error: Error): void;
  context: RequestContext;
  cleanup(): void;
}
/** JSON Lines transport only; worker source is loaded/executed exclusively by Ink. */
export class InkWorkerConnection {
  private child?: ChildProcessWithoutNullStreams;
  private pending = new Map<string, Pending>();
  private closed = false;
  private readonly onExit = () => this.close();
  constructor(
    private readonly worker: string,
    private readonly appDirectory = fileURLToPath(
      new URL('../worker-app/', import.meta.url),
    ),
  ) {}
  private start() {
    if (this.closed)
      throw new DOMException('Ink worker host is closed', 'InvalidStateError');
    if (this.child) return this.child;
    const args = ['--app', this.appDirectory, '--worker', this.worker];
    if (process.env.INK_WORKER_CONFIGURATION)
      args.push('--configuration', process.env.INK_WORKER_CONFIGURATION);
    const child = spawn(process.env.INK_WORKER_BIN || 'ink-worker', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;
    process.once('exit', this.onExit);
    // stderr is drained without publishing private deployment/configuration details.
    child.stderr.resume();
    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      if (Buffer.byteLength(line) > 1024 * 1024) {
        this.close();
        return;
      }
      let event: {
        type: string;
        requestId: string;
        value?: unknown;
        error?: { name: string; message: string };
      };
      try {
        event = JSON.parse(line);
      } catch {
        this.close();
        return;
      }
      const call = this.pending.get(event.requestId);
      if (!call) return;
      if (event.type === 'progress') {
        const value = event.value as {
          value: number;
          total?: number;
          message?: string;
        };
        if (!value || !Number.isFinite(value.value)) {
          this.close();
          return;
        }
        try {
          call.context.progress({
            progress: value.value,
            ...(value.total === undefined ? {} : { total: value.total }),
            ...(value.message === undefined ? {} : { message: value.message }),
          });
        } catch {
          /* Progress observers cannot terminate unrelated calls. */
        }
      } else if (event.type === 'complete') {
        this.pending.delete(event.requestId);
        call.cleanup();
        if (event.error)
          call.reject(new DOMException(event.error.message, event.error.name));
        else call.resolve(event.value);
      }
    });
    const disconnected = () => {
      this.closed = true;
      for (const call of this.pending.values()) {
        call.cleanup();
        call.reject(
          new DOMException('Ink worker host disconnected', 'NetworkError'),
        );
      }
      this.pending.clear();
      child.kill();
      process.removeListener('exit', this.onExit);
    };
    child.on('error', disconnected);
    child.on('exit', disconnected);
    child.stdin.on('error', disconnected);
    return child;
  }
  invoke(
    operation: string,
    input: unknown,
    context: RequestContext,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (context.signal.aborted)
        throw new DOMException('Worker invocation aborted', 'AbortError');
      if (this.pending.size >= 128)
        throw new DOMException(
          'Worker invocation limit reached',
          'QuotaExceededError',
        );
      const child = this.start();
      const id = randomUUID();
      const abort = () => {
        if (!this.pending.delete(id)) return;
        context.signal.removeEventListener('abort', abort);
        child.stdin.write(JSON.stringify({ type: 'cancel', id }) + '\n');
        reject(new DOMException('Worker invocation aborted', 'AbortError'));
      };
      const command = JSON.stringify({
        type: 'invoke',
        id,
        operation,
        input,
        timeoutMs: 120_000,
      });
      if (Buffer.byteLength(command) > 1024 * 1024)
        throw new DOMException(
          'Worker input exceeds size limit',
          'QuotaExceededError',
        );
      this.pending.set(id, {
        resolve,
        reject,
        context,
        cleanup: () => context.signal.removeEventListener('abort', abort),
      });
      context.signal.addEventListener('abort', abort, { once: true });
      child.stdin.write(command + '\n');
    });
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.child?.stdin.end(JSON.stringify({ type: 'shutdown' }) + '\n');
    this.child?.kill();
    for (const call of this.pending.values()) {
      call.cleanup();
      call.reject(
        new DOMException('Ink worker host disconnected', 'NetworkError'),
      );
    }
    this.pending.clear();
    process.removeListener('exit', this.onExit);
  }
}
export function createWorkerHandlers(
  worker: string,
  tools: string[],
): Record<
  string,
  BusinessToolHandler<Record<string, unknown>, Record<string, unknown>>
> {
  const connection = new InkWorkerConnection(worker);
  process.stdin.once('end', () => connection.close());
  return Object.fromEntries(
    tools.map((name) => [
      name,
      async (input: Record<string, unknown>, context: RequestContext) => {
        const result = (await connection.invoke(name, input, context)) as {
          content: BusinessToolResult<Record<string, unknown>>['content'];
          structuredContent: Record<string, unknown>;
          uiMetadata?: Record<string, unknown>;
        };
        if (!result || typeof result !== 'object')
          throw new Error('Invalid worker result');
        return {
          content: result.content,
          structuredContent: result.structuredContent,
          ...(result.uiMetadata === undefined
            ? {}
            : { uiOnly: result.uiMetadata }),
        };
      },
    ]),
  );
}
