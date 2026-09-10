import { expect, it } from 'vitest';
import { quotationSource } from './QuotationSource';
import type { SessionRecord } from '../../api/types';
const record: SessionRecord = { agentId: 'agent', turnNumber: 5, type: 'TOOL_RESPONSE', payload: { content: JSON.stringify({ status: 'success', format: 'json', content: JSON.stringify({ evidence: [{ quote: 'before cited\nwords after' }] }) }) }, timestamp: '', active: true, rewoundByTurnNumber: 0, rewoundRecords: 0 };
const location = { session: 'session', agent: 'agent', turn: 5, field: 'evidence[0].quote', start: 7, end: 18, text: 'cited\nwords' };
it('resolves a decoded detailed evidence field and preserves its exact line breaks', () => {
  expect(quotationSource(record, location)).toBe('before cited\nwords after');
});
it('rejects changed text, invalid ranges, another agent and arbitrary field paths', () => {
  expect(quotationSource(record, { ...location, text: 'other' })).toBeNull();
  expect(quotationSource(record, { ...location, start: -1 })).toBeNull();
  expect(quotationSource(record, { ...location, agent: 'other' })).toBeNull();
  expect(quotationSource(record, { ...location, field: '__proto__.quote' })).toBeNull();
});

it('resolves decoded tool text through a bounded JSON path without treating property names as code', () => {
  const nested = { ...record, payload: { content: JSON.stringify({ 'text/#': 'line one\nline two' }) } };
  expect(quotationSource(nested, { ...location, field: 'json:["content","text/#"]', start: 0, end: 17, text: 'line one\nline two' })).toBe('line one\nline two');
  expect(quotationSource(nested, { ...location, field: 'json:["__proto__"]' })).toBeNull();
  expect(quotationSource(nested, { ...location, field: 'json:["content","__proto__"]' })).toBeNull();
});
