import type { AgentRunSummary } from '../api/types';

export function conversationOf(
  runs: AgentRunSummary[],
  after: number,
): AgentRunSummary[] {
  const found: AgentRunSummary[] = [];
  for (const run of runs) {
    if (run.id <= after) break;
    found.push(run);
    if (run.resumed_from === null) break;
  }
  return found.reverse();
}
