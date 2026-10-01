import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { examplesDirectory, selectExamples } from './examples.mjs';

try {
  if (process.argv.length > 3) throw new Error('Usage: npm run start:examples -- [counter|business]');
  const [example] = selectExamples(process.argv[2] ?? 'counter');
  const directory = join(examplesDirectory, example.id);
  const server = join(directory, 'dist/server.mjs');
  await access(server).catch(() => { throw new Error('Run npm run build:examples first.'); });
  const child = spawn(process.execPath, [server], { cwd: directory, stdio: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143); });
} catch (error) { console.error(error.message); process.exitCode = 1; }
