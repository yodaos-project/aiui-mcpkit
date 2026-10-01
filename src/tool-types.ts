import type { PageTool } from './runtime/page-tools.js';

type Schema = Record<string, unknown> | boolean;

/** Generate TypeScript from the validated, page-owned JSON Schemas. */
export function toolTypes(tools: PageTool[]): string {
  function typeOf(schema: Schema, root: Record<string, unknown>, seen = new Set<string>()): string {
    if (schema === false) return 'never';
    if (schema === true || !schema || typeof schema !== 'object') return 'unknown';
    if (typeof schema.$ref === 'string') {
      if (!schema.$ref.startsWith('#/') || seen.has(schema.$ref)) return 'unknown';
      let target: unknown = root;
      for (const part of schema.$ref.slice(2).split('/')) target = (target as Record<string, unknown>)?.[part.replaceAll('~1', '/').replaceAll('~0', '~')];
      return typeOf(target as Schema, root, new Set([...seen, schema.$ref]));
    }
    if ('const' in schema) return JSON.stringify(schema.const);
    if (Array.isArray(schema.enum)) return schema.enum.map(value => JSON.stringify(value)).join(' | ') || 'never';
    for (const key of ['oneOf', 'anyOf', 'allOf']) {
      if (Array.isArray(schema[key])) return (schema[key] as Schema[]).map(item => `(${typeOf(item, root, seen)})`).join(key === 'allOf' ? ' & ' : ' | ');
    }
    if (Array.isArray(schema.type)) return schema.type.map(type => typeOf({ ...schema, type }, root, seen)).join(' | ');
    switch (schema.type) {
      case 'string': return 'string';
      case 'integer': case 'number': return 'number';
      case 'boolean': return 'boolean';
      case 'null': return 'null';
      case 'array': {
        const tuple = schema.prefixItems ?? (Array.isArray(schema.items) ? schema.items : undefined);
        if (Array.isArray(tuple)) {
          const minimum = typeof schema.minItems === 'number' ? schema.minItems : 0;
          const entries = tuple.map((item, index) => `(${typeOf(item as Schema, root, seen)})${index < minimum ? '' : '?'}`);
          const tail = schema.prefixItems ? schema.items : schema.additionalItems;
          if (tail !== false) entries.push(`...Array<${typeOf((tail ?? true) as Schema, root, seen)}>`);
          return `[${entries.join(', ')}]`;
        }
        return `Array<${typeOf((schema.items ?? true) as Schema, root, seen)}>`;
      }
      case 'object': {
        const required = Array.isArray(schema.required) ? schema.required : [];
        const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties as Record<string, Schema> : {};
        const entries = Object.entries(properties).map(([key, value]) => `${JSON.stringify(key)}${required.includes(key) ? '' : '?'}: ${typeOf(value, root, seen)}`);
        // Unknown keywords must not imply a stronger static guarantee than the schema.
        const extra = schema.additionalProperties;
        if (extra !== false) entries.push('[key: string]: unknown');
        return `{ ${entries.join('; ')} }`;
      }
      default: return 'unknown';
    }
  }
  const map = (output: boolean) => tools.filter(tool => !output || tool.outputSchema).map(tool => {
    const schema = output ? tool.outputSchema! : tool.inputSchema;
    return `  ${JSON.stringify(tool.name)}: ${typeOf(schema, schema)};`;
  }).join('\n');
  return `// Generated from app.json.pages and .ink script def. Do not edit.\nimport type { BusinessToolHandler } from '@yodaos-pkg/aiui-mcpkit/tools';\n\nexport interface ToolInputs {\n${map(false)}\n}\nexport interface ToolOutputs {\n${map(true)}\n}\ntype ObjectType<Value> = unknown extends Value ? Record<string, unknown> : Extract<Value, object>;\nexport type BusinessHandlers = {\n  [Name in keyof ToolOutputs]: BusinessToolHandler<ObjectType<ToolInputs[Name]>, ObjectType<ToolOutputs[Name]>>;\n};\n`;
}
