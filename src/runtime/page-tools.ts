import { z } from 'zod';
import { Ajv } from 'ajv';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { Ajv2019 } from 'ajv/dist/2019.js';
import formatsPlugin, { type FormatsPlugin } from 'ajv-formats';

/** A page-backed MCP tool discovered while building an Agent. */
export interface PageTool {
  name: string;
  title: string;
  description: string;
  page: string;
  inputSchema: Record<string, unknown>;
  resourceUri: string;
  /** Named shared application registered by the builder. */
  application?: string;
  /** schema.output in the page definition marks a server business tool. */
  outputSchema?: Record<string, unknown>;
}

export function inputValidator(schema: Record<string, unknown>, label = 'schema.data') {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema) || schema.type !== 'object') throw new Error(`${label} must have type "object".`);
  if (schema.$async) throw new Error('Async input schemas are not supported.');
  const options = { strict: false, allErrors: true };
  const dialect = schema.$schema;
  const ajv = typeof dialect === 'string' && dialect.includes('2020-12') ? new Ajv2020(options)
    : typeof dialect === 'string' && dialect.includes('2019-09') ? new Ajv2019(options) : new Ajv(options);
  (formatsPlugin as unknown as FormatsPlugin)(ajv);
  const validate = ajv.compile(schema);
  // The SDK accepts Zod validators; JSON Schema remains the source of truth.
  return z.custom<Record<string, unknown>>().superRefine((value, context) => {
    if (!validate(value)) context.addIssue({ code: 'custom', message: ajv.errorsText(validate.errors) });
  });
}

export function pageTools(files: Record<string, string>, pages: string[], name: string): PageTool[] {
  const tools: PageTool[] = [];
  for (const page of pages) {
    const source = files[`${page}.ink`];
    if (source === undefined) throw new Error(`Page not found: ${page}.ink`);
    // Skip complete script bodies so strings in setup scripts cannot become definitions.
    const definitions = [...source.matchAll(/<script\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/script\s*>/gi)]
      .filter(match => /(?:^|\s)def(?=\s|=|$)/i.test(match[1].replace(/"[^"]*"|'[^']*'/g, '""')));
    if (definitions.length > 1) throw new Error(`${page}.ink: multiple script def blocks.`);
    if (!definitions.length) continue;
    try {
      const definition = JSON.parse(definitions[0][2]);
      if (!definition || typeof definition !== 'object' || Array.isArray(definition)) throw new Error('script def must be a JSON object.');
      if (definition.tools !== undefined && definition.schema !== undefined) throw new Error('Use tools or schema, not both.');
      const declarations = definition.tools ?? (definition.schema === undefined ? [] : [definition]);
      if (!Array.isArray(declarations) || !declarations.length) {
        if (definition.tools !== undefined) throw new Error('tools must be a nonempty array.');
        continue;
      }
      for (const declaration of declarations) {
        const schema = declaration.schema?.data;
        if (!schema || typeof schema !== 'object' || Array.isArray(schema)) throw new Error('schema.data must be a JSON object.');
        inputValidator(schema);
        const output = declaration.schema.output;
        if (output !== undefined) inputValidator(output, 'schema.output');
        const tool = declaration.tool ?? `open_${page.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        if (typeof tool !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(tool)) throw new Error('tool must contain 1–128 letters, numbers, underscores, or hyphens.');
        if (tools.some(item => item.name === tool)) throw new Error(`Duplicate tool name: ${tool}`);
        if (typeof declaration.description !== 'string' || !declaration.description.trim()) throw new Error('A page tool requires a nonempty description.');
        const title = definition.navigationBarTitleText ?? page;
        if (typeof title !== 'string' || !title.trim()) throw new Error('navigationBarTitleText must be a nonempty string.');
        const application = declaration.application ?? definition.application;
        if (application !== undefined && (typeof application !== 'string' || !/^[a-z][a-z0-9-]*$/.test(application))) throw new Error('application must be a lowercase identifier.');
        tools.push({ name: tool, title, description: declaration.description, page, inputSchema: schema, ...(output === undefined ? {} : { outputSchema: output }), ...(application === undefined ? {} : { application }), resourceUri: `ui://${name}/${tool}.html` });
      }
    } catch (error) {
      throw new Error(`${page}.ink: ${error instanceof Error ? error.message : error}`);
    }
  }
  return tools;
}
