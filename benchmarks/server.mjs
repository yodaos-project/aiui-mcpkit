import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { distribution } from './metrics.mjs';
import { rssBytes } from './footprint.mjs';

export async function serverBenchmark(serverFile, settings) {
  const client = new Client({ name: 'mcpkit-benchmark', version: '1' }, {
    capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } },
  });
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverFile] });
  try {
    const start = performance.now();
    await client.connect(transport);
    const initializedMs = performance.now() - start;
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 4);
    const resourceUri = tools.tools.find(t => t.name === 'benchmark_card')?._meta?.ui?.resourceUri;
    assert.equal(typeof resourceUri, 'string', 'benchmark_card must expose an MCP Apps UI resource to the benchmark host');
    const resourceStart = performance.now();
    const resource = await client.readResource({ uri: resourceUri });
    const resourceReadMs = performance.now() - resourceStart;
    async function call(value) {
      const start = performance.now();
      const result = await client.callTool({ name: 'benchmark_card', arguments: { value } });
      const ms = performance.now() - start;
      assert.equal(result.isError, undefined);
      assert.deepEqual(result.structuredContent, { value: value + 1 });
      return ms;
    }
    for (let i = 0; i < 10; i++) await call(i);
    const rss = [await rssBytes([transport.pid])];
    const workloads = {};
    for (const [name, concurrency] of [['sequential', 1], ['concurrent', settings.serverConcurrency]]) {
      let next = 0;
      const timings = [];
      const start = performance.now();
      await Promise.all(Array.from({ length: concurrency }, async () => {
        while (next < settings.serverCalls) { const value = next++; timings.push(await call(value)); }
      }));
      const durationMs = performance.now() - start;
      assert.equal(timings.length, settings.serverCalls);
      rss.push(await rssBytes([transport.pid]));
      workloads[name] = { calls: settings.serverCalls, concurrency, durationMs, callsPerSecond: timings.length * 1000 / durationMs, latencyMs: distribution(timings), rawLatencyMs: timings };
    }
    return { transport: 'stdio', initializedMs, resourceReadMs, ...workloads, sampledRssBytes: rss, resource };
  } finally { await client.close(); }
}
