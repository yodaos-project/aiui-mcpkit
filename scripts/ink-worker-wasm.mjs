#!/usr/bin/env node
// CI/development JSON Lines host. Guest code runs in the published Ink QuickJS/WASM runtime.
import { createInkWorkerHost } from '@yodaos-pkg/ink';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { format, parseArgs } from 'node:util';

// SDK diagnostics must not mix with the correlated stdout protocol.
for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
  console[level] = (...values) => process.stderr.write(format(...values) + '\n');
}
const { values } = parseArgs({ options: {
  app: { type: 'string' }, worker: { type: 'string' }, configuration: { type: 'string' },
} });
if (!values.app || !values.worker) throw new Error('--app and --worker are required');
const files = new Map();
async function load(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name), name = prefix + entry.name;
    if (entry.isDirectory()) await load(path, name + '/');
    else if (entry.isFile()) files.set(name, await readFile(path));
    else throw new Error('Unsupported Worker app entry');
  }
}
await load(resolve(values.app));
const sdk = dirname(createRequire(import.meta.url).resolve('@yodaos-pkg/ink/package.json'));
const host = await createInkWorkerHost({
  files, worker: values.worker,
  configuration: values.configuration ? JSON.parse(await readFile(values.configuration, 'utf8')) : {},
  wasm: { moduleOrPath: await readFile(join(sdk, 'pkg/ink_web_bg.wasm')) },
});
const pending = new Map();
const write = event => process.stdout.write(JSON.stringify(event) + '\n');
const complete = (requestId, error, value) => write({ type: 'complete', requestId,
  ...(error ? { error: { name: error.name || 'OperationError', message: error.message || 'Worker operation failed' } } : { value }),
});
const lines = createInterface({ input: process.stdin });
lines.on('line', line => {
  let command;
  try {
    command = JSON.parse(line);
    if (command.type === 'cancel') { pending.get(command.id)?.abort(); return; }
    if (command.type === 'shutdown') { lines.close(); return; }
    if (command.type !== 'invoke' || typeof command.id !== 'string' || pending.has(command.id)) throw new Error('Invalid Worker command');
    const controller = new AbortController();
    pending.set(command.id, controller);
    void host.invoke(command.operation, command.input, {
      signal: controller.signal, timeoutMs: command.timeoutMs,
      onProgress: value => write({ type: 'progress', requestId: command.id, value }),
    }).then(value => complete(command.id, null, value), error => complete(command.id, error))
      .finally(() => pending.delete(command.id));
  } catch (error) { complete(command?.id ?? null, error); }
});
lines.on('close', () => host.destroy());
