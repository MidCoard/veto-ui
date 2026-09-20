import { resetSessionResources, sessionResources } from '../state/sessionResources';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import ConversationPane from './ConversationPane';
import SessionAgents from './SessionAgents';
import { getSessionRecords, listSessionAgents } from '../api/endpoints';

vi.mock('../api/endpoints', () => ({ getSessionRecords: vi.fn(), listSessionAgents: vi.fn(), sendAgentPrompt: vi.fn() }));
vi.mock('../state/SessionContext', () => ({ useSessions: () => ({ currentName: 'session', pending: false, sessions: [{ name: 'session', primaryAgentId: 'primary' }] }) }));
vi.mock('./ledger/LedgerStream', () => ({ default: () => <div>Live primary conversation</div> }));
vi.mock('./Composer', () => ({ default: () => <textarea aria-label="Send message" className="resize-none" /> }));

function Flow() {
  const [selected, select] = useState<string | null>(null);
  return <I18nProvider><ConversationPane selectedAgent={selected} /><SessionAgents selectedAgent={selected} onSelectAgent={select} /></I18nProvider>;
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(listSessionAgents).mockResolvedValue(['primary', 'child'].map((id) => ({ id, name: id, role: 'STANDALONE', state: 'IDLE', live: true, parentAgentId: id === 'child' ? 'primary' : null, parentCallId: id === 'child' ? 'call' : null, createdAt: null, startedAt: null, endedAt: null })));
  const record = { timestamp: '', active: true, rewoundByTurnNumber: 0, rewoundRecords: 0 };
  vi.mocked(getSessionRecords).mockResolvedValue({
    sessionId: 's', sessionName: 'session', rawRecordCount: 5, visibleRecordCount: 4, rewoundRecordCount: 1, toolResultPresentation: 'BASIC',
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

it('shows direct input only for live agents that explicitly enable interaction', async () => {
  const agents = await listSessionAgents('session');
  vi.mocked(listSessionAgents).mockResolvedValue(agents.map(agent => ({ ...agent, userInteractionEnabled: true })));
  const view = render(<I18nProvider><ConversationPane selectedAgent="child" /></I18nProvider>);
  expect(await screen.findByRole('textbox', { name: 'Message this agent' })).toBeInTheDocument();
  view.unmount();
  vi.mocked(listSessionAgents).mockResolvedValue(agents.map(agent => ({ ...agent, userInteractionEnabled: true, live: false })));
  sessionResources('session').agents.invalidate();
  render(<I18nProvider><ConversationPane selectedAgent="child" /></I18nProvider>);
  await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  await screen.findByText('Child answer');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

afterEach(() => resetSessionResources());

it('removes the previous interactive mate conversation and draft when switching mates', async () => {
  const agents = await listSessionAgents('session');
  vi.mocked(listSessionAgents).mockResolvedValue([
    ...agents.map(agent => ({ ...agent, userInteractionEnabled: true })),
    { ...agents[1], id: 'second', name: 'second', userInteractionEnabled: true },
  ]);
  const history = await getSessionRecords('session');
  vi.mocked(getSessionRecords).mockResolvedValue({ ...history, records: [
    ...history.records,
    { ...history.records[3], agentId: 'second', payload: { content: 'Second mate answer' } },
  ] });
  render(<Flow />);
  fireEvent.click(await screen.findByRole('button', { name: 'View conversation: child' }));
  expect(screen.getByText('Child answer')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Message this agent' }), { target: { value: 'Unsent child draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'View conversation: second' }));
  expect(screen.getByText('Second mate answer')).toBeInTheDocument();
  expect(screen.queryByText('Child answer')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Message this agent' })).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'View conversation: child' }));
  expect(screen.getAllByText('Child answer')).toHaveLength(1);
  expect(screen.queryByText('Second mate answer')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Message this agent' })).toHaveValue('');
});

it('keeps recovery guidance scoped to the selected agent and clears it after refresh', async () => {
  const agents = await listSessionAgents('session');
  vi.mocked(listSessionAgents).mockResolvedValue(agents.map(agent => ({ ...agent, executionWait: agent.id === 'child' ? 'QUESTION' : null })));
  render(<Flow />);
  fireEvent.click(await screen.findByRole('button', { name: 'View conversation: child' }));
  expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Awaiting your answer');
  fireEvent.click(screen.getByRole('button', { name: 'View conversation: primary' }));
  expect(screen.queryByRole('status', { name: '' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View conversation: child' }));
  vi.mocked(listSessionAgents).mockRejectedValue(new Error('offline'));
  act(() => sessionResources('session').agents.invalidate());
  await screen.findAllByRole('alert');
  expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Last known state');
  vi.mocked(listSessionAgents).mockResolvedValue(agents);
  act(() => sessionResources('session').agents.invalidate());
  await waitFor(() => expect(screen.queryByRole('status', { name: '' })).not.toBeInTheDocument());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('shows weighted cache totals for the selected child without leaking sibling usage', async () => {
  const history = await getSessionRecords('session');
  const cached = { inputTokens: 100, outputTokens: 5, cacheReadInputTokens: 80 };
  vi.mocked(getSessionRecords).mockResolvedValue({ ...history, records: history.records.map(record => ({
    ...record, llmUsage: record.agentId === 'primary'
      ? [{ ...cached, cacheReadInputTokens: 99 }]
      : record.turnNumber === 2 ? [cached, { inputTokens: 900, outputTokens: 5, cacheReadInputTokens: 0 }]
      : record.llmUsage,
  })) });
  render(<Flow />);
  fireEvent.click(await screen.findByRole('button', { name: 'View conversation: child' }));
  const status = screen.getByLabelText('Token usage');
  expect(status).toHaveTextContent(/Cache hit rate:\s*8.0%/);
  fireEvent.click(screen.getByRole('button', { name: 'View conversation: primary' }));
  expect(screen.queryByLabelText('Token usage')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View conversation: child' }));
  expect(screen.getByLabelText('Token usage')).toHaveTextContent(/Cache hit rate:\s*8.0%/);
});

it('shows recovery guidance while conversation history is still loading', async () => {
  const agents = await listSessionAgents('session');
  vi.mocked(listSessionAgents).mockResolvedValue(agents.map(agent => ({ ...agent, executionWait: 'APPROVAL' })));
  vi.mocked(getSessionRecords).mockReturnValue(new Promise(() => {}));
  render(<I18nProvider><ConversationPane selectedAgent={null} /></I18nProvider>);
  expect(await screen.findByRole('status', { name: '' })).toHaveTextContent('Awaiting approval');
});

it('counts recoverable response errors per agent without stopped-run cards', async () => {
  const history = await getSessionRecords('session');
  vi.mocked(getSessionRecords).mockResolvedValue({ ...history, records: [
    ...history.records,
    { ...history.records[0], turnNumber: 2, type: 'EXECUTION_ERROR', payload: { content: 'Primary JSON error', recoverable: true } },
    { ...history.records[1], turnNumber: 5, type: 'EXECUTION_ERROR', payload: { content: 'Child JSON error', recoverable: true } },
    { ...history.records[1], turnNumber: 6, type: 'EXECUTION_ERROR', payload: { content: 'Child JSON error', recoverable: true } },
  ] });
  render(<Flow />);
  expect(await screen.findByText('Response retries: 1')).toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'View conversation: child' }));
  expect(await screen.findByText('Response retries: 2')).toBeInTheDocument();
  expect(screen.queryByText('Child JSON error')).not.toBeInTheDocument();
  expect(screen.queryByText('Execution failed')).not.toBeInTheDocument();
});

it('switches plugin context with the selected agent instead of showing the installed total', async () => {
  const agents = await listSessionAgents('session');
  vi.mocked(listSessionAgents).mockResolvedValue(agents.map(agent => ({ ...agent,
    pluginContext: { lastRequest: true, plugins: agent.id === 'primary'
      ? [{ id: 'text', version: '0.1.0', tools: ['plugin_text__length'] }] : [] },
  })));
  render(<Flow />);
  expect(await screen.findByText('Plugins 1')).toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'View conversation: child' }));
  expect(screen.getByText('Plugins 0')).toBeInTheDocument();
  expect(screen.queryByText('Plugins 1')).not.toBeInTheDocument();
});
