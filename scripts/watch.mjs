import { watchPlugin } from '@yodaos-pkg/aiui-mcpkit';

/** Thin CLI lifecycle adapter; all build/reload behavior lives in the ESM API. */
export async function runWatch(options) {
  let watcher, stopping = false;
  const stop = async () => {
    stopping = true;
    await watcher?.close();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    watcher = await watchPlugin({ ...options, onEvent: state => console.log(JSON.stringify({ type: 'watch', ...state })) });
    console.log(JSON.stringify({ type: 'preview', url: watcher.previewUrl ?? null, statePolicy: 'reset' }));
    if (stopping) await watcher.close();
    return watcher;
  } catch (error) {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    throw error;
  }
}
