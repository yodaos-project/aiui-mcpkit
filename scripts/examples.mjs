import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const examplesDirectory = join(root, 'dist/examples');
export const marketplaceName = 'aiui-mcpkit-examples';
export const examples = [
  { id: 'counter', name: 'ink-counter', title: 'AIUI MCPKit Counter' },
  { id: 'business', name: 'business-demo', title: 'MCPKit Business Demo', worker: { name: 'business' }, applications: { catalog: { page: 'pages/catalog/index' } } },
  { id: 'travel', name: 'travel-planner', title: 'MCPKit Travel Planner' },
  { id: 'focus', name: 'focus-studio', title: 'MCPKit Focus Studio' },
  { id: 'analytics', name: 'analytics-lab', title: 'MCPKit Analytics Lab' },
  { id: 'events', name: 'event-booking', title: 'MCPKit Event Booking' },
];
export function selectExamples(id) {
  if (id === undefined) return examples;
  const example = examples.find(example => example.id === id);
  if (!example) throw new Error(`Unknown example: ${id}. Choose ${examples.map(example => example.id).join(', ')}.`);
  return [example];
}
