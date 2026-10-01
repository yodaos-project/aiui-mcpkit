import { CallToolResultSchema } from '@modelcontextprotocol/core';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { inputValidator } from './page-tools.js';
import { RequestLifecycleError, type RequestContext } from './lifecycle.js';

/** A serializable business contract. Handlers are supplied in a server-only module. */
export interface BusinessToolDefinition<Name extends string = string> {
  name: Name;
  title: string;
  description: string;
  page: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}
export interface BusinessToolResult<Output extends object> {
  /** Model-visible summary/content blocks. */
  content: CallToolResult['content'];
  /** Model-visible structured data, validated against outputSchema. */
  structuredContent: Output;
  /** UI-only data, returned under _meta.uiOnly. */
  uiOnly?: Record<string, unknown>;
}
export type BusinessToolHandler<Input extends object, Output extends object> =
  (input: Input, context: RequestContext) => BusinessToolResult<Output> | Promise<BusinessToolResult<Output>>;
/** Expected business failures may expose a safe code/message and UI-only details. */
export class BusinessToolError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: Record<string, unknown>) {
    super(message); this.name = 'BusinessToolError';
  }
}

export function businessToolExecutor(tool: BusinessToolDefinition, handler: BusinessToolHandler<Record<string, unknown>, Record<string, unknown>>) {
  const input = inputValidator(tool.inputSchema, 'inputSchema');
  const output = inputValidator(tool.outputSchema, 'outputSchema');
  return async (query: Record<string, unknown>, context: RequestContext): Promise<CallToolResult> => {
    if (!input.safeParse(query).success) throw new BusinessToolError('INVALID_INPUT', 'Tool arguments do not match the input schema.');
    const result = await handler(query, context);
    if (!result || !output.safeParse(result.structuredContent).success) throw new BusinessToolError('INVALID_OUTPUT', 'Tool result does not match the output schema.');
    const response = {
      content: result.content, structuredContent: result.structuredContent,
      _meta: { aiui: { page: tool.page, query }, ...(result.uiOnly === undefined ? {} : { uiOnly: result.uiOnly }) },
    };
    if (!Array.isArray(result.content) || !CallToolResultSchema.safeParse(response).success || (result.uiOnly !== undefined && (!result.uiOnly || typeof result.uiOnly !== 'object' || Array.isArray(result.uiOnly)))) {
      throw new BusinessToolError('INVALID_OUTPUT', 'Tool result is not a valid MCP response.');
    }
    let encoded: CallToolResult;
    try { encoded = JSON.parse(JSON.stringify(response)); } catch { throw new BusinessToolError('INVALID_OUTPUT', 'Tool result must be JSON serializable.'); }
    // Validate the actual wire data as well (e.g. a custom toJSON may change it).
    if (!output.safeParse(encoded.structuredContent).success || !CallToolResultSchema.safeParse(encoded).success ||
        (encoded._meta?.uiOnly !== undefined && (!encoded._meta.uiOnly || typeof encoded._meta.uiOnly !== 'object' || Array.isArray(encoded._meta.uiOnly)))) {
      throw new BusinessToolError('INVALID_OUTPUT', 'Serialized tool result does not match its contract.');
    }
    return encoded;
  };
}
export function businessToolFailure(error: unknown): CallToolResult {
  const expected = error instanceof BusinessToolError;
  const lifecycle = error instanceof RequestLifecycleError;
  const code = expected ? error.code : lifecycle ? error.code.toUpperCase() : 'INTERNAL_ERROR';
  const message = expected || lifecycle ? error.message : 'Tool execution failed.';
  let uiOnly: Record<string, unknown> | undefined;
  if (expected && error.details !== undefined) {
    try {
      const encoded = JSON.parse(JSON.stringify(error.details));
      if (encoded && typeof encoded === 'object' && !Array.isArray(encoded)) uiOnly = encoded;
    } catch { /* Malformed UI details must not prevent an error response. */ }
  }
  return {
    isError: true, content: [{ type: 'text', text: `${code}: ${message}` }],
    _meta: { businessError: { code, message }, ...(uiOnly !== undefined ? { uiOnly } : {}) },
  };
}
