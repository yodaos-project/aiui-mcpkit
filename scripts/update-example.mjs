import { copyFile, readFile, rename, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'dist/examples/counter');
const installCommand = 'codex plugin add ink-counter@ink-counter-local';

async function main() {
  const { values } = parseArgs({ options: { 'plugin-dir': { type: 'string' } } });
  const manifest = JSON.parse(await readFile(join(source, 'plugin.json'), 'utf8'));
  const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex');
  const cache = join(codexHome, 'plugins/cache/ink-counter-local/ink-counter');
  const candidates = values['plugin-dir']
    ? [resolve(values['plugin-dir'])]
    : [join(cache, manifest.version), join(cache, 'local')];
  const installed = [];
  for (const directory of candidates) {
    let plugin;
    try {
      plugin = JSON.parse(await readFile(join(directory, 'plugin.json'), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (plugin.name !== manifest.name) throw new Error(`Unexpected plugin in ${directory}: ${plugin.name}`);
    if (!(await stat(join(directory, 'view.html'))).isFile()) throw new Error(`Missing view.html in ${directory}`);
    installed.push(directory);
  }
  if (!installed.length) throw new Error(`Counter plugin is not installed at ${candidates.join(' or ')}.\nInstall it first: ${installCommand}`);
  for (const directory of installed) {
    const temporary = join(directory, `.view-${randomUUID()}.html`);
    try {
      await copyFile(join(source, 'view.html'), temporary);
      await rename(temporary, join(directory, 'view.html'));
    } finally {
      await rm(temporary, { force: true });
    }
    console.log(`Updated ${join(directory, 'view.html')}`);
  }
  console.log('Open a new Counter card to request the updated UI. Existing cards keep their current view.');
  console.log('If the host caches the resource, restart the desktop host. MCP server and manifest changes require a separate reload.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
