import { describe, expect, it } from 'vitest';
import { combineToolEntries, entriesFromHistory, type LedgerEntry } from './ledger';

const call = (id: string): LedgerEntry => ({ id, callId: id, kind: 'tool_call', seq: 1, text: 'web_fetch', toolName: 'web_fetch' });
const result = (id: string): LedgerEntry => ({ id: `${id}-result`, callId: id, kind: 'tool_result', seq: 2, text: id, toolName: 'web_fetch', success: true });

describe('conversation tool grouping', () => {
  it('pairs interleaved calls by identity and keeps orphan results visible', () => {
    const input = [call('one'), call('two'), result('two'), result('one'), result('orphan')];
    const grouped = combineToolEntries(input);
    expect(grouped).toHaveLength(3);
    expect(grouped[0].resultEntry?.text).toBe('one');
    expect(grouped[1].resultEntry?.text).toBe('two');
    expect(grouped[2].callId).toBe('orphan');
    expect(input[0].resultEntry).toBeUndefined();
  });

  it('preserves call IDs when projecting persisted history', () => {
    const entries = entriesFromHistory([
      { turnNumber: 1, type: 'TOOL_CALL', payload: { call_id: 'fetch', tool_name: 'web_fetch', args: { url: 'https://example.com' } } },
      { turnNumber: 2, type: 'TOOL_RESPONSE', payload: { call_id: 'fetch', content: 'Answer', success: true } },
    ]);
    expect(combineToolEntries(entries)).toHaveLength(1);
    expect(combineToolEntries(entries)[0].resultEntry?.text).toBe('Answer');
  });

  it('only pairs adjacent unambiguous legacy entries without IDs', () => {
    const a = { ...call('a'), callId: undefined };
    const b = { ...result('a'), callId: undefined };
    expect(combineToolEntries([a, b])).toHaveLength(1);
    expect(combineToolEntries([a, { ...a, id: 'second' }, b])).toHaveLength(3);
    const message: LedgerEntry = { id: 'message', seq: 3, kind: 'message', text: 'Intervening message' };
    expect(combineToolEntries([a, message, b])).toHaveLength(3);
  });
});
