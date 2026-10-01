import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const examplesDirectory = join(root, 'dist/examples');
export const marketplaceName = 'aiui-mcpkit-examples';
export const examples = [
  { id: 'counter', name: 'ink-counter', title: 'AIUI MCPKit Counter' },
  { id: 'business', name: 'business-demo', title: 'MCPKit Business Demo' },
];
export function selectExamples(id) {
  if (id === undefined) return examples;
  const example = examples.find(example => example.id === id);
  if (!example) throw new Error(`Unknown example: ${id}. Choose counter or business.`);
  return [example];
}
