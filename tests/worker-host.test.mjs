import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

const enabled = !!process.env.INK_WORKER_BIN;
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'mcpkit-worker-'));
  const source = join(root, 'agent');
  await mkdir(join(source, 'workers'), { recursive: true });
  await writeFile(
    join(source, 'app.json'),
    JSON.stringify({
      pages: ['stock'],
      agentWorkers: [
        {
          name: 'business',
          script: 'workers/business.js',
          trigger: { type: 'open' },
          lifetime: 'foreground',
        },
      ],
    }),
  );
  await writeFile(
    join(source, 'stock.ink'),
    `<script def>${JSON.stringify({ tool: 'check_stock', navigationBarTitleText: 'Stock', description: 'Check stock', schema: { data: { type: 'object', properties: { sku: { type: 'string' } }, required: ['sku'], additionalProperties: false }, output: { type: 'object', properties: { sku: { type: 'string' }, available: { type: 'integer' } }, required: ['sku', 'available'], additionalProperties: false } } })}</script><page><text>Stock</text></page>`,
  );
  await writeFile(
    join(source, 'workers/business.js'),
    `export default { operations: {async check_stock(input, ctx) {ctx.reportProgress({value:0,total:1}); await new Promise(resolve => setTimeout(resolve, input.sku === 'slow' ? 500 : 5)); ctx.signal.throwIfAborted(); return {content:[{type:'text',text:'Worker stock'}],structuredContent:{sku:input.sku,available:100},uiMetadata:{privateView:true}};} } };`,
  );
  return { root, source };
}
test(
  'generated MCP tools execute declared Worker tools without app.js',
  { skip: !enabled },
  async () => {
    const f = await fixture();
    const client = new Client({ name: 'model-context-test', version: '1' });
    try {
      await writeFile(
        join(f.source, 'app.js'),
        "throw new Error('UI App entry must not execute');",
      );
      await writeFile(
        join(f.source, 'workers/business.js'),
        `
      const app = getApp();
      if ('host' in app || 'postMessage' in app) throw new Error('Unexpected App capabilities');
      export default {
        available: 100,
        tools: {
          check_stock: {
            description: 'Read stock',
            execute(input, {signal}) {
              signal.throwIfAborted();
              return {content:[],structuredContent:{sku:input.sku,available:this.available}};
            },
          },
        },
      };
    `,
      );
      const built = await buildPlugin({
        source: f.source,
        name: 'worker-model-context',
        outputDir: join(f.root, 'out'),
        worker: { name: 'business' },
      });
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [built.files.server],
        stderr: 'pipe',
        env: { ...process.env, INK_WORKER_BIN: process.env.INK_WORKER_BIN },
      });
      transport.stderr?.resume();
      await client.connect(transport);
      const result = await client.callTool({
        name: 'check_stock',
        arguments: { sku: 'DEMO' },
      });
      assert.deepEqual(result.structuredContent, {
        sku: 'DEMO',
        available: 100,
      });
    } finally {
      await client.close();
      await rm(f.root, { recursive: true, force: true });
    }
  },
);
test(
  'generated MCP adapter invokes real Ink worker without handwritten handlers or UI',
  { skip: !enabled },
  async () => {
    const f = await fixture();
    const client = new Client({ name: 'worker-test', version: '1' });
    try {
      const built = await buildPlugin({
        source: f.source,
        name: 'worker-test',
        outputDir: join(f.root, 'out'),
        worker: { name: 'business' },
      });
      assert.ok(
        !(await readFile(built.files.server, 'utf8')).includes(
          'mcp-server/handlers.ts',
        ),
      );
      const app = JSON.parse(
        await readFile(join(built.outputDir, 'worker-app/app.json'), 'utf8'),
      );
      assert.equal(app.agentWorkers[0].name, 'business');
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [built.files.server],
        stderr: 'pipe',
        env: { ...process.env, INK_WORKER_BIN: process.env.INK_WORKER_BIN },
      });
      transport.stderr?.resume();
      await client.connect(transport);
      const [a, b] = await Promise.all([
        client.callTool({ name: 'check_stock', arguments: { sku: 'A' } }),
        client.callTool({ name: 'check_stock', arguments: { sku: 'B' } }),
      ]);
      assert.deepEqual(a.structuredContent, { sku: 'A', available: 100 });
      assert.deepEqual(b.structuredContent, { sku: 'B', available: 100 });
      assert.deepEqual(a._meta.uiOnly, { privateView: true });
      const invalid = await client.callTool({
        name: 'check_stock',
        arguments: { sku: 1 },
      });
      assert.equal(invalid.isError, true);
      assert.equal(invalid._meta.businessError.code, 'INVALID_INPUT');
    } finally {
      await client.close();
      await rm(f.root, { recursive: true, force: true });
    }
  },
);
test(
  'JSON Lines connection isolates cancellation and rejects calls after shutdown',
  { skip: !enabled },
  async () => {
    const f = await fixture();
    const output = join(f.root, 'worker-transport.mjs');
    await build({
      entryPoints: ['src/runtime/worker-tools.ts'],
      outfile: output,
      bundle: true,
      platform: 'node',
      format: 'esm',
      packages: 'external',
    });
    const { InkWorkerConnection } = await import(output);
    const connection = new InkWorkerConnection('business', f.source);
    const controller = new AbortController();
    const progress = [];
    const context = (signal) => ({
      requestId: 'test',
      attempt: 1,
      signal,
      progress: (value) => progress.push(value),
    });
    try {
      const slow = connection
        .invoke('check_stock', { sku: 'slow' }, context(controller.signal))
        .catch((error) => error.name);
      const fast = connection.invoke(
        'check_stock',
        { sku: 'fast' },
        context(new AbortController().signal),
      );
      await new Promise((resolve) => setTimeout(resolve, 30));
      controller.abort();
      assert.equal(await slow, 'AbortError');
      assert.equal((await fast).structuredContent.sku, 'fast');
      const disconnected = connection
        .invoke(
          'check_stock',
          { sku: 'slow' },
          context(new AbortController().signal),
        )
        .catch((error) => error.name);
      connection.close();
      assert.equal(await disconnected, 'NetworkError');
      await assert.rejects(
        connection.invoke(
          'check_stock',
          { sku: 'late' },
          context(new AbortController().signal),
        ),
        { name: 'InvalidStateError' },
      );
    } finally {
      connection.close();
      await rm(f.root, { recursive: true, force: true });
    }
  },
);
