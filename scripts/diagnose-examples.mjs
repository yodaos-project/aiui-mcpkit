import { diagnosePlugin } from '@yodaos-pkg/aiui-mcpkit';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { access, readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { examplesDirectory, marketplaceName, selectExamples } from './examples.mjs';

async function main() {
  const { values } = parseArgs({ options: {
    example: { type: 'string' }, 'plugin-dir': { type: 'string' },
    'server-build': { type: 'string' }, 'view-build': { type: 'string' },
    'new-card': { type: 'boolean' }, 'existing-card': { type: 'boolean' },
  } });
  if (values['new-card'] && values['existing-card']) throw new Error('Choose --new-card or --existing-card.');
  if (!values.example && (values['server-build'] || values['view-build'])) throw new Error('Use --example when supplying observed build IDs.');
  const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex');
  for (const example of selectExamples(values.example)) {
    const buildDir = join(examplesDirectory, example.id);
    const plugin = JSON.parse(await readFile(join(buildDir, 'plugin.json'), 'utf8'));
    const cache = values['plugin-dir'] && !values.example ? join(resolve(values['plugin-dir']), example.name)
      : join(codexHome, 'plugins/cache', marketplaceName, example.name);
    const candidates = values['plugin-dir'] && values.example ? [resolve(values['plugin-dir'])] : [join(cache, plugin.version), join(cache, 'local')];
    let found = false;
    for (const installedDir of candidates) {
      if (!await access(join(installedDir, 'plugin.json')).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; })) continue;
      found = true;
      console.log(JSON.stringify(await diagnosePlugin({ buildDir, installedDir,
        serverBuildId: values['server-build'], viewBuildId: values['view-build'],
        newCard: values['new-card'] ? true : values['existing-card'] ? false : undefined,
      }), null, 2));
    }
    if (!found) {
      if (values['plugin-dir']) throw new Error(`No installed ${example.name} at ${candidates.join(', ')}`);
      console.log(JSON.stringify({ ...await diagnosePlugin({ buildDir }), installation: 'not found in default example cache; use --plugin-dir for other registrations' }, null, 2));
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
