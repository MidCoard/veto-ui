import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { I18nProvider } from '../../i18n/I18nContext';
import type { SessionRecord } from '../../api/types';
import { entriesFromHistory } from '../../state/ledger';
import ConversationTimeline from './ConversationTimeline';
afterEach(cleanup);
it('uses the full first input and differences for subsequent inputs', () => {
  const records: SessionRecord[] = [
    { ...record(1, 'hello'), type: 'USER_PROMPT', payload: { content: 'hello', llmUsage: [{ modelCallId: 'first', inputTokens: 100, outputTokens: 8 }] }, tokenCount: 2, tokenCountSource: 'measured' },
    { ...record(2, ''), type: 'TOOL_CALL', payload: { call_id: 'c', tool_name: 'read_file', args: {}, model_call_id: 'first' }, tokenCount: 8, tokenCountSource: 'measured' },
    { ...record(3, 'result'), type: 'TOOL_RESPONSE', payload: { call_id: 'c', content: 'result', success: true, llmUsage: [{ modelCallId: 'second', inputTokens: 150, outputTokens: 19 }] }, tokenCount: 12, tokenCountSource: 'measured' },
    { ...record(4, 'answer'), payload: { content: 'answer', model_call_id: 'second' } },
    { ...record(5, 'next'), type: 'USER_PROMPT', payload: { content: 'next', llmUsage: [{ modelCallId: 'third', inputTokens: 180, outputTokens: 4, inputDeltaTokens: 11, inputDeltaSource: 'request_difference' }] } },
  ];
  render(<I18nProvider><ConversationTimeline records={records} entries={entriesFromHistory(records)} /></I18nProvider>);
  expect(screen.getByText('Input tokens: 100')).toBeInTheDocument();
  expect(screen.getByText('Input tokens: 11')).toBeInTheDocument();
  expect(screen.getByText('Input tokens: 12')).toBeInTheDocument();
  expect(screen.getByText('Output tokens: 8')).toBeInTheDocument();
  expect(screen.getByText('Output tokens: 19')).toBeInTheDocument();
  expect(screen.queryByText(/Input increase/)).not.toBeInTheDocument();
});
function record(turnNumber: number, content: string, rewind = 0): SessionRecord {
  return { turnNumber, agentId: 'primary', type: 'ASSISTANT_RESPONSE', payload: { content }, timestamp: '', active: rewind === 0, rewoundByTurnNumber: rewind, rewoundRecords: 0 };
}
it('collapses only rewound entries at their chronological location and expands on demand', () => {
  const records = [record(1, 'Earlier context', 3), record(2, 'Retained context'), record(4, 'Current context')];
  render(<I18nProvider><ConversationTimeline records={records} entries={entriesFromHistory(records)} /></I18nProvider>);
  expect(screen.queryByText('Earlier context')).not.toBeInTheDocument();
  expect(screen.getByText('Retained context')).toBeInTheDocument();
  expect(screen.getByText('Current context')).toBeInTheDocument();
  const toggle = screen.getByRole('button', { name: /Previous conversation/ });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(toggle);
  expect(screen.getAllByText('Earlier context')).toHaveLength(1);
  fireEvent.click(toggle);
  expect(screen.queryByText('Earlier context')).not.toBeInTheDocument();
});
it('keeps separate rewind boundaries independently expandable', () => {
  const records = [record(1, 'First history', 2), record(3, 'Second history', 4), record(5, 'Current')];
  render(<I18nProvider><ConversationTimeline records={records} entries={entriesFromHistory(records.filter(record => record.active))} /></I18nProvider>);
  const toggles = screen.getAllByRole('button', { name: /Previous conversation/ });
  expect(toggles).toHaveLength(2);
  fireEvent.click(toggles[1]);
  expect(screen.queryByText('First history')).not.toBeInTheDocument();
  expect(screen.getByText('Second history')).toBeInTheDocument();
});
it('does not infer a rewind from group tool names or superseded records', () => {
  const records = [record(1, 'Superseded'), { ...record(2, ''), type: 'TOOL_CALL' as const, payload: { tool_name: 'create_group', args: { task: 'Build feature' } } }];
  records[0].active = false;
  render(<I18nProvider><ConversationTimeline records={records} entries={entriesFromHistory(records)} /></I18nProvider>);
  expect(screen.queryByRole('button', { name: /Previous conversation/ })).not.toBeInTheDocument();
  expect(screen.getByText('Build feature')).toBeInTheDocument();
  expect(screen.queryByText('Superseded')).not.toBeInTheDocument();
});
