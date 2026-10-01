import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { handlers } from 'mcpkit:business-handlers';
import { businessToolExecutor, businessToolFailure } from './business-tools.js';
import { RequestLifecycle, type RequestPolicy } from './lifecycle.js';
import { inputValidator, type PageTool } from './page-tools.js';

declare const __APP_CONFIG__: { name: string; version: string; title: string; tools: PageTool[]; requestPolicy: RequestPolicy };
const config = __APP_CONFIG__;
const lifecycle = new RequestLifecycle(config.requestPolicy);
const viewMeta = {
  ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true },
  'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode: 'inline' },
};
const server = new McpServer({ name: config.name, version: config.version });
const htmlPath = fileURLToPath(new URL('../view.html', import.meta.url));

for (const tool of config.tools) {
  const uri = tool.resourceUri;
  const business = tool.outputSchema !== undefined;
  if (business && (!handlers || !Object.hasOwn(handlers, tool.name) || typeof handlers[tool.name] !== 'function')) throw new Error(`Missing business handler: ${tool.name}`);
  const execute = tool.outputSchema ? businessToolExecutor({ ...tool, outputSchema: tool.outputSchema }, handlers[tool.name]) : undefined;
  registerAppTool(server, tool.name, {
    title: business ? tool.title : `Open ${tool.title}`,
    description: tool.description,
    inputSchema: business ? z.custom<Record<string, unknown>>() : inputValidator(tool.inputSchema),
    _meta: {
      ui: { resourceUri: uri },
      'openai/ui': { entrypoints: [{ type: 'thread' }, { type: 'global' }] },
    },
  }, async (query: Record<string, unknown>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
    const request = lifecycle.start(async context => execute ? execute(query, context) : ({
      content: [{ type: 'text' as const, text: `${tool.title} opened.` }],
      _meta: { aiui: { page: tool.page, query } },
    }), { requestId: `${typeof extra.requestId}:${extra.requestId}`, signal: extra.signal,
      onChange: snapshot => {
        const token = extra._meta?.progressToken;
        if (token !== undefined && snapshot.state === 'pending' && snapshot.progress !== undefined) {
          const progress = snapshot.progress as { progress?: number; total?: number; message?: string };
          if (typeof progress.progress === 'number') void extra.sendNotification({ method: 'notifications/progress', params: {
            progressToken: token, progress: progress.progress, ...(typeof progress.total === 'number' ? { total: progress.total } : {}),
            ...(typeof progress.message === 'string' ? { message: progress.message } : {}),
          } }).catch(() => {});
        }
      },
    });
    try {
      const result = await request.result;
      return { ...result, _meta: { ...result._meta, request: request.snapshot() } };
    } catch (error) {
      if (business) {
        const failure = businessToolFailure(error);
        const snapshot = request.snapshot();
        // Unexpected exception messages may contain server credentials.
        if (snapshot.error) snapshot.error = { ...snapshot.error, message: String((failure._meta?.businessError as { message: string }).message) };
        return { ...failure, _meta: { ...failure._meta, aiui: { page: tool.page, query }, request: snapshot } };
      }
      return { isError: true, content: [{ type: 'text' as const, text: request.snapshot().error!.message }], _meta: { request: request.snapshot() } };
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
server.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: config.tools.map(tool => ({
  name: tool.name, title: tool.outputSchema ? tool.title : `Open ${tool.title}`, description: tool.description,
  inputSchema: tool.inputSchema, ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
  _meta: { requestPolicy: lifecycle.policy, ui: { resourceUri: tool.resourceUri }, 'ui/resourceUri': tool.resourceUri,
    'openai/ui': { entrypoints: [{ type: 'thread' }, { type: 'global' }] } },
})) }));

await server.connect(new StdioServerTransport());
