import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
await mkdir(new URL('dist/runtime/', root), { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL('src/index.ts', root))],
  bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'node22',
  outfile: fileURLToPath(new URL('dist/index.mjs', root)),
});
await build({
  entryPoints: [fileURLToPath(new URL('src/runtime/business-tools.ts', root))],
  bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'node22',
  outfile: fileURLToPath(new URL('dist/tools.mjs', root)),
});
execFileSync(process.execPath, [fileURLToPath(new URL('node_modules/typescript/bin/tsc', root)), '-p', 'tsconfig.build.json'], { cwd: fileURLToPath(root), stdio: 'inherit' });
await cp(new URL('src/runtime/', root), new URL('dist/runtime/', root), { recursive: true });
await rm(new URL('dist/cli.mjs', root), { force: true });
console.log('Built ESM library, type declarations, and runtime templates in dist/');
