import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

const exec = promisify(execFile);
test('registered page schemas generate checked handler types, including local refs, arrays and nullable fields', async () => {
  const source = await mkdtemp(join(tmpdir(), 'mcpkit-generated-types-'));
  const input = { type: 'object', properties: {
    quantity: { type: 'integer' }, coupon: { type: ['string', 'null'] }, tags: { type: 'array', items: { enum: ['a', 'b'] } },
    address: { $ref: '#/$defs/address' },
  }, required: ['quantity', 'address'], additionalProperties: false,
  $defs: { address: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'], additionalProperties: false } } };
  const output = { type: 'object', properties: { total: { type: 'number' }, currency: { const: 'CNY' } }, required: ['total', 'currency'], additionalProperties: false };
  try {
    await writeFile(join(source, 'app.json'), JSON.stringify({ pages: ['home'] }));
    await writeFile(join(source, 'home.ink'), `<script def>${JSON.stringify({ tool: 'quote', description: 'Quote', schema: { data: input, output } })}</script><page />`);
    await writeFile(join(source, 'handlers.ts'), 'export const handlers = { quote: input => ({ content: [], structuredContent: { total: input.quantity, currency: "CNY" } }) };');
    const result = await buildPlugin({ source, name: 'types-test', handlers: join(source, 'handlers.ts'), outputDir: join(source, 'dist/plugin') });
    assert.deepEqual(result.tools[0].inputSchema, input);
    await writeFile(join(source, 'check.ts'), `import type { ToolInputs, ToolOutputs, BusinessHandlers } from './dist/plugin/tools.js';
const good: ToolInputs['quote'] = { quantity: 2, address: { city: 'Hangzhou' }, coupon: null, tags: ['a'] };
// @ts-expect-error required quantity
const missing: ToolInputs['quote'] = { address: { city: 'x' } };
// @ts-expect-error integer input maps to number
const wrong: ToolInputs['quote'] = { quantity: '2', address: { city: 'x' } };
// @ts-expect-error nested required city
const nested: ToolInputs['quote'] = { quantity: 2, address: {} };
// @ts-expect-error array enum
const tags: ToolInputs['quote'] = { quantity: 2, address: { city: 'x' }, tags: ['c'] };
// @ts-expect-error output literal
const currency: ToolOutputs['quote'] = { total: 2, currency: 'USD' };
const handlers: BusinessHandlers = { quote: input => ({ content: [], structuredContent: { total: input.quantity, currency: 'CNY' } }) };
void good; void handlers;
`);
    await writeFile(join(source, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
      noEmit: true, strict: true, skipLibCheck: true, target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
      paths: { '@yodaos-pkg/aiui-mcpkit/tools': [resolve('dist/runtime/business-tools.d.ts')] },
    }, include: ['check.ts'] }));
    await exec(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', join(source, 'tsconfig.json')]);
    // Changing the page schema regenerates the contract; there is no second source of definitions.
    input.properties.quantity = { type: 'string' };
    await writeFile(join(source, 'home.ink'), `<script def>${JSON.stringify({ tool: 'quote', description: 'Quote', schema: { data: input, output } })}</script><page />`);
    await buildPlugin({ source, name: 'types-test', handlers: join(source, 'handlers.ts'), outputDir: join(source, 'dist/plugin') });
    assert.match(await readFile(result.files.types, 'utf8'), /"quantity": string/);
  } finally { await rm(source, { recursive: true, force: true }); }
});
