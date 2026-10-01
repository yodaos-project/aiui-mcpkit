declare module 'mcpkit:business-handlers' {
  export const handlers: Record<string, import('./business-tools.js').BusinessToolHandler<Record<string, unknown>, Record<string, unknown>>>;
}
