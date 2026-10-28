import type { Page } from 'playwright';
import type {} from './runtime/preview-host.js';
import { equalInteractionValue, type InteractionRecord } from './runtime/interactions.js';

export interface ReplayVerification {
  status: 'passed' | 'failed';
  completedSteps: number;
  checks: { state: number; toolRequests: number; modelContext: number };
}

/** Runs within verifyPlugin's fresh, network-isolated context. Never connects a server. */
export async function runReplay(page: Page, record: InteractionRecord, timeout: number): Promise<ReplayVerification> {
  const result: ReplayVerification = { status: 'failed', completedSteps: 1, checks: { state: 0, toolRequests: 0, modelContext: 0 } };
  const frame = page.frames().find(frame => frame.url().endsWith('/view.html'));
  if (!frame) throw new Error('Replay Agent frame is unavailable.');
  for (const [index, step] of record.steps.entries()) {
    if (index === 0) continue; // Initial input was sent during the real AppBridge handshake.
    try {
      switch (step.type) {
        case 'tool-input': await page.evaluate(input => window.__mcpkitReplayHost.input(JSON.parse(input)), JSON.stringify(step.input)); break;
        case 'tool-result': await page.evaluate(value => window.__mcpkitReplayHost.result(JSON.parse(value)), JSON.stringify(step.result)); break;
        case 'display-mode':
          await page.evaluate(mode => window.__mcpkitReplayHost.mode(mode), step.mode);
          await frame.waitForFunction(mode => document.body.dataset.mode === mode, step.mode, { timeout });
          break;
        case 'click': await frame.locator('#ink').click({ position: { x: step.x, y: step.y }, timeout }); break;
        case 'assert-state': {
          const position = result.checks.state;
          await frame.waitForFunction(position => window.__mcpkitPreview.bindings.length > position, position, { timeout });
          const actual = await frame.evaluate(position => window.__mcpkitPreview.bindings[position], position);
          if (actual.name !== step.name || !equalInteractionValue(actual.value, step.value)) throw new Error('State assertion did not match.');
          result.checks.state++; break;
        }
        case 'assert-context': {
          const position = result.checks.modelContext;
          await page.waitForFunction(position => window.__mcpkitReplayHost.contexts.length > position, position, { timeout });
          const actual = await page.evaluate(position => window.__mcpkitReplayHost.contexts[position], position);
          if (!equalInteractionValue(actual, step.value)) throw new Error('Model context assertion did not match.');
          result.checks.modelContext++; break;
        }
      }
      result.completedSteps++;
    } catch { throw new Error(`Replay step ${index + 1} (${step.type}) failed.`, { cause: result }); }
  }
  return result;
}

/** Check for unconsumed mocks and unasserted semantic output after final presentation. */
export async function finishReplay(page: Page, record: InteractionRecord, result: ReplayVerification): Promise<void> {
  const actual = await page.evaluate(() => ({
    calls: window.__mcpkitReplayHost.calls, problems: window.__mcpkitReplayHost.problems,
    contexts: window.__mcpkitReplayHost.contexts.length,
    bindings: document.querySelector('iframe')?.contentWindow?.__mcpkitPreview.bindings.length,
  }));
  result.checks.toolRequests = actual.calls;
  if (actual.problems.length || actual.calls !== record.mocks.length || actual.contexts !== result.checks.modelContext || actual.bindings !== result.checks.state) {
    throw new Error(`Replay output mismatch: ${actual.problems[0] ?? 'unconsumed mocks or unasserted state/context output.'}`);
  }
  result.status = 'passed';
}
