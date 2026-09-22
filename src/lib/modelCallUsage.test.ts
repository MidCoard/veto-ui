import { describe, expect, it } from 'vitest';
import type { HistoryTurn, UsageMeasurement } from '../api/types';
import { modelCallUsage } from './modelCallUsage';

function turn(turnNumber: number, llmUsage: UsageMeasurement[]): HistoryTurn {
  return { turnNumber, type: 'USER_PROMPT', payload: {}, timestamp: '', llmUsage };
}

describe('modelCallUsage request-growth derivation', () => {
  it('marks the first comparable request as a baseline carrying full input', () => {
    const calls = modelCallUsage([turn(1, [{ modelCallId: 'a', inputTokens: 100, outputTokens: 5 }])]);
    expect(calls.get('a')).toMatchObject({ baselineReset: true, inputDeltaTokens: 100 });
  });

  it('derives the growth over the previous comparable request in turn order', () => {
    const calls = modelCallUsage([
      turn(1, [{ modelCallId: 'a', inputTokens: 100, outputTokens: 5 }]),
      turn(2, [{ modelCallId: 'b', inputTokens: 150, outputTokens: 7 }]),
      turn(3, [{ modelCallId: 'c', inputTokens: 180, outputTokens: 9 }]),
    ]);
    expect(calls.get('a')).toMatchObject({ baselineReset: true, inputDeltaTokens: 100 });
    expect(calls.get('b')).toMatchObject({ baselineReset: false, inputDeltaTokens: 50 });
    expect(calls.get('c')).toMatchObject({ baselineReset: false, inputDeltaTokens: 30 });
  });

  it('treats a drop in input as a new baseline rather than a negative growth', () => {
    const calls = modelCallUsage([
      turn(1, [{ modelCallId: 'a', inputTokens: 500, outputTokens: 5 }]),
      turn(2, [{ modelCallId: 'b', inputTokens: 200, outputTokens: 5 }]),
    ]);
    expect(calls.get('b')).toMatchObject({ baselineReset: true, inputDeltaTokens: 200 });
  });

  it('excludes compaction and non-context calls from the comparable chain', () => {
    const calls = modelCallUsage([
      turn(1, [{ modelCallId: 'a', inputTokens: 100, outputTokens: 5 }]),
      turn(2, [{ modelCallId: 'x', inputTokens: 999, outputTokens: 5, purpose: 'compaction' }]),
      turn(3, [{ modelCallId: 'b', inputTokens: 130, outputTokens: 5 }]),
    ]);
    expect(calls.get('x')).toMatchObject({ baselineReset: true, inputDeltaTokens: 999 });
    expect(calls.get('b')).toMatchObject({ baselineReset: false, inputDeltaTokens: 30 });
  });

  it('ignores restored context and invalid measurements', () => {
    const restored: HistoryTurn = { ...turn(1, [{ modelCallId: 'a', inputTokens: 100, outputTokens: 5 }]), payload: { restored_from_turn: 0 } };
    const calls = modelCallUsage([restored, turn(2, [{ modelCallId: 'b', inputTokens: 120, outputTokens: 5 }])]);
    expect(calls.has('a')).toBe(false);
    expect(calls.get('b')).toMatchObject({ baselineReset: true, inputDeltaTokens: 120 });
  });
});
