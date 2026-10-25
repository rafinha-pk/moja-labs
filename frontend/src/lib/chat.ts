import type { AgentRunSummary } from '../api/types';

export function conversationOf(runs: AgentRunSummary[]): AgentRunSummary[] {
  const found: AgentRunSummary[] = [];
  for (const run of runs) {
    found.push(run);
    if (run.resumed_from === null) break;
  }
  return found.reverse();
}

export function latestDraft(
  conversation: AgentRunSummary[],
): AgentRunSummary | null {
  for (let index = conversation.length - 1; index >= 0; index -= 1) {
    const run = conversation[index];
    if (run && run.status === 'done' && run.output) return run;
  }
  return null;
}
