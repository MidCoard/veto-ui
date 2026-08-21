import { describe, expect, it } from 'vitest';
import type { HistoryTurn, PendingVeto } from '../api/types';
import {
  deriveEntries,
  entriesFromHistory,
  errorEntry,
  liveEntry,
  mergeVetoes,
  reconcileLocal,
  turnLabel,
  userEntry,
} from './ledger';

function turn(turnNumber: number, type: string, payload: Record<string, unknown>): HistoryTurn {
  return { turnNumber, type, payload, timestamp: '2026-08-10T10:00:00Z' };
}

describe('entriesFromHistory', () => {
  it('maps persisted turn types onto ledger kinds with the real turnNumber', () => {
    const entries = entriesFromHistory([
      turn(1, 'USER_PROMPT', { content: 'hello agent' }),
      turn(2, 'ASSISTANT_RESPONSE', { content: 'hi human' }),
      turn(3, 'TOOL_CALL', { call_id: 'c1', tool_name: 'read_file', args: { path: 'a.ts' } }),
      turn(4, 'TOOL_RESPONSE', { call_id: 'c1', content: 'file body', success: true }),
    ]);

    expect(entries.map((entry) => entry.kind)).toEqual([
      'user',
      'message',
      'tool_call',
      'tool_result',
    ]);
    expect(entries[0]).toMatchObject({ seq: 0, text: 'hello agent' });
    expect(entries[1]).toMatchObject({ seq: 2, text: 'hi human' });
    expect(entries[2]).toMatchObject({ seq: 3, toolName: 'read_file', args: { path: 'a.ts' } });
    expect(entries[3]).toMatchObject({ seq: 4, text: 'file body', success: true });
  });

  it('carries the tool name onto tool_result entries via call_id', () => {
    const entries = entriesFromHistory([
      turn(3, 'TOOL_CALL', { call_id: 'c1', tool_name: 'run_command', args: {} }),
      turn(4, 'TOOL_CALL', { call_id: 'c2', tool_name: 'write_to_file', args: {} }),
      turn(5, 'TOOL_RESPONSE', { call_id: 'c2', content: '{"status":"ok"}', success: true }),
      turn(6, 'TOOL_RESPONSE', { call_id: 'c1', content: 'out', success: true }),
    ]);
    expect(entries[2]).toMatchObject({ kind: 'tool_result', toolName: 'write_to_file' });
    expect(entries[3]).toMatchObject({ kind: 'tool_result', toolName: 'run_command' });
  });

  it('parses the veto_pulse JSON in ASSISTANT_THOUGHT payloads down to `thought`', () => {
    const entries = entriesFromHistory([
      turn(5, 'ASSISTANT_THOUGHT', {
        response: JSON.stringify({ thought: 'thinking about files', pulse: 0.9 }),
      }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'thought', seq: 5, text: 'thinking about files' });
  });

  it('shows the raw string when the thought payload is not parseable JSON', () => {
    const entries = entriesFromHistory([
      turn(6, 'ASSISTANT_THOUGHT', { response: 'not json at all' }),
    ]);
    expect(entries[0]).toMatchObject({ kind: 'thought', text: 'not json at all' });
  });

  it('skips meta turns entirely', () => {
    const entries = entriesFromHistory([
      turn(1, 'AGENT_INIT', {}),
      turn(2, 'REWIND', {}),
      turn(3, 'COMPACTION_SUMMARY', { content: 'summary' }),
      turn(4, 'RECALL', {}),
      turn(5, 'USER_INTERRUPT', {}),
    ]);
    expect(entries).toEqual([]);
  });

  it('flags failed tool results and tolerates missing fields', () => {
    const entries = entriesFromHistory([
      turn(7, 'TOOL_RESPONSE', { call_id: 'c9', content: 'boom', success: false }),
      turn(8, 'TOOL_CALL', { call_id: 'c9' }),
    ]);
    expect(entries[0]).toMatchObject({ kind: 'tool_result', success: false, text: 'boom' });
    expect(entries[1]).toMatchObject({ kind: 'tool_call', text: '', args: undefined });
  });

  it('returns an empty ledger for an empty history', () => {
    expect(entriesFromHistory([])).toEqual([]);
  });
});

describe('turnLabel', () => {
  it('pads real turn numbers', () => {
    expect(turnLabel(3)).toBe('T-03');
    expect(turnLabel(42)).toBe('T-42');
  });
});

describe('entriesFromHistory stable ids', () => {
  const turns = [
    turn(1, 'USER_PROMPT', { content: 'hi' }),
    turn(2, 'ASSISTANT_RESPONSE', { content: 'hello' }),
    turn(3, 'TOOL_CALL', { call_id: 'c1', tool_name: 'run_command', args: {} }),
    turn(4, 'TOOL_RESPONSE', { call_id: 'c1', content: 'ok', success: true }),
  ];

  it('keys entries by turnNumber so rebuilds keep React keys (and UI state)', () => {
    expect(entriesFromHistory(turns).map((entry) => entry.id)).toEqual([
      'h-1',
      'h-2',
      'h-3',
      'h-4',
    ]);
  });

  it('produces identical entries when rebuilt from a longer history', () => {
    const first = entriesFromHistory(turns);
    const second = entriesFromHistory([
      ...turns,
      turn(5, 'ASSISTANT_RESPONSE', { content: 'more' }),
    ]);
    expect(second.slice(0, first.length)).toEqual(first);
  });
});

describe('liveEntry', () => {
  it('carries seq -1 — no persisted turn, never a fake T label', () => {
    expect(liveEntry('thought', 'thinking')).toMatchObject({
      kind: 'thought',
      seq: -1,
      live: true,
    });
  });
});

describe('reconcileLocal', () => {
  it('drops the local user entry once its USER_PROMPT turn persists', () => {
    const local = [userEntry('hello agent')];
    expect(reconcileLocal([turn(1, 'USER_PROMPT', { content: 'hello agent' })], local)).toEqual([]);
  });

  it('drops live thought/message entries covered by history, keeping later live ones', () => {
    const local = [
      liveEntry('thought', 'first thought'),
      liveEntry('thought', 'second thought'),
      liveEntry('message', 'partial reply'),
    ];
    const remaining = reconcileLocal(
      [turn(2, 'ASSISTANT_THOUGHT', { response: JSON.stringify({ thought: 'first thought' }) })],
      local,
    );
    expect(remaining.map((entry) => entry.text)).toEqual(['second thought', 'partial reply']);
  });

  it('consumes duplicates one-for-one, FIFO', () => {
    const local = [userEntry('same'), userEntry('same')];
    const remaining = reconcileLocal([turn(1, 'USER_PROMPT', { content: 'same' })], local);
    expect(remaining).toHaveLength(1);
  });

  it('keeps error entries and unmatched locals', () => {
    const local = [userEntry('other prompt'), errorEntry('boom')];
    expect(
      reconcileLocal([turn(1, 'USER_PROMPT', { content: 'hello' })], local).map((e) => e.kind),
    ).toEqual(['user', 'error']);
  });
});

describe('deriveEntries', () => {
  it('appends local entries after the persisted ones', () => {
    const ledger = {
      turns: [turn(1, 'USER_PROMPT', { content: 'hi' })],
      local: [liveEntry('thought', 'thinking')],
    };
    expect(deriveEntries(ledger).map((entry) => entry.kind)).toEqual(['user', 'thought']);
  });

  it('renders local entries alone before the first history fetch', () => {
    expect(deriveEntries({ turns: undefined, local: [userEntry('hi')] })).toHaveLength(1);
  });
});

describe('mergeVetoes', () => {
  const veto = (callId: string): PendingVeto => ({
    callId,
    toolName: 'run_command',
    args: {},
    options: ['ACCEPT_COMMAND', 'EXEC_DECLINE'],
  });

  it('keeps first-seen order and appends newly parked vetoes behind', () => {
    const first = mergeVetoes([], [veto('c1')]);
    const second = mergeVetoes(first, [veto('c2'), veto('c1')]);
    expect(second.map((v) => v.callId)).toEqual(['c1', 'c2']);
  });

  it('drops resolved vetoes without disturbing the rest', () => {
    const merged = mergeVetoes([veto('c1'), veto('c2'), veto('c3')], [veto('c3'), veto('c1')]);
    expect(merged.map((v) => v.callId)).toEqual(['c1', 'c3']);
  });

  it('picks up updated fields from the fresh poll', () => {
    const updated = { ...veto('c1'), toolName: 'write_to_file' };
    expect(mergeVetoes([veto('c1')], [updated])[0].toolName).toBe('write_to_file');
  });
});
