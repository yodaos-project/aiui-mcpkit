import { parseArgs } from 'node:util';
import { join, resolve } from 'node:path';
import { root, selectExamples } from './examples.mjs';
import { runWatch } from './watch.mjs';

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    out: { type: 'string' }, port: { type: 'string' }, input: { type: 'string' },
    'no-preview': { type: 'boolean' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('Usage: npm run watch:examples -- [counter|business] [--out <directory>] [--port <number>] [--input <json>] [--no-preview]\nFull rebuilds; preview reloads reset App/Page memory and navigation. Business/host tool services require an integration harness.');
    return;
  }
  if (positionals.length > 1) throw new Error('Expected at most one example selector.');
  const [example] = selectExamples(positionals[0] ?? 'counter');
  await runWatch({ source: join(root, 'examples', example.id), name: example.name,
    outputDir: resolve(values.out ?? join(root, 'dist/watch', example.id)),
    worker: example.worker, applications: example.applications,
    preview: values['no-preview'] ? false : { port: values.port === undefined ? undefined : Number(values.port), input: JSON.parse(values.input ?? '{}') },
  });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
