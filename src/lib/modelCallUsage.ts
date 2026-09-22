import type { HistoryTurn, LlmUsage } from '../api/types';

export interface ModelCallUsage extends LlmUsage { modelCallId: string; displayInputTokens: number }
export function modelCallUsage(turns: HistoryTurn[]): Map<string, ModelCallUsage> {
  const result = new Map<string, ModelCallUsage>();
  const previous = new Map<string, LlmUsage>();
  for (const turn of [...turns].sort((a,b) => a.turnNumber-b.turnNumber)) {
    if (turn.payload.restored_from_turn !== undefined) continue;
    const stream = turn.agentId ?? 'primary';
    if (turn.type === 'REWIND') previous.delete(stream);
    for (const usage of turn.llmUsage ?? []) {
      if (!usage || typeof usage.modelCallId !== 'string' || result.has(usage.modelCallId)
          || !Number.isSafeInteger(usage.inputTokens) || usage.inputTokens < 0
          || !Number.isSafeInteger(usage.outputTokens) || usage.outputTokens < 0) continue;
      const prior = previous.get(stream);
      const comparable = prior && prior.model === usage.model && prior.provider === usage.provider;
      result.set(usage.modelCallId, {...usage, modelCallId: usage.modelCallId, displayInputTokens: comparable ? usage.inputTokens-prior.inputTokens : usage.inputTokens});
      if (usage.purpose !== 'compaction') previous.set(stream, usage);
    }
  }
  return result;
}

/** Each request owns one marker, on its last message or associated tool result.
 * Usage may arrive before the output records or be backfilled into older history.
 * Match identities instead of treating the record carrying llmUsage as its owner.
 */
export function modelCallUsageAnchors(turns: HistoryTurn[]): Map<HistoryTurn, ModelCallUsage> {
  const calls = modelCallUsage(turns);
  const toolOwners = new Map<string, string>();
  const last = new Map<string, HistoryTurn>();
  for (const turn of [...turns].sort((a, b) => a.turnNumber - b.turnNumber)) {
    if (turn.payload.restored_from_turn !== undefined) continue;
    const callId = turn.payload.call_id;
    const modelId = turn.payload.model_call_id;
    if (turn.type === 'TOOL_CALL' && typeof callId === 'string' && typeof modelId === 'string') {
      toolOwners.set(callId, modelId);
    }
    const owner = turn.type === 'TOOL_RESPONSE' && typeof callId === 'string'
      ? toolOwners.get(callId) : modelId;
    if (typeof owner === 'string' && ['ASSISTANT_THOUGHT', 'ASSISTANT_RESPONSE', 'TOOL_CALL', 'TOOL_RESPONSE'].includes(turn.type)) {
      last.set(owner, turn);
    }
  }
  const anchors = new Map<HistoryTurn, ModelCallUsage>();
  for (const [id, turn] of last) {
    const usage = calls.get(id);
    if (usage && usage.purpose !== 'compaction') anchors.set(turn, usage);
  }
  return anchors;
}
