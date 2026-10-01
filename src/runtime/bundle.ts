/** Wire format embedded in the View; binary data never passes through UTF-8. */
export type BundleEntry = { encoding: 'utf8' | 'base64'; data: string };

export function decodeBundle(files: Record<string, BundleEntry>): Record<string, string | Uint8Array> {
  return Object.fromEntries(Object.entries(files).map(([path, entry]) => [path, entry.encoding === 'utf8'
    ? entry.data : Uint8Array.from(atob(entry.data), char => char.charCodeAt(0))]));
}
