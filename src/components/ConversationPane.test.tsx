import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import ConversationPane from './ConversationPane';
import SessionAgents from './SessionAgents';
import { getSessionRecords, listSessionAgents } from '../api/endpoints';

vi.mock('../api/endpoints', () => ({ getSessionRecords: vi.fn(), listSessionAgents: vi.fn() }));
vi.mock('../state/SessionContext', () => ({ useSessions: () => ({ currentName: 'session', pending: false, sessions: [{ name: 'session', primaryAgentId: 'primary' }] }) }));
vi.mock('./ledger/LedgerStream', () => ({ default: () => <div>Live primary conversation</div> }));
vi.mock('./Composer', () => ({ default: () => <textarea aria-label="Send message" /> }));

function Flow() {
  const [selected, select] = useState<string | null>(null);
  return <I18nProvider><ConversationPane selectedAgent={selected} /><SessionAgents selectedAgent={selected} onSelectAgent={select} /></I18nProvider>;
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(listSessionAgents).mockResolvedValue(['primary', 'child'].map((id) => ({ id, name: id, role: 'STANDALONE', state: 'IDLE', live: true, parentAgentId: id === 'child' ? 'primary' : null, parentCallId: id === 'child' ? 'call' : null, createdAt: null, startedAt: null, endedAt: null })));
  const record = { timestamp: '', active: true, rewoundByTurnNumber: 0, rewoundRecords: 0 };
  vi.mocked(getSessionRecords).mockResolvedValue({
    sessionId: 's', sessionName: 'session', rawRecordCount: 5, visibleRecordCount: 4, rewoundRecordCount: 1, toolResultPresentation: 'BASIC', guidedEnabled: false,
    toolUsage: { totalCalls: 0, activeCalls: 0, rewoundCalls: 0, completedCalls: 0, successfulCalls: 0, failedCalls: 0, pendingCalls: 0, syntheticResponses: 0, orphanResponses: 0, malformedCalls: 0, tools: [] },
    records: [
      { ...record, agentId: 'primary', turnNumber: 1, type: 'AGENT_INIT', payload: { system_prompt: 'Primary instructions' } },
      { ...record, agentId: 'child', turnNumber: 1, type: 'AGENT_INIT', payload: { system_prompt: 'Child instructions' } },
      { ...record, agentId: 'child', turnNumber: 2, type: 'USER_PROMPT', payload: { content: 'Read this document' } },
      { ...record, agentId: 'child', turnNumber: 3, type: 'ASSISTANT_RESPONSE', payload: { content: 'Child answer' } },
      { ...record, agentId: 'child', turnNumber: 4, type: 'ASSISTANT_RESPONSE', active: false, payload: { content: 'Rewound answer' } },
    ],
  });
});

it('switches agent conversations without exposing system prompts or sending child messages to the primary agent', async () => {
  render(<Flow />);
  await screen.findByRole('button', { name: 'View conversation: child' });
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Open system prompt' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View conversation: child' }));
  expect(screen.getByRole('button', { name: 'View conversation: child' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('Read this document')).toBeInTheDocument();
  expect(screen.getByText('Child answer')).toBeInTheDocument();
  expect(screen.queryByText('Rewound answer')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Send message')).not.toBeInTheDocument();
  expect(screen.queryByText('Child instructions')).not.toBeInTheDocument();
  expect(screen.queryByText('Primary instructions')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View conversation: primary' }));
  expect(screen.getByText('Live primary conversation')).toBeInTheDocument();
  expect(screen.getByLabelText('Send message')).toBeInTheDocument();
});
