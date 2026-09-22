import { describe, expect, it } from 'vitest';
import { tokenUsageFromHistory } from './tokenUsage';
import type { HistoryTurn, UsageMeasurement } from '../api/types';
const turn = (turnNumber: number, type: HistoryTurn['type'], payload: Record<string, unknown>, llmUsage?: UsageMeasurement[]): HistoryTurn => ({turnNumber, type, payload, timestamp: '2026-09-10T00:00:00Z', ...(llmUsage ? { llmUsage } : {})});
const unknownCache = (totalCalls: number) => ({ read: null, input: 0, reportedCalls: 0, totalCalls });
describe('measured token usage', () => {
  it('counts a call once across duplicate records but counts each real retry', () => {
    const usage = { modelCallId: 'call-a', inputTokens: 100, outputTokens: 20, contextMaxTokens: 128000 };
    const retry = { ...usage, modelCallId: 'call-b', inputTokens: 140 };
    expect(tokenUsageFromHistory([
      turn(1, 'USER_PROMPT', {}, [usage, retry]),
      turn(2, 'ASSISTANT_RESPONSE', {}, [usage]),
      turn(3, 'ASSISTANT_RESPONSE', { model_call_id: 'call-b' }),
      turn(4, 'USER_PROMPT', { restored_from_turn: 1 }, [usage, retry]),
    ])).toEqual({ total: 280, context: 140, max: 128000, cache: unknownCache(2) });
  });
  it('reads request measurements from the record field without creating usage records', () => {
    const usage = { inputTokens: 100, outputTokens: 20, contextMaxTokens: 128000 };
    expect(tokenUsageFromHistory([
      turn(1, 'USER_PROMPT', { content: 'hello', usedTokens: 2 }, [usage, usage]),
      turn(2, 'ASSISTANT_RESPONSE', { content: 'hi', usedTokens: 1 }),
    ])).toEqual({ total: 240, context: 100, max: 128000, cache: unknownCache(2) });
  });
  it('keeps unknown usage unknown', () => expect(tokenUsageFromHistory([])).toEqual({total:null, context:null, max:null, cache: unknownCache(0)}));
  it('counts retries but displays only the latest request occupancy', () => {
    const usage = {inputTokens:100, outputTokens:20, contextMaxTokens:128000};
    expect(tokenUsageFromHistory([turn(1,'ASSISTANT_RESPONSE',{},[usage]), turn(2,'ASSISTANT_RESPONSE',{},[{...usage,inputTokens:140}])])).toEqual({total:280,context:140,max:128000, cache: unknownCache(2)});
  });
  it('keeps lifetime usage across compaction and waits for a fresh baseline', () => {
    const usage = turn(1,'ASSISTANT_RESPONSE',{},[{inputTokens:100,outputTokens:20,contextMaxTokens:128000}]);
    expect(tokenUsageFromHistory([usage,turn(2,'REWIND',{})])).toEqual({total:120,context:null,max:128000, cache: unknownCache(1)});
    expect(tokenUsageFromHistory([usage,turn(2,'AGENT_INIT',{contextMaxTokens:64000}),turn(3,'ASSISTANT_RESPONSE',{},[{inputTokens:10,outputTokens:2,contextMaxTokens:64000}])])).toEqual({total:132,context:10,max:64000, cache: unknownCache(2)});
  });
});
