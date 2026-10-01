import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
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
  registerAppTool(server, tool.name, {
    title: `Open ${tool.title}`,
    description: tool.description,
    inputSchema: inputValidator(tool.inputSchema),
    _meta: {
      ui: { resourceUri: uri },
      'openai/ui': { entrypoints: [{ type: 'thread' }, { type: 'global' }] },
    },
  }, async (query: Record<string, unknown>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
    const request = lifecycle.start(async () => ({
      content: [{ type: 'text' as const, text: `${tool.title} opened.` }],
      _meta: { aiui: { page: tool.page, query } },
    }), { requestId: `${typeof extra.requestId}:${extra.requestId}`, signal: extra.signal });
    try {
      const result = await request.result;
      return { ...result, _meta: { ...result._meta, request: request.snapshot() } };
    } catch {
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
  name: tool.name, title: `Open ${tool.title}`, description: tool.description,
  inputSchema: tool.inputSchema,
  _meta: { requestPolicy: lifecycle.policy, ui: { resourceUri: tool.resourceUri }, 'ui/resourceUri': tool.resourceUri,
    'openai/ui': { entrypoints: [{ type: 'thread' }, { type: 'global' }] } },
})) }));

await server.connect(new StdioServerTransport());
