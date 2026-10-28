/** Explicit, application-published business failure. Unexpected exceptions stay private. */
export class BusinessToolError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: Record<string, unknown>) {
    super(message); this.name = 'BusinessToolError';
  }
}
