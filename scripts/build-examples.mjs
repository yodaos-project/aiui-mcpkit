import { build } from 'esbuild';
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { root, examplesDirectory, marketplaceName, examples } from './examples.mjs';

const { values } = parseArgs({ options: { out: { type: 'string' } } });
const output = values.out ? resolve(values.out) : examplesDirectory;
await mkdir(join(root, 'dist'), { recursive: true });
const contractFile = join(root, 'dist', `.example-contracts-${randomUUID()}.mjs`);
let tools;
try {
  const compiled = await build({ entryPoints: [join(root, 'examples/business/contracts.ts')], bundle: true, packages: 'external', write: false, platform: 'node', format: 'esm' });
  await writeFile(contractFile, compiled.outputFiles[0].text);
  ({ tools } = await import(pathToFileURL(contractFile).href));
} finally { await rm(contractFile, { force: true }); }

for (const example of examples) {
  const result = await buildPlugin({ source: join(root, 'examples', example.id, 'ink'), name: example.name,
    outputDir: join(output, example.id),
    ...(example.id === 'business' ? { businessTools: { tools, handlers: join(root, 'examples/business/handlers.ts') } } : {}),
  });
  // The examples are installed through the shared catalog, not individual catalogs.
  await rm(join(result.outputDir, '.agents'), { recursive: true, force: true });
  console.log(`Built ${example.id} in ${result.outputDir}`);
}
await mkdir(join(output, '.agents/plugins'), { recursive: true });
await writeFile(join(output, '.agents/plugins/marketplace.json'), JSON.stringify({
  name: marketplaceName, interface: { displayName: 'AIUI MCPKit Examples' },
  plugins: examples.map(example => ({ name: example.name, source: { source: 'local', path: `./${example.id}` },
    policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Developer Tools' })),
}, null, 2) + '\n');
console.log(`Local install: codex plugin marketplace add ${JSON.stringify(output)}`);
for (const example of examples) console.log(`codex plugin add ${example.name}@${marketplaceName}`);
