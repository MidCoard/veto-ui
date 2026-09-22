import { expect, it } from 'vitest';
import { cacheUsage, cacheUsageFromHistory } from './cacheUsage';
it('weights the ratio by input and deduplicates real call IDs', () => {
  const a = { modelCallId: 'a', inputTokens: 100, cacheReadInputTokens: 80 };
  expect(cacheUsage([a, a, { modelCallId: 'b', inputTokens: 900, cacheReadInputTokens: 0 }])).toEqual({ read: 80, input: 1000, reportedCalls: 2, totalCalls: 2 });
});
it('distinguishes missing, zero, writes and invalid counts', () => {
  expect(cacheUsage([{ inputTokens: 100, cacheCreationInputTokens: 100 }, { inputTokens: 10, cacheReadInputTokens: 20 }])).toEqual({ read: null, input: 0, reportedCalls: 0, totalCalls: 2 });
  expect(cacheUsage([{ inputTokens: 100 }, { inputTokens: 100, cacheReadInputTokens: 0 }])).toEqual({ read: 0, input: 100, reportedCalls: 1, totalCalls: 2 });
});
it('keeps spent cache reads through REWIND without counting restored copies', () => {
  const payload = { llmUsage: [{ modelCallId: 'a', inputTokens: 100, outputTokens:0, contextMaxTokens:128000, cacheReadInputTokens: 80 }] };
  expect(cacheUsageFromHistory([
    { turnNumber: 1, type: 'USER_PROMPT', timestamp: '', payload: {}, llmUsage: payload.llmUsage },
    { turnNumber: 2, type: 'REWIND', timestamp: '', payload: {} },
    { turnNumber: 3, type: 'USER_PROMPT', timestamp: '', payload: { ...payload, restored_from_turn: 1 } },
  ])).toEqual({ read: 80, input: 100, reportedCalls: 1, totalCalls: 1 });
});
