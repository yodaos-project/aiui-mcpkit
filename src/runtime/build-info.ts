/** Public identity shared by generated artifacts, protocol metadata and Views. */
export interface BuildIdentity {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
}

export function viewBuildId(html: string): string | null {
  return /<meta name="mcpkit-build-id" content="([a-f0-9]{64})">/.exec(html)?.[1] ?? null;
}
