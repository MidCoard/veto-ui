import type { HistoryTurn } from '../api/types';

export interface CacheUsage { read: number | null; input: number; reportedCalls: number; totalCalls: number }
export const tokenCount = (value: unknown): number | null => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
export function cacheUsage(measurements: unknown[]): CacheUsage {
  const result: CacheUsage = { read: null, input: 0, reportedCalls: 0, totalCalls: 0 };
  const seen = new Set<string>();
  for (const value of measurements) {
    if (!value || typeof value !== 'object') continue;
    const usage = value as Record<string, unknown>;
    const input = tokenCount(usage.inputTokens);
    if (input === null) continue;
    if (typeof usage.modelCallId === 'string') {
      if (seen.has(usage.modelCallId)) continue;
      seen.add(usage.modelCallId);
    }
    result.totalCalls++;
    const read = tokenCount(usage.cacheReadInputTokens);
    if (read === null || read > input) continue;
    result.read = (result.read ?? 0) + read;
    result.input += input;
    result.reportedCalls++;
  }
  return result;
}
/** Use original measurements even after REWIND; restored content is not another charge. */
export function cacheUsageFromHistory(turns: HistoryTurn[]): CacheUsage {
  return cacheUsage(turns.flatMap(turn => turn.payload.restored_from_turn !== undefined ? []
    : turn.type === 'TOKEN_USAGE' ? [turn.payload]
    : Array.isArray(turn.payload.llmUsage) ? turn.payload.llmUsage : []));
}
