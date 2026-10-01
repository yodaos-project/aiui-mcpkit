import type { ClientCapabilities, Tool, Resource } from '@modelcontextprotocol/server';
import { getUiCapability, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import type { PageTool } from './page-tools.js';
import type { RequestPolicy } from './lifecycle.js';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
/** Public protocol metadata. Never put credentials or server configuration here. */
export type PublicMetadata = { [key: string]: JsonValue };
/** An additional public HTML View served by the generated MCP server. */
export interface UiResource {
  uri: string;
  name: string;
  description?: string;
  html: string;
  _meta?: PublicMetadata;
}
export interface MetadataOptions {
  /** Narrow CSP defaults. Conflicting declarations in resourceMetadata are rejected. */
  uiCsp?: { connectDomains?: string[]; resourceDomains?: string[] };
  /** Per-tool _meta, keyed by a discovered tool name. */
  toolMetadata?: Record<string, PublicMetadata>;
  /** Defaults merged into every generated and custom resource's _meta. */
  resourceMetadata?: PublicMetadata;
  /** Public HTML resources referenced by toolMetadata[name].ui.resourceUri. */
  uiResources?: UiResource[];
}
export interface ProtocolResource extends Resource {
  /** Present only for generated AIUI resources. */
  page?: string;
  /** Present only for author-provided resources; excluded from inspection. */
  html?: string;
}
export interface ProtocolModel {
  name: string;
  tools: PageTool[];
  toolMetadata: Record<string, PublicMetadata>;
  resources: ProtocolResource[];
  requestPolicy: RequestPolicy;
}
export interface ProtocolInspection {
  tools: Tool[];
  resources: Resource[];
  /** Exact generated mcp.json connection descriptor; contains no env or secrets. */
  connection: ReturnType<typeof connectionConfig>;
}

const resourceDefaults: PublicMetadata = {
  ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true },
  'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode: 'inline' },
};
const toolDefaults: PublicMetadata = { 'openai/ui': { entrypoints: [{ type: 'thread' }, { type: 'global' }] } };
const reserved = new Set(['requestPolicy', 'mcpkit', 'aiui', 'request', 'uiOnly', 'businessError']);
const privateKey = /^(authorization|proxy-authorization|password|secret|token|api[-_]?key|access[-_]?token|refresh[-_]?token|client[-_]?secret|credentials|env|headers)$/i;

function validateDomains(domains: JsonValue, label: string, key: string): void {
  if (!Array.isArray(domains) || domains.some(v => typeof v !== 'string')) throw new Error(`${label}: expected a supported domain list.`);
  for (const domain of domains as string[]) {
    if (key === 'resourceDomains' && ['blob:', 'data:'].includes(domain)) continue;
    const protocols = key === 'connectDomains' ? ['https:', 'http:', 'wss:', 'ws:'] : ['https:', 'http:'];
    // Origins only; no global wildcard, credentials, paths, CSP keywords or directives.
    if (!/^(?:https?|wss?):\/\/(?:\*\.)?[^\s/?#@*]+\/?$/.test(domain)) throw new Error(`${label}: expected an HTTP(S) origin${key === 'connectDomains' ? ' or WS(S) origin' : ''}; optional wildcard subdomain, no credentials, paths, query or fragment.`);
    let url: URL;
    try { url = new URL(domain.replace('://*.', '://')); }
    catch { throw new Error(`${label}: invalid domain origin.`); }
    if (!protocols.includes(url.protocol) || !url.hostname || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error(`${label}: invalid domain origin.`);
    if (url.origin !== domain.replace('://*.', '://').replace(/\/$/, '')) throw new Error(`${label}: use a canonical origin without a trailing slash or default port.`);
    if (domain.endsWith('/')) throw new Error(`${label}: use an origin without a trailing slash.`);
  }
}

// Reject lossy serialization, accessors and prototype pollution before any output
// is written. Diagnostics use field paths only, never rejected values.
function publicJson(value: unknown, label: string, ancestors = new Set<object>()): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || ancestors.has(value)) throw new Error(`${label}: expected finite, acyclic JSON data.`);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Error(`${label}: expected a plain JSON object.`);
  if (Object.getOwnPropertySymbols(value).length) throw new Error(`${label}: symbol keys are not public JSON data.`);
  ancestors.add(value);
  const entries = Object.entries(Object.getOwnPropertyDescriptors(value)).filter(([key]) => !(Array.isArray(value) && key === 'length'));
  const result: Record<string, JsonValue> = {};
  for (const [key, descriptor] of entries) {
    if (['__proto__', 'constructor', 'prototype', 'toJSON'].includes(key) || privateKey.test(key)) throw new Error(`${label}: forbidden public field ${key}.`);
    if (!descriptor.enumerable || !('value' in descriptor)) throw new Error(`${label}.${key}: accessors and hidden fields are not supported.`);
    result[key] = publicJson(descriptor.value, `${label}.${key}`, ancestors);
  }
  ancestors.delete(value);
  if (Array.isArray(value)) {
    if (entries.length !== value.length || entries.some(([key], i) => key !== String(i))) throw new Error(`${label}: expected a dense JSON array.`);
    return entries.map(([key]) => result[key]);
  }
  return result;
}
function metadata(value: unknown, label: string, kind: 'tool' | 'resource'): PublicMetadata {
  const result = publicJson(value, label);
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(`${label}: expected a metadata object.`);
  for (const key of Object.keys(result)) {
    if (reserved.has(key) || key.startsWith('io.modelcontextprotocol/')) throw new Error(`${label}: reserved framework/protocol field ${key}.`);
  }
  if (kind === 'resource' && 'ui/resourceUri' in result) throw new Error(`${label}: UI resource references belong on tool metadata.`);
  if ('ui' in result) {
    const ui = result.ui;
    if (!ui || typeof ui !== 'object' || Array.isArray(ui)) throw new Error(`${label}.ui: expected an object.`);
    const misplaced = kind === 'tool' ? ['csp', 'permissions', 'domain', 'prefersBorder'] : ['resourceUri', 'visibility'];
    if (misplaced.some(key => key in ui)) throw new Error(`${label}.ui: field belongs on ${kind === 'tool' ? 'resource' : 'tool'} metadata.`);
    if ('resourceUri' in ui) resourceUri(ui.resourceUri, `${label}.ui.resourceUri`);
    if ('prefersBorder' in ui && typeof ui.prefersBorder !== 'boolean') throw new Error(`${label}.ui.prefersBorder: expected a boolean.`);
    if ('domain' in ui && typeof ui.domain !== 'string') throw new Error(`${label}.ui.domain: expected a string.`);
    if ('visibility' in ui && (!Array.isArray(ui.visibility) || ui.visibility.some(v => v !== 'model' && v !== 'app'))) throw new Error(`${label}.ui.visibility: expected model/app values.`);
    if ('permissions' in ui) {
      if (!ui.permissions || typeof ui.permissions !== 'object' || Array.isArray(ui.permissions)) throw new Error(`${label}.ui.permissions: expected an object.`);
      for (const [key, permission] of Object.entries(ui.permissions)) {
        if (!['camera', 'microphone', 'geolocation', 'clipboardWrite'].includes(key) || !permission || typeof permission !== 'object' || Array.isArray(permission) || Object.keys(permission).length) throw new Error(`${label}.ui.permissions.${key}: expected a supported permission with an empty object.`);
      }
    }
    if ('csp' in ui) {
      if (!ui.csp || typeof ui.csp !== 'object' || Array.isArray(ui.csp)) throw new Error(`${label}.ui.csp: expected an object.`);
      for (const [key, domains] of Object.entries(ui.csp)) {
        if (!['connectDomains', 'resourceDomains', 'frameDomains', 'baseUriDomains'].includes(key)) throw new Error(`${label}.ui.csp.${key}: expected a supported domain list.`);
        validateDomains(domains, `${label}.ui.csp.${key}`, key);
      }
    }
  }
  return result;
}
function resourceUri(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^ui:\/\/[^\s?#]+$/.test(value)) throw new Error(`${label}: expected a ui:// resource URI without query or fragment.`);
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${label}: invalid public UI resource URI.`); }
  if (url.username || url.password || !url.hostname || url.href !== value) throw new Error(`${label}: invalid public UI resource URI.`);
}
/** Objects merge recursively; author scalars, arrays and null replace defaults. */
function merge(base: PublicMetadata, author: PublicMetadata): PublicMetadata {
  const result = { ...base };
  for (const [key, value] of Object.entries(author)) {
    const prior = result[key];
    result[key] = value && typeof value === 'object' && !Array.isArray(value) && prior && typeof prior === 'object' && !Array.isArray(prior)
      ? merge(prior, value) : value;
  }
  return result;
}

export function prepareProtocol(name: string, tools: PageTool[], requestPolicy: RequestPolicy, options: MetadataOptions): ProtocolModel {
  const resourceMeta = metadata(options.resourceMetadata === undefined ? {} : options.resourceMetadata, 'resourceMetadata', 'resource');
  if (options.uiCsp !== undefined) {
    const value = publicJson(options.uiCsp, 'uiCsp');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('uiCsp: expected an object.');
    for (const [key, domains] of Object.entries(value)) {
      if (!['connectDomains', 'resourceDomains'].includes(key)) throw new Error(`uiCsp.${key}: unsupported CSP field.`);
      validateDomains(domains, `uiCsp.${key}`, key);
    }
    const ui = (resourceMeta.ui ?? {}) as PublicMetadata;
    const csp = (ui.csp ?? {}) as PublicMetadata;
    for (const [key, domains] of Object.entries(value)) {
      if (key in csp && JSON.stringify([...new Set(csp[key] as string[])].sort()) !== JSON.stringify([...new Set(domains as string[])].sort())) throw new Error(`uiCsp.${key}: conflicts with resourceMetadata.ui.csp.${key}.`);
    }
    resourceMeta.ui = { ...ui, csp: { ...csp, ...value } };
  }
  const resources: ProtocolResource[] = tools.map(tool => ({ name: tool.name, uri: tool.resourceUri, mimeType: RESOURCE_MIME_TYPE,
    page: tool.page, _meta: merge(resourceDefaults, resourceMeta) }));
  const custom = options.uiResources === undefined ? [] : options.uiResources;
  if (!Array.isArray(custom)) throw new Error('uiResources must be an array.');
  for (const resource of custom) {
    if (!resource || typeof resource !== 'object') throw new Error('uiResources: expected a resource object.');
    resourceUri(resource.uri, 'uiResources.uri');
    if (resources.some(r => r.uri === resource.uri)) throw new Error('uiResources: duplicate resource URI.');
    if (typeof resource.name !== 'string' || !resource.name.trim() || typeof resource.html !== 'string' || !resource.html.trim() || (resource.description !== undefined && typeof resource.description !== 'string')) throw new Error('uiResources: name and HTML must be nonempty strings; description must be a string.');
    const meta = merge(merge(resourceDefaults, resourceMeta), metadata(resource._meta === undefined ? {} : resource._meta, 'uiResources._meta', 'resource'));
    resources.push({ uri: resource.uri, name: resource.name, ...(resource.description === undefined ? {} : { description: resource.description }),
      mimeType: RESOURCE_MIME_TYPE, html: resource.html, _meta: meta });
  }
  const overrides = options.toolMetadata === undefined ? {} : options.toolMetadata;
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides) || (Object.getPrototypeOf(overrides) !== Object.prototype && Object.getPrototypeOf(overrides) !== null)) throw new Error('toolMetadata must be keyed by tool name.');
  if (Object.getOwnPropertySymbols(overrides).length) throw new Error('toolMetadata: symbol tool names are not supported.');
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(overrides))) {
    if (!descriptor.enumerable || !('value' in descriptor)) throw new Error('toolMetadata: accessors and hidden fields are not supported.');
    if (!tools.some(tool => tool.name === key)) throw new Error(`toolMetadata: unknown tool ${key}.`);
  }
  const toolMetadata: Record<string, PublicMetadata> = Object.create(null);
  const mapped = tools.map(tool => {
    const meta = metadata(Object.hasOwn(overrides, tool.name) ? overrides[tool.name] : {}, `toolMetadata.${tool.name}`, 'tool');
    const ui = meta.ui as PublicMetadata | undefined;
    const canonical = ui?.resourceUri;
    const alias = meta['ui/resourceUri'];
    if (alias !== undefined) resourceUri(alias, `toolMetadata.${tool.name}.ui/resourceUri`);
    if (canonical !== undefined && alias !== undefined && canonical !== alias) throw new Error(`toolMetadata.${tool.name}: conflicting UI resource references.`);
    const uri = canonical ?? alias ?? tool.resourceUri;
    if (!resources.some(resource => resource.uri === uri)) throw new Error(`toolMetadata.${tool.name}: UI resource reference is not registered.`);
    toolMetadata[tool.name] = merge(toolDefaults, meta);
    return { ...tool, resourceUri: uri as string };
  });
  return JSON.parse(JSON.stringify({ name, tools: mapped, toolMetadata, resources, requestPolicy }));
}
export function supportsView(capabilities?: ClientCapabilities): boolean {
  const mimeTypes = getUiCapability(capabilities)?.mimeTypes;
  return Array.isArray(mimeTypes) && mimeTypes.includes(RESOURCE_MIME_TYPE);
}
export function connectionConfig(name: string) {
  return { $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
    mcpServers: { [name]: { type: 'stdio' as const, command: 'node', args: ['${PLUGIN_ROOT}/dist/server.mjs'], cwd: '${PLUGIN_ROOT}' } } };
}
/** Shares serialization with runtime handlers; returns fresh, public JSON only. */
export function inspectProtocol(model: ProtocolModel, clientCapabilities?: ClientCapabilities): ProtocolInspection {
  const ui = supportsView(clientCapabilities);
  const tools: Tool[] = model.tools.map(tool => {
    const meta = merge(model.toolMetadata[tool.name], { requestPolicy: model.requestPolicy as unknown as PublicMetadata, mcpkit: { ui: ui ? 'available' : 'unavailable' } });
    if (ui) {
      meta.ui = { ...meta.ui as PublicMetadata, resourceUri: tool.resourceUri };
      meta['ui/resourceUri'] = tool.resourceUri;
    } else {
      delete meta.ui; delete meta['ui/resourceUri']; delete meta['openai/ui'];
    }
    return { name: tool.name, title: tool.outputSchema ? tool.title : `Open ${tool.title}`, description: tool.description,
      inputSchema: tool.inputSchema as Tool['inputSchema'], ...(tool.outputSchema ? { outputSchema: tool.outputSchema as Tool['outputSchema'] } : {}), _meta: meta };
  });
  return JSON.parse(JSON.stringify({ tools, resources: model.resources.map(({ page, html, ...resource }) => resource), connection: connectionConfig(model.name) }));
}
