/** Optional browser-facing projection of the live Ink registry. */
export interface LiveTool {
  name: string;
  description?: string;
  inputSchema?: object;
  annotations?: { readOnlyHint?: boolean };
}
export interface WebTool extends LiveTool {
  execute(input: Record<string, unknown>, options: { signal: AbortSignal }): Promise<unknown>;
}
export interface WebRegistry {
  registerTool(tool: WebTool, options: { signal: AbortSignal }): Promise<void> | void;
}

/** Older desktop hosts still expose the pre-document registry API. */
export function browserWebRegistry(
  documentRegistry?: WebRegistry,
  legacy?: { registerTool(tool: WebTool): Promise<void> | void; unregisterTool(name: string): void },
): WebRegistry | undefined {
  if (documentRegistry) return documentRegistry;
  if (!legacy?.registerTool || !legacy.unregisterTool) return undefined;
  const pending = new Map<string, Promise<void>>();
  return { async registerTool(tool, { signal }) {
    const previous = pending.get(tool.name);
    const work = (async () => {
      if (previous) await previous.catch(() => {});
      signal.throwIfAborted();
      await legacy.registerTool(tool);
      if (signal.aborted) legacy.unregisterTool(tool.name);
      else signal.addEventListener('abort', () => legacy.unregisterTool(tool.name), { once: true });
    })();
    pending.set(tool.name, work);
    try { await work; }
    finally { if (pending.get(tool.name) === work) pending.delete(tool.name); }
  } };
}

export function mirrorWebTools(
  registry: WebRegistry | undefined,
  list: () => Promise<LiveTool[]>,
  execute: (name: string, input: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>,
) {
  let revision = 0;
  const registrations = new Map<string, { signature: string; controller: AbortController }>();
  const lifetime = new AbortController();
  return {
    async sync() {
      if (!registry || lifetime.signal.aborted) return;
      const version = ++revision;
      const tools = await list();
      if (version !== revision || lifetime.signal.aborted) return;
      const names = new Set(tools.map(tool => tool.name));
      for (const [name, entry] of registrations) {
        if (!names.has(name)) { entry.controller.abort(); registrations.delete(name); }
      }
      for (const tool of tools) {
        if (version !== revision || lifetime.signal.aborted) return;
        const signature = JSON.stringify(tool);
        const previous = registrations.get(tool.name);
        if (previous?.signature === signature) continue;
        previous?.controller.abort();
        const current = new AbortController();
        registrations.set(tool.name, { signature, controller: current });
        try {
          await registry.registerTool({
            name: tool.name, description: tool.description || tool.name,
            inputSchema: { ...tool.inputSchema, type: 'object' },
            ...(typeof tool.annotations?.readOnlyHint === 'boolean'
              ? { annotations: { readOnlyHint: tool.annotations.readOnlyHint } } : {}),
            execute: (input, options) => {
              const signal = AbortSignal.any([options.signal, current.signal, lifetime.signal]);
              signal.throwIfAborted();
              return execute(tool.name, input, signal);
            },
          }, { signal: current.signal });
        } catch (error) {
          current.abort();
          if (registrations.get(tool.name)?.controller === current) registrations.delete(tool.name);
          throw error;
        }
      }
    },
    close() { revision++; for (const entry of registrations.values()) entry.controller.abort(); registrations.clear(); lifetime.abort(); },
  };
}
