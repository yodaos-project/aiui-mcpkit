import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';

const uri = 'ui://aiui-mcpkit/counter.html';
const viewMeta = {
  ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true },
  'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode: 'inline' },
};
const server = new McpServer({ name: 'aiui-mcpkit', version: '0.1.0' });
const htmlPath = fileURLToPath(new URL('../view.html', import.meta.url));

registerAppTool(server, 'open_counter', {
  title: 'Open AIUI Counter',
  description: 'Open an interactive Ink-rendered counter with inline and fullscreen modes.',
  inputSchema: {},
  _meta: { ui: { resourceUri: uri } },
}, async () => ({ content: [{ type: 'text', text: 'AIUI counter opened. Use the view to increment or change display mode.' }] }));

registerAppResource(server, 'AIUI Counter', uri, {
  _meta: viewMeta,
}, async () => ({ contents: [{
  uri,
  mimeType: RESOURCE_MIME_TYPE,
  text: await readFile(htmlPath, 'utf8'),
  _meta: viewMeta,
}] }));

await server.connect(new StdioServerTransport());
