import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
await mkdir(new URL('dist/runtime/', root), { recursive: true });
await build({
  entryPoints: [new URL('src/cli.ts', root).pathname],
  bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'node22',
  outfile: new URL('dist/cli.mjs', root).pathname,
  banner: { js: '#!/usr/bin/env node' },
});
await cp(new URL('src/runtime/', root), new URL('dist/runtime/', root), { recursive: true });
console.log('Built framework CLI and runtime templates in dist/');
