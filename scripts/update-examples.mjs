import { copyFile, readFile, rename, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { examplesDirectory, marketplaceName, selectExamples } from './examples.mjs';

async function main() {
  const { values } = parseArgs({ options: { example: { type: 'string' }, 'plugin-dir': { type: 'string' } } });
  const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex');
  const files = ['view.html', 'dist/server.mjs', 'plugin.json', 'mcp.json'];
  const updates = [];
  for (const example of selectExamples(values.example)) {
    const source = join(examplesDirectory, example.id);
    const manifest = JSON.parse(await readFile(join(source, 'plugin.json'), 'utf8'));
    const cache = values['plugin-dir'] && !values.example ? join(resolve(values['plugin-dir']), example.name)
      : join(codexHome, 'plugins/cache', marketplaceName, example.name);
    const candidates = values['plugin-dir'] && values.example ? [resolve(values['plugin-dir'])] : [join(cache, manifest.version), join(cache, 'local')];
    const installed = [];
    for (const directory of candidates) {
      let plugin;
      try { plugin = JSON.parse(await readFile(join(directory, 'plugin.json'), 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      if (plugin.name !== manifest.name) throw new Error(`Unexpected plugin in ${directory}: ${plugin.name}`);
      for (const file of files) {
        if (!(await stat(join(source, file))).isFile() || !(await stat(join(directory, file))).isFile()) throw new Error(`Missing ${file} in ${directory}`);
      }
      installed.push(directory);
      updates.push({ source, directory, files });
    }
    if (!installed.length) {
      if (values.example) throw new Error(`${example.name} is not installed. Install it first: codex plugin add ${example.name}@${marketplaceName}`);
      console.log(`Skipped ${example.name}: not installed.`);
    }
  }
  if (!updates.length) throw new Error(`No examples are installed from ${marketplaceName}. Register dist/examples and install an example first.`);
  for (const { source, directory, files } of updates) {
    for (const file of files) {
      const target = join(directory, file);
      const temporary = `${target}.${randomUUID()}.tmp`;
      try { await copyFile(join(source, file), temporary); await rename(temporary, target); }
      finally { await rm(temporary, { force: true }); }
    }
    console.log(`Updated UI, server, and manifests in ${directory}`);
  }
  console.log('Reload the MCP server/desktop host and open a new card to use the updated examples.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
