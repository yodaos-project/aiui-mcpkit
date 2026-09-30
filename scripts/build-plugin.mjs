#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    out: { type: 'string' }, name: { type: 'string' },
    title: { type: 'string' }, description: { type: 'string' },
    tool: { type: 'string' }, page: { type: 'string' },
    version: { type: 'string' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log(`Usage: node scripts/build-plugin.mjs [source] --name <plugin-name> [options]

  source                 Agent source directory (default: current directory)
  --out <directory>      Plugin output (default: dist/<plugin-name>)
  --title <text>         Display name (default: app.json name or plugin name)
  --description <text>   Plugin and MCP tool description
  --tool <name>          Opener tool (default: open_app)
  --page <path>          Initial page (default: first app.json pages entry)
  --version <version>    Plugin and server version (default: 0.1.0)`);
    return;
  }
  if (positionals.length > 1) throw new Error('Expected at most one source directory.');
  if (!values.name) throw new Error('--name is required; use --help for usage.');
  const result = await buildPlugin({
    source: positionals[0] ?? '.', name: values.name, outputDir: values.out,
    title: values.title, description: values.description,
    tool: values.tool, page: values.page, version: values.version,
  });
  console.log(`Built plugin ${result.name} in ${result.outputDir}`);
  console.log(`Local install: codex plugin marketplace add ${JSON.stringify(result.outputDir)}`);
  console.log(`Then: codex plugin add ${result.name}@${result.marketplaceName}`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
