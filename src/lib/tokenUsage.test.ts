import { describe, expect, it } from 'vitest';
import { tokenUsageFromHistory } from './tokenUsage';
import type { HistoryTurn } from '../api/types';
const turn = (turnNumber: number, type: HistoryTurn['type'], payload: Record<string, unknown>): HistoryTurn => ({turnNumber, type, payload, timestamp: '2026-09-10T00:00:00Z'});
describe('measured token usage', () => {
  it('reads request measurements from record fields without creating usage records', () => {
    const usage = { inputTokens: 100, outputTokens: 20, contextMaxTokens: 128000 };
    expect(tokenUsageFromHistory([
      turn(1, 'USER_PROMPT', { content: 'hello', usedTokens: 2, llmUsage: [usage, usage] }),
      turn(2, 'ASSISTANT_RESPONSE', { content: 'hi', usedTokens: 1 }),
    ])).toEqual({ total: 240, context: 100, max: 128000 });
  });
  it('keeps unknown usage unknown', () => expect(tokenUsageFromHistory([])).toEqual({total:null, context:null, max:null}));
  it('counts retries but displays only the latest request occupancy', () => {
    const usage = {inputTokens:100, outputTokens:20, contextMaxTokens:128000};
    expect(tokenUsageFromHistory([turn(1,'TOKEN_USAGE',usage), turn(2,'TOKEN_USAGE',{...usage,inputTokens:140})])).toEqual({total:280,context:140,max:128000});
  });
  it('keeps lifetime usage across compaction and waits for a fresh baseline', () => {
    const usage = turn(1,'TOKEN_USAGE',{inputTokens:100,outputTokens:20,contextMaxTokens:128000});
    expect(tokenUsageFromHistory([usage,turn(2,'REWIND',{})])).toEqual({total:120,context:null,max:128000});
    expect(tokenUsageFromHistory([usage,turn(2,'AGENT_INIT',{contextMaxTokens:64000}),turn(3,'TOKEN_USAGE',{inputTokens:10,outputTokens:2,contextMaxTokens:64000})])).toEqual({total:132,context:10,max:64000});
  });
});
