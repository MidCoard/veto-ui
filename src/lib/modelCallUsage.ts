import type { HistoryTurn } from '../api/types';

export interface ModelCallUsage { modelCallId: string; inputTokens: number; outputTokens: number; cacheReadInputTokens?: number; cacheCreationInputTokens?: number; contextDeltaTokens?: number; baselineReset?: boolean; affectsContext?: boolean; purpose?: string; inputDeltaTokens?: number }

const isCall = (usage: unknown): usage is ModelCallUsage =>
  !!usage && typeof usage === 'object'
  && typeof (usage as ModelCallUsage).modelCallId === 'string'
  && Number.isSafeInteger((usage as ModelCallUsage).inputTokens) && (usage as ModelCallUsage).inputTokens >= 0
  && Number.isSafeInteger((usage as ModelCallUsage).outputTokens) && (usage as ModelCallUsage).outputTokens >= 0;

/**
 * The backend reports raw per-request input totals and delegates display differences to us
 * (agent/UsageMeasurement.java). Each request resends the whole context, so the informative
 * figure is the growth over the previous comparable request. Derive it here, where the ordered
 * history is available, and carry it on the measurement. A request whose input does not exceed
 * its predecessor (the first call, or a compaction/context reset) is a new baseline: it keeps the
 * full input and is flagged so the view never shows a misleading negative or zero growth.
 */
export function modelCallUsage(turns: HistoryTurn[]): Map<string, ModelCallUsage> {
  const result = new Map<string, ModelCallUsage>();
  const ordered: ModelCallUsage[] = [];
  for (const turn of [...turns].sort((a, b) => a.turnNumber - b.turnNumber)) {
    if (turn.payload.restored_from_turn !== undefined || !Array.isArray(turn.llmUsage)) continue;
    for (const usage of turn.llmUsage) {
      if (!isCall(usage) || result.has(usage.modelCallId)) continue;
      const call: ModelCallUsage = { ...usage };
      result.set(call.modelCallId, call);
      ordered.push(call);
    }
  }
  let previousInput: number | undefined;
  for (const call of ordered) {
    const comparable = call.affectsContext !== false && call.purpose !== 'compaction';
    if (!comparable || previousInput === undefined || call.inputTokens < previousInput) {
      call.baselineReset = true;
      call.inputDeltaTokens = call.inputTokens;
    } else {
      call.baselineReset = false;
      call.inputDeltaTokens = call.inputTokens - previousInput;
    }
    if (comparable) previousInput = call.inputTokens;
  }
  return result;
}
