import type { HistoryTurn } from '../api/types';

export interface TokenUsage { total: number | null; context: number | null; max: number | null }
const count = (value: unknown): number | null => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
/** Raw usage survives rewinds; current occupancy is invalid until the next measured request. */
export function tokenUsageFromHistory(turns: HistoryTurn[]): TokenUsage {
  const result: TokenUsage = { total: null, context: null, max: null };
  for (const turn of turns) {
    if (turn.type === 'REWIND' || turn.type === 'AGENT_INIT') {
      result.context = null;
      if (turn.type === 'AGENT_INIT') result.max = count(turn.payload.contextMaxTokens);
    }
    if (turn.payload.restored_from_turn !== undefined) continue;
    const measurements = turn.type === 'TOKEN_USAGE' ? [turn.payload] : Array.isArray(turn.payload.llmUsage) ? turn.payload.llmUsage : [];
    for (const usage of measurements) {
    if (usage === null || typeof usage !== 'object') continue;
    const input = count(usage.inputTokens);
    const output = count(usage.outputTokens);
    if (input === null || output === null) continue;
    result.total = (result.total ?? 0) + input + output;
    if (usage.affectsContext === false) continue;
    result.context = input;
    result.max = count(usage.contextMaxTokens);
    }
  }
  return result;
}
