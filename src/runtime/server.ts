import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { McpServer, type ServerContext, type CallToolResult, type Tool } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { registerAppResource, registerAppTool, getUiCapability, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { handlers } from 'mcpkit:business-handlers';
import { businessToolExecutor, businessToolFailure } from './business-tools.js';
import { RequestLifecycle, type RequestPolicy } from './lifecycle.js';
import { inputValidator, type PageTool } from './page-tools.js';

declare const __APP_CONFIG__: { name: string; version: string; title: string; tools: PageTool[]; requestPolicy: RequestPolicy };
const config = __APP_CONFIG__;
const viewMeta = {
  ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true },
  'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode: 'inline' },
};
// Validate handler coverage before accepting a connection (including discovery).
for (const tool of config.tools) {
  if (tool.outputSchema && (!handlers || !Object.hasOwn(handlers, tool.name) || typeof handlers[tool.name] !== 'function')) {
    throw new Error(`Missing business handler: ${tool.name}`);
  }
}

function createServer() {
  const lifecycle = new RequestLifecycle(config.requestPolicy);
  const server = new McpServer({ name: config.name, version: config.version });
  // Modern capabilities are request-scoped; never cache a tools/list decision.
  function supportsView(ctx: ServerContext) {
    const capabilities = ctx.mcpReq.envelope
      ? (ctx.mcpReq.envelope as Record<string, unknown>)['io.modelcontextprotocol/clientCapabilities']
      : server.server.getClientCapabilities();
    const mimeTypes = getUiCapability(capabilities as Parameters<typeof getUiCapability>[0])?.mimeTypes;
    return Array.isArray(mimeTypes) && mimeTypes.includes(RESOURCE_MIME_TYPE);
  }
  function toolMeta(tool: PageTool, ctx: ServerContext) {
    return { requestPolicy: lifecycle.policy,
      ...(supportsView(ctx) ? { ui: { resourceUri: tool.resourceUri }, 'ui/resourceUri': tool.resourceUri,
        'openai/ui': { entrypoints: [{ type: 'thread' }, { type: 'global' }] } } : {}),
      mcpkit: { ui: supportsView(ctx) ? 'available' : 'unavailable' },
    };
  }
  const htmlPath = fileURLToPath(new URL('../view.html', import.meta.url));

  for (const tool of config.tools) {
    const uri = tool.resourceUri;
    const business = tool.outputSchema !== undefined;
    const execute = tool.outputSchema ? businessToolExecutor({ ...tool, outputSchema: tool.outputSchema }, handlers[tool.name]) : undefined;
    registerAppTool(server, tool.name, {
      title: business ? tool.title : `Open ${tool.title}`,
      description: tool.description,
      inputSchema: business ? z.custom<Record<string, unknown>>() : inputValidator(tool.inputSchema),
      _meta: {
        ui: { resourceUri: uri },
        'openai/ui': { entrypoints: [{ type: 'thread' }, { type: 'global' }] },
      },
    }, async (query: Record<string, unknown>, extra: ServerContext) => {
      const ui = supportsView(extra);
      const uiMeta = { mcpkit: { ui: ui ? 'available' : 'unavailable' } };
      const request = lifecycle.start<CallToolResult>(async context => execute ? execute(query, context) : ({
        content: [{ type: 'text' as const, text: ui ? `${tool.title} opened.` : `${tool.title}: interactive view unavailable because this client does not advertise MCP Apps support (${RESOURCE_MIME_TYPE}). Arguments: ${JSON.stringify(query)}.` }],
        _meta: { aiui: { page: tool.page, query } },
      }), { requestId: `${typeof extra.mcpReq.id}:${extra.mcpReq.id}`, signal: extra.mcpReq.signal,
        onChange: snapshot => {
          const token = extra.mcpReq._meta?.progressToken;
          if (token !== undefined && snapshot.state === 'pending' && snapshot.progress !== undefined) {
            const progress = snapshot.progress as { progress?: number; total?: number; message?: string };
            if (typeof progress.progress === 'number') void extra.mcpReq.notify({ method: 'notifications/progress', params: {
              progressToken: token, progress: progress.progress, ...(typeof progress.total === 'number' ? { total: progress.total } : {}),
              ...(typeof progress.message === 'string' ? { message: progress.message } : {}),
            } }).catch(() => {});
          }
        },
      });
      try {
        const result = await request.result;
        return { ...result,
          content: execute && !ui && !result.isError ? [...result.content, { type: 'text' as const,
            text: 'Interactive view unavailable: this client does not advertise MCP Apps support. Business data is returned above.' }] : result.content,
          _meta: { ...result._meta, ...uiMeta, request: request.snapshot() } };
      } catch (error) {
        if (business) {
          const failure = businessToolFailure(error);
          const snapshot = request.snapshot();
          // Unexpected exception messages may contain server credentials.
          if (snapshot.error) snapshot.error = { ...snapshot.error, message: String((failure._meta?.businessError as { message: string }).message) };
          return { ...failure, _meta: { ...failure._meta, aiui: { page: tool.page, query }, ...uiMeta, request: snapshot } };
        }
        return { isError: true, content: [{ type: 'text' as const, text: request.snapshot().error!.message }], _meta: { ...uiMeta, request: request.snapshot() } };
      }
    });

    registerAppResource(server, tool.name, uri, {
      _meta: viewMeta,
    }, async () => ({ contents: [{
      uri,
      mimeType: RESOURCE_MIME_TYPE,
      text: (await readFile(htmlPath, 'utf8')).replace(/<body data-page="[^"]*">/, `<body data-page="${tool.page.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}">`),
      _meta: viewMeta,
    }] }));
  }

  // Advertise the original JSON Schema, without conversion-added constraints.
  server.server.setRequestHandler('tools/list', async (_request, ctx) => ({ tools: config.tools.map(tool => ({
    name: tool.name, title: tool.outputSchema ? tool.title : `Open ${tool.title}`, description: tool.description,
    inputSchema: tool.inputSchema as Tool['inputSchema'], ...(tool.outputSchema ? { outputSchema: tool.outputSchema as Tool['outputSchema'] } : {}),
    _meta: toolMeta(tool, ctx),
  })) }));

  return server;
}

serveStdio(createServer, { legacy: 'serve' });
