import type { App } from '@modelcontextprotocol/ext-apps';
import type { Inspector } from './inspector.js';
import type {
  InkHostOperation,
  InkHostProviderObserver,
  InkHostProviderRequest,
  InkHostProviderRequestContext,
} from '@yodaos-pkg/ink';

type JsonObject = Record<string, unknown>;
type Operation = InkHostOperation;
type Request = InkHostProviderRequest;
type Notification = Parameters<InkHostProviderObserver['notify']>[0];
type InvocationUpdate =
  | { type: 'input' | 'partialInput'; input: JsonObject }
  | { type: 'result'; result: ReturnType<typeof hostToolResult> }
  | { type: 'cancelled'; reason?: string };
const fail = (name: string, message: string) => new DOMException(message, name);
function object(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}
function textContent(value: unknown) {
  if (!Array.isArray(value)) throw fail('DataError', 'Invalid host content');
  return value.map((item) => {
    if (!item || item.type !== 'text')
      throw fail('NotSupportedError', 'Unsupported host content modality');
    if (typeof item.text !== 'string')
      throw fail('DataError', 'Invalid host text');
    return { type: 'text' as const, text: item.text };
  });
}
export function hostToolResult(value: unknown) {
  const result = object(value);
  if (!result) throw fail('DataError', 'Invalid tool result');
  const metadata = object(result._meta);
  return {
    content: textContent(result.content),
    ...(object(result.structuredContent)
      ? { structuredContent: result.structuredContent }
      : {}),
    ...(typeof result.isError === 'boolean' ? { isError: result.isError } : {}),
    // Only the declared UI-only field crosses the runtime boundary; never raw _meta.
    ...(object(metadata?.uiOnly) ? { uiMetadata: metadata!.uiOnly } : {}),
  };
}
function publicContext(value: unknown): JsonObject {
  const source = object(value) || {};
  return Object.fromEntries(
    [
      'theme',
      'locale',
      'displayMode',
      'availableDisplayModes',
      'safeAreaInsets',
    ]
      .filter((key) => source[key] !== undefined)
      .map((key) => [key, source[key]]),
  );
}
/** Maps the negotiated MCP Apps surface to Ink services; it is never an MCP client API inside Ink. */
export function createMcpHostProvider(app: App, inspector?: Inspector) {
  let observer: InkHostProviderObserver | undefined;
  let revision = 0;
  let buffered: Notification[] = [];
  let contextTail = Promise.resolve();
  const revisions = new Map<string, number>();
  let owner: string | undefined;
  const capabilities = () => {
    const host = app.getHostCapabilities();
    const operations: Operation[] = [];
    // Ink context entries publish structured snapshots; text-only hosts cannot provide them.
    if (host?.updateModelContext?.structuredContent)
      operations.push('conversation.updateContext');
    if (host?.message?.text) operations.push('conversation.sendMessage');
    if (host?.serverTools) operations.push('tools.call');
    if (host?.serverResources)
      operations.push('resources.list', 'resources.read');
    // MCP Apps does not expose a tools/list proxy or list-change notifications.
    return {
      operations,
      contentTypes: ['text' as const],
      toolListChanged: false,
      resourceListChanged: false,
    };
  };
  const notify = (value: InvocationUpdate) => {
    // MCP Apps notifications do not carry an invocation ID. These revisions order
    // delivery only; they cannot prove correlation for overlapping host invocations.
    const notification = {
      invocationId: null,
      revision: ++revision,
      ...value,
    };
    inspector?.record(`host.${value.type}`, notification);
    if (observer) observer.notify(notification);
    else {
      buffered.push(notification);
      buffered = buffered.slice(-32);
    }
  };
  async function publish(value: Parameters<App['updateModelContext']>[0], requestId: string) {
    // Observe the actual outbound call, after queueing, capability checks and clears.
    inspector?.record('model-context.sent', { payload: value, timeoutMs: 120_000, cancellation: 'Queued writes stay ordered until acknowledgement' }, requestId);
    try {
      const result = await app.updateModelContext(value, { timeout: 120_000 });
      if ((result as { isError?: boolean }).isError) throw fail('NotAllowedError', 'Host refused context publication');
      inspector?.record('model-context.acknowledged', { modelConsumptionVerified: false }, requestId);
      return result;
    } catch (error) { inspector?.record('model-context.failed', { error }, requestId); throw error; }
  }
  return {
    connect(next: InkHostProviderObserver) {
      observer = next;
      next.update({
        capabilities: capabilities(),
        context: publicContext(app.getHostContext()),
      });
      inspector?.record('host.capabilities', { capabilities: capabilities(), context: publicContext(app.getHostContext()) });
      for (const notification of buffered) next.notify(notification);
      buffered = [];
      return {
        dispose: () => {
          observer = undefined;
          buffered = [];
        },
      };
    },
    contextChanged(context: unknown) {
      inspector?.record('host.context', publicContext(context));
      observer?.patchContext(publicContext(context));
    },
    input(input: JsonObject, partial = false) {
      notify({ type: partial ? 'partialInput' : 'input', input });
    },
    result(result: unknown) {
      notify({ type: 'result', result: hostToolResult(result) });
    },
    cancelled(reason?: string) {
      notify({ type: 'cancelled', reason });
    },
    disconnect() {
      observer?.disconnect();
      observer = undefined;
      buffered = [];
    },
    async request(
      request: Request,
      context: InkHostProviderRequestContext,
    ): Promise<unknown> {
      const requestId = `host:${JSON.stringify([request.session, request.realm, request.id])}`;
      inspector?.record('host.request', { operation: request.operation, payload: request.payload, revision: request.revision,
        timeoutMs: 120_000, cancellation: request.operation === 'conversation.updateContext' ? 'Before dispatch; in-flight writes wait for acknowledgement' : 'Ink AbortSignal',
        retries: 0 }, requestId);
      const execute = async () => {
        if (!capabilities().operations.includes(request.operation))
          throw fail('NotSupportedError', 'Host operation is unavailable');
        const options = { signal: context.signal, timeout: 120_000 };
        const { operation, payload } = request;
        switch (operation) {
          case 'conversation.updateContext': {
            const host = app.getHostCapabilities()!.updateModelContext!;
            if (payload.content !== undefined && !host.text)
              throw fail('NotSupportedError', 'Host context text is unavailable');
            if (
              payload.structuredContent !== undefined &&
              !host.structuredContent
            )
              throw fail(
                'NotSupportedError',
                'Structured host context is unavailable',
              );
            const key = `${request.session}:${request.realm}`;
            revisions.set(
              key,
              Math.max(revisions.get(key) || 0, request.revision),
            );
            const operation = contextTail.then(async () => {
              if (context.signal.aborted)
                throw fail('AbortError', 'Context publication cancelled');
              if (request.revision < revisions.get(key)!) { inspector?.record('model-context.skipped', { reason: 'Superseded before dispatch' }, requestId); return; }
              // Keep the provider queue until acknowledgement, even if Ink has timed
              // out. A newer snapshot must not overtake a remote write still in flight.
              const value = Object.keys(payload).length
                ? payload
                : {
                    ...(host.text ? { content: [] } : {}),
                    ...(host.structuredContent ? { structuredContent: {} } : {}),
                  };
              await publish(value, requestId);
              owner = key;
            });
            contextTail = operation.catch(() => {});
            await operation;
            return null;
          }
          case 'conversation.sendMessage': {
            const result = await app.sendMessage(
              { role: 'user', content: textContent(payload.content) },
              options,
            );
            if (result.isError)
              throw fail('NotAllowedError', 'Host refused message');
            return null;
          }
          case 'tools.call': {
            const result = await app.callServerTool(
              {
                name: payload.name,
                arguments: payload.input,
              },
              {
                ...options,
                onprogress: (progress) => {
                  inspector?.record('host.progress', progress, requestId);
                  context.onProgress({
                    value: progress.progress,
                    ...(progress.total !== undefined
                      ? { total: progress.total }
                      : {}),
                    ...(progress.message ? { message: progress.message } : {}),
                  });
                },
              },
            );
            const server = object(result._meta?.request);
            if (typeof server?.requestId === 'string') inspector?.record('host.server-link', {
              serverRequestId: server.requestId, policy: server.policy, state: server.state, attempt: server.attempt,
            }, requestId);
            return hostToolResult(result);
          }
          case 'resources.list': {
            const result = await app.listServerResources(
              payload.cursor === undefined
                ? {}
                : { cursor: payload.cursor },
              options,
            );
            return {
              resources: result.resources.map(
                ({ uri, name, description, mimeType }) => ({
                  uri,
                  name,
                  ...(description === undefined ? {} : { description }),
                  ...(mimeType === undefined ? {} : { mimeType }),
                }),
              ),
              ...(result.nextCursor === undefined
                ? {}
                : { nextCursor: result.nextCursor }),
            };
          }
          case 'resources.read': {
            const result = await app.readServerResource(
              { uri: payload.uri },
              options,
            );
            return result.contents.map((value) => ({
              uri: value.uri,
              ...(value.mimeType === undefined
                ? {}
                : { mimeType: value.mimeType }),
              ...('text' in value ? { text: value.text } : { blob: value.blob }),
            }));
          }
          default:
            throw fail('NotSupportedError', 'Host operation is unavailable');
        }
      };
      try {
        const result = await execute();
        inspector?.record('host.result', { state: 'ready', result }, requestId);
        return result;
      } catch (error) {
        inspector?.record('host.result', { state: context.signal.aborted ? 'cancelled' : 'error', error }, requestId);
        throw error;
      }
    },
    async release(binding: { session: string; realm: string }) {
      const key = `${binding.session}:${binding.realm}`;
      revisions.delete(key);
      const operation = contextTail.then(async () => {
        if (owner !== key) return;
        owner = undefined;
        const host = app.getHostCapabilities()?.updateModelContext;
        if (host)
          await publish(
            {
              ...(host.text ? { content: [] } : {}),
              ...(host.structuredContent ? { structuredContent: {} } : {}),
            },
            `release:${JSON.stringify([binding.session, binding.realm])}`,
          );
      });
      contextTail = operation.catch(() => {});
      await operation;
    },
  };
}
