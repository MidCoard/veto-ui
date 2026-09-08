import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionRecords, listSessionAgents } from '../../api/endpoints';
import { I18nProvider } from '../../i18n/I18nContext';
import SessionRecordsView from './SessionRecordsView';

vi.mock('../../api/endpoints', () => ({ getSessionRecords: vi.fn(), listSessionAgents: vi.fn() }));
vi.mock('../../state/SessionContext', () => ({
  useSessions: () => ({ currentName: 'trace-session', pending: false, sessions: [{ name: 'trace-session', primaryAgentId: 'agent-12345678' }] }),
}));

const emptyToolUsage = {
  totalCalls: 0,
  activeCalls: 0,
  rewoundCalls: 0,
  completedCalls: 0,
  successfulCalls: 0,
  failedCalls: 0,
  pendingCalls: 0,
  syntheticResponses: 0,
  orphanResponses: 0,
  malformedCalls: 0,
  tools: [],
};

describe('SessionRecordsView', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(listSessionAgents).mockResolvedValue([]);
    vi.mocked(getSessionRecords).mockResolvedValue({
      sessionId: 'session-id',
      sessionName: 'trace-session',
      rawRecordCount: 10,
      visibleRecordCount: 7,
      rewoundRecordCount: 2,
      toolResultPresentation: 'DETAILED',
      guidedEnabled: false,
      toolUsage: {
        ...emptyToolUsage,
        totalCalls: 2,
        completedCalls: 2,
        successfulCalls: 1,
        failedCalls: 1,
        tools: [
          {
            toolName: 'run_command',
            totalCalls: 2,
            activeCalls: 2,
            rewoundCalls: 0,
            successfulCalls: 1,
            failedCalls: 1,
            pendingCalls: 0,
            averageDurationMillis: 125,
            maxDurationMillis: 200,
            lastCalledAt: '2026-08-30T00:00:07Z',
            failuresByCode: { TOOL_FAILURE: 1 },
          },
        ],
      },
      records: [
        {
          agentId: 'agent-12345678',
          turnNumber: 1,
          type: 'AGENT_INIT',
          payload: {
            role: 'standalone',
            system_prompt: '# Exact linked system instructions\n\n**Policy:** safe',
            provider: 'DEEPSEEK',
            model: 'm1',
          },
          timestamp: '2026-08-30T00:00:00Z',
          active: true,
          rewoundByTurnNumber: 0,
          rewoundRecords: 0,
        },
        {
          agentId: 'agent-12345678',
          turnNumber: 2,
          type: 'USER_PROMPT',
          payload: { content: 'A visible user request' },
          timestamp: '2026-08-30T00:00:02Z',
          active: true,
          rewoundByTurnNumber: 0,
          rewoundRecords: 0,
        },
        {
          agentId: 'agent-12345678',
          turnNumber: 3,
          type: 'ASSISTANT_RESPONSE',
          payload: { content: 'Superseded answer remains visible' },
          timestamp: '2026-08-30T00:00:03Z',
          active: false,
          rewoundByTurnNumber: 5,
          rewoundRecords: 0,
        },
        {
          agentId: 'agent-12345678',
          turnNumber: 5,
          type: 'REWIND',
          payload: { from_index: 1 },
          timestamp: '2026-08-30T00:00:05Z',
          active: true,
          rewoundByTurnNumber: 0,
          rewoundRecords: 2,
        },
        {
          agentId: 'agent-12345678',
          turnNumber: 6,
          type: 'ASSISTANT_RESPONSE',
          payload: { content: 'Current effective answer' },
          timestamp: '2026-08-30T00:00:06Z',
          active: true,
          rewoundByTurnNumber: 0,
          rewoundRecords: 0,
        },
        {
          agentId: 'agent-12345678',
          turnNumber: 7,
          type: 'TOOL_RESPONSE',
          payload: {
            content: JSON.stringify({
              status: 'success',
              format: 'plaintext',
              content: 'green result',
              errorCode: null,
            }),
            success: true,
            status: 'success',
            format: 'plaintext',
            presentation: 'DETAILED',
          },
          timestamp: '2026-08-30T00:00:07Z',
          active: true,
          rewoundByTurnNumber: 0,
          rewoundRecords: 0,
        },
        {
          agentId: 'agent-12345678',
          turnNumber: 8,
          type: 'TOOL_RESPONSE',
          payload: { content: 'yellow result' },
          timestamp: '2026-08-30T00:00:08Z',
          active: true,
          rewoundByTurnNumber: 0,
          rewoundRecords: 0,
        },
        {
          agentId: 'agent-12345678',
          turnNumber: 9,
          type: 'TOOL_RESPONSE',
          payload: {
            content: 'red result',
            success: false,
            status: 'failure',
            format: 'plaintext',
            errorCode: 'TOOL_FAILURE',
          },
          timestamp: '2026-08-30T00:00:09Z',
          active: true,
          rewoundByTurnNumber: 0,
          rewoundRecords: 0,
        },
      ],
    });
  });

  it('renders the exact prompt and rewind boundary from the server projection', async () => {
    render(
      <I18nProvider>
        <SessionRecordsView />
      </I18nProvider>,
    );

    expect(await screen.findByText('Exact linked system instructions')).toBeInTheDocument();
    expect(screen.getByText('standalone')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Open system prompt'));
    expect(screen.getByRole('heading', { name: 'Exact linked system instructions' })).toBeInTheDocument();
    expect(screen.getByText('Policy:').tagName).toBe('STRONG');
    fireEvent.click(screen.getByRole('button', { name: 'Raw' }));
    expect(screen.queryByRole('heading', { name: 'Exact linked system instructions' })).not.toBeInTheDocument();
    expect(screen.getByText(/# Exact linked system instructions/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Markdown' }));
    expect(screen.getByRole('heading', { name: 'Exact linked system instructions' })).toBeInTheDocument();
    expect(screen.getByText('2 record(s) removed')).toBeInTheDocument();
    expect(screen.getByText('Superseded answer remains visible')).toBeInTheDocument();
    expect(screen.getByText('Rewound by T-05')).toBeInTheDocument();
    expect(screen.getByText('Superseded answer remains visible').closest('article'))
      .toHaveAttribute('data-record-state', 'rewound');
    expect(screen.getByText('Current effective answer')).toBeInTheDocument();
    expect(screen.getByText('A visible user request').closest('article')).toHaveClass('border-sky-500/45');
    expect(screen.getByText('Current effective answer').closest('article')).toHaveClass('border-paper/40');
    expect(screen.getByText('green result').closest('article')).toHaveClass('border-pass/45');
    expect(screen.getByText('yellow result').closest('article')).toHaveClass('border-amber-400/45');
    expect(screen.getByText('red result').closest('article')).toHaveClass('border-verdict/45');
    expect(screen.getByText('Additional tool-result information')).toBeInTheDocument();
    expect(screen.getByText('TOOL_FAILURE')).toBeInTheDocument();
  });

  it('selects a child stream independently and lists agents without saved turns', async () => {
    const initial = await getSessionRecords('trace-session');
    vi.mocked(getSessionRecords).mockResolvedValue({ ...initial, records: [...initial.records, {
      agentId: 'child', turnNumber: 1, type: 'USER_PROMPT', payload: { content: 'Read the child objective' },
      timestamp: '2026-08-30T00:00:10Z', active: true, rewoundByTurnNumber: 0, rewoundRecords: 0,
    }] });
    const metadata = { role: 'STANDALONE' as const, state: 'TERMINATED' as const, live: false, parentAgentId: 'agent-12345678', parentCallId: 'fetch', createdAt: null, startedAt: null, endedAt: null };
    vi.mocked(listSessionAgents).mockResolvedValue([
      { ...metadata, id: 'child', name: 'Web reader' },
      { ...metadata, id: 'old-child', name: 'Older reader' },
    ]);
    render(<I18nProvider><SessionRecordsView /></I18nProvider>);
    const childCard = await screen.findByRole('button', { name: /Web reader/ });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /All agents/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Primary agent/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('A visible user request')).toBeInTheDocument();
    expect(screen.queryByText('Read the child objective')).not.toBeInTheDocument();
    fireEvent.click(childCard);
    expect(childCard).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Read the child objective')).toBeInTheDocument();
    expect(screen.queryByText('A visible user request')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Older reader/ }));
    expect(screen.getByText(/No saved execution records/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Primary agent/ }));
    expect(screen.getByText('A visible user request')).toBeInTheDocument();
  });

  it('renders content-only mode without the metadata grid', async () => {
    vi.mocked(getSessionRecords).mockResolvedValue({
      sessionId: 'content-only-id',
      sessionName: 'trace-session',
      rawRecordCount: 1,
      visibleRecordCount: 1,
      rewoundRecordCount: 0,
      toolResultPresentation: 'BASIC',
      guidedEnabled: false,
      toolUsage: emptyToolUsage,
      records: [
        {
          agentId: 'agent-content-only',
          turnNumber: 1,
          type: 'TOOL_RESPONSE',
          payload: {
            content: 'the exact same tool content',
            success: false,
            status: 'failure',
            format: 'plaintext',
            errorCode: 'HIDDEN_IN_THIS_MODE',
          },
          timestamp: '2026-08-30T00:00:00Z',
          active: true,
          rewoundByTurnNumber: 0,
          rewoundRecords: 0,
        },
      ],
    });

    render(
      <I18nProvider>
        <SessionRecordsView />
      </I18nProvider>,
    );

    expect(await screen.findByText('the exact same tool content')).toBeInTheDocument();
    expect(screen.queryByText(/Additional tool-result information/)).not.toBeInTheDocument();
    expect(screen.queryByText('HIDDEN_IN_THIS_MODE')).not.toBeInTheDocument();
    expect(screen.queryByText('Error code')).not.toBeInTheDocument();
  });

  it('does not expose the legacy migration sentinel as an agent role', async () => {
    vi.mocked(getSessionRecords).mockResolvedValue({
      sessionId: 'legacy-session-id',
      sessionName: 'trace-session',
      rawRecordCount: 1,
      visibleRecordCount: 1,
      rewoundRecordCount: 0,
      toolResultPresentation: 'DETAILED',
      guidedEnabled: false,
      toolUsage: emptyToolUsage,
      records: [
        {
          agentId: 'agent-legacy-row',
          turnNumber: 1,
          type: 'AGENT_INIT',
          payload: {
            role: 'legacy',
            system_prompt: 'Old prompt',
            provider: 'DEEPSEEK',
            model: 'old-model',
          },
          timestamp: '2026-08-30T00:00:00Z',
          active: true,
          rewoundByTurnNumber: 0,
          rewoundRecords: 0,
        },
      ],
    });

    render(
      <I18nProvider>
        <SessionRecordsView />
      </I18nProvider>,
    );

    expect(await screen.findByText('Provider: DEEPSEEK')).toBeInTheDocument();
    expect(screen.queryByText('legacy')).not.toBeInTheDocument();
  });
  it('shows a guide-only response as a plan, separately from actual calls', async () => {
    vi.mocked(getSessionRecords).mockResolvedValue({
      sessionId: 'guided', sessionName: 'trace-session', rawRecordCount: 1,
      visibleRecordCount: 1, rewoundRecordCount: 0, toolResultPresentation: 'BASIC',
      guidedEnabled: true, toolUsage: emptyToolUsage,
      records: [{ agentId: 'agent', turnNumber: 1, type: 'ASSISTANT_THOUGHT',
        payload: { response: JSON.stringify({ guide: { actions: [{ id: 'read', label: 'Read the sample', type: 'tool', tool: 'read_file', inputs: { path: 'sample.txt' } }, { id: 'branch', label: 'Check the result', type: 'conditional_goto', true_goto: 2, false_goto: 3 }, { id: 'done', label: 'Finish', type: 'STOP', result_binding: '$answer' }] } }) },
        timestamp: '2026-09-05T00:00:00Z', active: true, rewoundByTurnNumber: 0, rewoundRecords: 0 }],
    });
    render(<I18nProvider><SessionRecordsView /></I18nProvider>);
    expect(await screen.findByText('Guided execution enabled')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Guided program · planned steps' })).toBeInTheDocument();
    expect(screen.getByText(/This is the submitted plan/)).toBeInTheDocument();
    expect(screen.getByText('Read the sample')).toBeVisible();
    expect(screen.getByText('tool · read_file')).toBeVisible();
    expect(screen.getByText('conditional_goto · true → 2 · false → 3')).toBeVisible();
    expect(screen.getByText('STOP · $answer')).toBeVisible();
    expect(screen.getByText('Arguments').closest('details')).not.toHaveAttribute('open');
  });

});
