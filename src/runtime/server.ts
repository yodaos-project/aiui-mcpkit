import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';

declare const __APP_CONFIG__: { name: string; version: string; title: string; description: string; tool: string };
const config = __APP_CONFIG__;
const uri = `ui://${config.name}/app.html`;
const viewMeta = {
  ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true },
  'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode: 'inline' },
};
const server = new McpServer({ name: config.name, version: config.version });
const htmlPath = fileURLToPath(new URL('../view.html', import.meta.url));

registerAppTool(server, config.tool, {
  title: `Open ${config.title}`,
  description: config.description,
  inputSchema: {},
  _meta: { ui: { resourceUri: uri } },
}, async () => ({ content: [{ type: 'text', text: `${config.title} opened.` }] }));

registerAppResource(server, config.title, uri, {
  _meta: viewMeta,
}, async () => ({ contents: [{
  uri,
  mimeType: RESOURCE_MIME_TYPE,
  text: await readFile(htmlPath, 'utf8'),
  _meta: viewMeta,
}] }));

await server.connect(new StdioServerTransport());
