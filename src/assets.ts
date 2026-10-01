import { extname } from 'node:path';
import type { BundleEntry } from './runtime/bundle.js';

export interface AssetLimits {
  /** Optional per-file byte limit, checked before writing output. */
  maxAssetBytes?: number;
  /** Optional final UTF-8 View HTML byte limit (including runtime and WASM). */
  maxViewBytes?: number;
}
export interface AssetInfo {
  path: string;
  bytes: number;
  encoding: BundleEntry['encoding'];
  mimeType: string;
}
export interface BuildDiagnostic {
  code: 'UNSUPPORTED_FORMAT' | 'EXTERNAL_REFERENCE' | 'HOST_REQUIREMENT' | 'LARGE_ASSET';
  message: string;
  path?: string;
}
export interface AssetReport {
  files: AssetInfo[];
  totalBytes: number;
  viewBytes: number;
  diagnostics: BuildDiagnostic[];
}
const textTypes: Record<string, string> = {
  '.ink': 'text/plain', '.json': 'application/json', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.cjs': 'text/javascript', '.ts': 'text/plain', '.css': 'text/css', '.html': 'text/html',
  '.svg': 'image/svg+xml', '.txt': 'text/plain', '.md': 'text/markdown', '.xml': 'application/xml',
};
const binaryTypes: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
};
export function validateAssetLimits(limits: AssetLimits = {}): AssetLimits {
  if (!limits || typeof limits !== 'object' || Array.isArray(limits)) throw new Error('assetLimits must be an object.');
  for (const [key, value] of Object.entries(limits)) {
    if (!['maxAssetBytes', 'maxViewBytes'].includes(key) || !Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`assetLimits.${key}: expected a positive safe integer byte limit.`);
    }
  }
  return { ...limits };
}
export function packageAsset(path: string, bytes: Uint8Array, limits: AssetLimits, report: AssetReport): BundleEntry {
  if (limits.maxAssetBytes !== undefined && bytes.byteLength > limits.maxAssetBytes) {
    throw new Error(`Asset ${path}: ${bytes.byteLength} bytes exceeds maxAssetBytes (${limits.maxAssetBytes}).`);
  }
  const extension = extname(path).toLowerCase();
  const mimeType = textTypes[extension] ?? binaryTypes[extension] ?? 'application/octet-stream';
  let entry: BundleEntry;
  if (textTypes[extension]) {
    try { entry = { encoding: 'utf8', data: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) }; }
    catch { throw new Error(`Asset ${path}: invalid UTF-8 for a text source; use a binary file extension for binary data.`); }
    // Advisory only: dynamic URLs and loader behavior require host verification.
    const origins = new Set([...entry.data.matchAll(/\b(?:https?|wss?):\/\/[^\s"'<>`\\)]+/g)].flatMap(match => {
      try { return [new URL(match[0]).origin]; } catch { return []; }
    }));
    for (const origin of origins) report.diagnostics.push({ code: 'EXTERNAL_REFERENCE', path,
      message: `${path} references ${origin}; declare the required connectDomains/resourceDomains. Host CSP, CORS and Ink loader support still apply; this static scan is advisory.` });
  } else {
    entry = { encoding: 'base64', data: Buffer.from(bytes).toString('base64') };
    if (!binaryTypes[extension]) report.diagnostics.push({ code: 'UNSUPPORTED_FORMAT', path,
      message: `${path}: unrecognized format; bytes are preserved, but Ink/browser decoding is not guaranteed.` });
  }
  if (bytes.byteLength > 1024 * 1024) report.diagnostics.push({ code: 'LARGE_ASSET', path,
    message: `${path}: ${bytes.byteLength} bytes; base64 adds roughly one third to binary payloads. Check host resource and memory limits.` });
  report.files.push({ path, bytes: bytes.byteLength, encoding: entry.encoding, mimeType });
  report.totalBytes += bytes.byteLength;
  return entry;
}
