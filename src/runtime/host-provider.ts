import type { App } from '@modelcontextprotocol/ext-apps';
import type {
  InkHostOperation,
  InkHostProviderRequest,
  InkHostProviderRequestContext,
} from '@yodaos-pkg/ink';

type JsonObject = Record<string, unknown>;
type Operation = InkHostOperation;
type Request = InkHostProviderRequest;
interface Observer {
  update(value: {
    capabilities: {
      operations: Operation[];
      contentTypes: 'text'[];
      toolListChanged: boolean;
      resourceListChanged: boolean;
    };
    context: JsonObject;
  }): void;
  patchContext(value: JsonObject): void;
  notify(value: JsonObject): void;
  disconnect(): void;
}
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
export function createMcpHostProvider(app: App) {
  let observer: Observer | undefined;
  let revision = 0;
  let buffered: JsonObject[] = [];
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
  const notify = (
    type: 'input' | 'partialInput' | 'result' | 'cancelled',
    value: JsonObject,
  ) => {
    // MCP Apps notifications do not carry an invocation ID. These revisions order
    // delivery only; they cannot prove correlation for overlapping host invocations.
    const notification = {
      type,
      invocationId: null,
      revision: ++revision,
      ...value,
    };
    if (observer) observer.notify(notification);
    else {
      buffered.push(notification);
      buffered = buffered.slice(-32);
    }
  };
  return {
    connect(next: Observer) {
      observer = next;
      next.update({
        capabilities: capabilities(),
        context: publicContext(app.getHostContext()),
      });
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
      observer?.patchContext(publicContext(context));
    },
    input(input: JsonObject, partial = false) {
      notify(partial ? 'partialInput' : 'input', { input });
    },
    result(result: unknown) {
      notify('result', { result: hostToolResult(result) });
    },
    cancelled(reason?: string) {
      notify('cancelled', { reason });
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
            if (request.revision < revisions.get(key)!) return;
            // Keep the provider queue until acknowledgement, even if Ink has timed
            // out. A newer snapshot must not overtake a remote write still in flight.
            const value = Object.keys(payload).length
              ? payload
              : {
                  ...(host.text ? { content: [] } : {}),
                  ...(host.structuredContent ? { structuredContent: {} } : {}),
                };
            const result = await app.updateModelContext(value, {
              timeout: 120_000,
            });
            if ((result as { isError?: boolean }).isError)
              throw fail('NotAllowedError', 'Host refused context publication');
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
              onprogress: (progress) =>
                context.onProgress({
                  value: progress.progress,
                  ...(progress.total !== undefined
                    ? { total: progress.total }
                    : {}),
                  ...(progress.message ? { message: progress.message } : {}),
                }),
            },
          );
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
    },
    async release(binding: { session: string; realm: string }) {
      const key = `${binding.session}:${binding.realm}`;
      revisions.delete(key);
      const operation = contextTail.then(async () => {
        if (owner !== key) return;
        owner = undefined;
        const host = app.getHostCapabilities()?.updateModelContext;
        if (host)
          await app.updateModelContext(
            {
              ...(host.text ? { content: [] } : {}),
              ...(host.structuredContent ? { structuredContent: {} } : {}),
            },
            { timeout: 120_000 },
          );
      });
      contextTail = operation.catch(() => {});
      await operation;
    },
  };
}
