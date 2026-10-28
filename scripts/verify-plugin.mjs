#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { verifyPlugin } from '@yodaos-pkg/aiui-mcpkit';

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    page: { type: 'string' }, input: { type: 'string' }, 'ready-message': { type: 'string' },
    mode: { type: 'string' }, width: { type: 'string' }, height: { type: 'string' },
    dpr: { type: 'string' }, timeout: { type: 'string' }, screenshot: { type: 'string' },
    'error-gate': { type: 'string' }, chromium: { type: 'string' }, help: { type: 'boolean' },
    replay: { type: 'string' },
  } });
  if (values.help) {
    console.log(`Usage: node scripts/verify-plugin.mjs <plugin-directory> [options]

  --page <route>          Page route without .ink (default: built initial page)
  --input <json>          Launch arguments (default: {})
  --replay <json-file>    Replay a recording with strict tool mocks and network isolation
  --ready-message <json>  Partial business-ready message; omitted means incomplete verification
  --mode <mode>          inline or fullscreen (default: inline)
  --width <pixels>       Viewport width (default: 420)
  --height <pixels>      Viewport height (default: 280)
  --dpr <scale>          Device scale factor (default: 1)
  --timeout <ms>         Budget for each readiness stage (default: 15000)
  --screenshot <png>     Optional Agent canvas PNG destination
  --error-gate <gate>    fail or collect (default: fail)
  --chromium <path>      Existing browser executable

Install browser support separately: npm install --save-dev playwright
Then: npx playwright install chromium
Outputs JSON; exits 0 only for passed verification, otherwise 1.`);
    return;
  }
  if (positionals.length !== 1) throw new Error('Expected one built plugin directory; use --help for usage.');
  const timeout = values.timeout === undefined ? undefined : Number(values.timeout);
  const result = await verifyPlugin({
    pluginDir: positionals[0], page: values.page,
    replay: values.replay === undefined ? undefined : JSON.parse(await readFile(values.replay, 'utf8')),
    input: values.input === undefined ? undefined : JSON.parse(values.input),
    readyWhen: values['ready-message'] === undefined ? undefined : { message: JSON.parse(values['ready-message']) },
    displayMode: values.mode,
    viewport: values.width === undefined && values.height === undefined ? undefined : { width: Number(values.width ?? 420), height: Number(values.height ?? 280) },
    deviceScaleFactor: values.dpr === undefined ? undefined : Number(values.dpr),
    timeouts: timeout === undefined ? undefined : { runtime: timeout, firstFrame: timeout, business: timeout },
    screenshotPath: values.screenshot, errorGate: values['error-gate'], executablePath: values.chromium,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.usable) process.exitCode = 1;
}
main().catch(error => {
  console.log(JSON.stringify({ status: 'failed', usable: false, diagnostics: [{ code: error.code ?? 'INVALID_OPTIONS', message: error.message }] }, null, 2));
  process.exitCode = 1;
});
