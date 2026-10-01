import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { McpServer, type ServerContext, type CallToolResult, type ClientCapabilities } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { handlers } from 'mcpkit:business-handlers';
import { businessToolExecutor, businessToolFailure } from './business-tools.js';
import { RequestLifecycle, type RequestPolicy } from './lifecycle.js';
import { inputValidator, type PageTool } from './page-tools.js';
import { inspectProtocol, supportsView, type ProtocolModel, type PublicMetadata } from './metadata.js';

declare const __APP_CONFIG__: { name: string; version: string; title: string; tools: PageTool[]; protocol: ProtocolModel; requestPolicy: RequestPolicy };
const config = __APP_CONFIG__;
// Validate handler coverage before accepting a connection (including discovery).
for (const tool of config.tools) {
  if (tool.outputSchema && (!handlers || !Object.hasOwn(handlers, tool.name) || typeof handlers[tool.name] !== 'function')) {
    throw new Error(`Missing business handler: ${tool.name}`);
  }
}

function createServer() {
  const lifecycle = new RequestLifecycle(config.requestPolicy);
  const server = new McpServer({ name: config.name, version: config.version });
  // Modern capabilities are request-scoped; legacy capabilities come from initialize.
  function capabilities(ctx: ServerContext): ClientCapabilities | undefined {
    return ctx.mcpReq.envelope
      ? (ctx.mcpReq.envelope as Record<string, unknown>)['io.modelcontextprotocol/clientCapabilities'] as ClientCapabilities
      : server.server.getClientCapabilities();
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
        ...config.protocol.toolMetadata[tool.name],
        ui: { ...config.protocol.toolMetadata[tool.name].ui as PublicMetadata, resourceUri: uri },
      },
    }, async (query: Record<string, unknown>, extra: ServerContext) => {
      const ui = supportsView(capabilities(extra));
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
  }

  for (const resource of config.protocol.resources) {
    const { page, html, name, uri, ...metadata } = resource;
    registerAppResource(server, name, uri, metadata, async () => ({ contents: [{
      uri, mimeType: RESOURCE_MIME_TYPE,
      text: html ?? (await readFile(htmlPath, 'utf8')).replace(/<body data-page="[^"]*">/,
        `<body data-page="${page!.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}">`),
      _meta: metadata._meta,
    }] }));
  }

  // Build inspection and live discovery use the same capability-aware serializer.
  server.server.setRequestHandler('tools/list', async (_request, ctx) => ({ tools: inspectProtocol(config.protocol, capabilities(ctx)).tools }));
  server.server.setRequestHandler('resources/list', async (_request, ctx) => ({ resources: inspectProtocol(config.protocol, capabilities(ctx)).resources }));

  return server;
}

serveStdio(createServer, { legacy: 'serve' });
