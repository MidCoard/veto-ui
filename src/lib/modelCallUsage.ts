import type { HistoryTurn } from '../api/types';

export interface ModelCallUsage { modelCallId: string; inputTokens: number; outputTokens: number; cacheReadInputTokens?: number; cacheCreationInputTokens?: number }
export function modelCallUsage(turns: HistoryTurn[]): Map<string, ModelCallUsage> {
  const result = new Map<string, ModelCallUsage>();
  for (const turn of turns) {
    if (turn.payload.restored_from_turn !== undefined || !Array.isArray(turn.payload.llmUsage)) continue;
    for (const usage of turn.payload.llmUsage) {
      if (usage && typeof usage.modelCallId === 'string' && Number.isSafeInteger(usage.inputTokens)
        && usage.inputTokens >= 0 && Number.isSafeInteger(usage.outputTokens) && usage.outputTokens >= 0) result.set(usage.modelCallId, usage);
    }
  }
  return result;
}
