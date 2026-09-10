import { resetSessionResources, sessionResources } from '../state/sessionResources';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { listSessionAgents, getSessionRecords } from '../api/endpoints';
import SessionAgents from './SessionAgents';
import type { SessionRecordsView } from '../api/types';
const emptyRecords: SessionRecordsView = {
  sessionId: 's', sessionName: 'first', rawRecordCount: 0, visibleRecordCount: 0, rewoundRecordCount: 0,
  toolResultPresentation: 'BASIC', guidedEnabled: false, records: [],
  toolUsage: { totalCalls: 0, activeCalls: 0, rewoundCalls: 0, completedCalls: 0, successfulCalls: 0,
    failedCalls: 0, pendingCalls: 0, syntheticResponses: 0, orphanResponses: 0, malformedCalls: 0, tools: [] },
};

let currentName = 'first';
vi.mock('../state/SessionContext', () => ({ useSessions: () => ({ currentName, sessions: [{ name: 'first', primaryAgentId: 'parent' }] }) }));
vi.mock('../api/endpoints', () => ({ listSessionAgents: vi.fn(), getSessionRecords: vi.fn() }));
beforeEach(() => { vi.mocked(getSessionRecords).mockResolvedValue(emptyRecords); });
const parent = { id: 'parent', name: 'Main', role: 'MATE' as const, state: 'WAITING' as const, parentAgentId: null, parentCallId: null, live: true, createdAt: null, startedAt: null, endedAt: null };
const child = { id: 'reader', name: 'Web reader', role: 'STANDALONE' as const, state: 'RUNNING' as const, parentAgentId: 'parent', parentCallId: 'call-1', live: true, createdAt: null, startedAt: null, endedAt: null };
const view = () => <I18nProvider><SessionAgents /></I18nProvider>;

afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); currentName = 'first'; });

describe('session agents', () => {
  it('shows per-agent usage and adds child usage only to the session total', async () => {
    vi.mocked(listSessionAgents).mockResolvedValue([parent, child]);
    vi.mocked(getSessionRecords).mockResolvedValue({ ...emptyRecords, records: [
      { agentId: 'parent', turnNumber: 1, type: 'USER_PROMPT', timestamp: '', active: true, rewoundByTurnNumber: 0, rewoundRecords: 0, payload: { content: 'hello', llmUsage: [{ inputTokens: 100, outputTokens: 20, contextMaxTokens: 128000 }] } },
      { agentId: 'reader', turnNumber: 1, type: 'USER_PROMPT', timestamp: '', active: true, rewoundByTurnNumber: 0, rewoundRecords: 0, payload: { content: 'read', llmUsage: [{ inputTokens: 500, outputTokens: 10, contextMaxTokens: 64000 }] } },
    ] });
    render(view());
    expect(await screen.findByText('Session total tokens: 630')).toBeInTheDocument();
    expect(screen.getByText('Used tokens: 120')).toBeInTheDocument();
    expect(screen.getByText('Used tokens: 510')).toBeInTheDocument();
  });
  it('keeps an ended child and counts the idle primary after runtime cleanup', async () => {
    vi.useFakeTimers();
    vi.mocked(listSessionAgents).mockResolvedValueOnce([parent, child]).mockResolvedValue([{ ...parent, state: 'IDLE' }, { ...child, live: false, state: 'TERMINATED', endedAt: Date.parse('2026-09-08T10:00:00Z') / 1000 }]);
    const rendered = render(view());
    await act(async () => {});
    expect(screen.getByText('Web reader')).toBeInTheDocument();
    expect(screen.getByText(/由 Main 启动|Started by Main/)).toBeInTheDocument();
    expect(screen.getByText(/工具 Agent|Tool agent/)).toBeInTheDocument();
    expect(screen.getByText(/主 Agent|Primary agent/)).toBeInTheDocument();
    await act(async () => { sessionResources('first').agents.invalidate(); await vi.advanceTimersByTimeAsync(250); });
    expect(screen.getByText('Web reader')).toBeInTheDocument();
    expect(screen.getByText(/0 个工作中 \/ 共 2 个|0 working \/ 2 total/)).toBeInTheDocument();
    expect(screen.getByText(/空闲|Idle/)).toBeInTheDocument();
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(rendered.container.querySelector('time')).toHaveAttribute('datetime', '2026-09-08T10:00:00.000Z');
  });

  it('identifies a dormant primary from session ownership and distinguishes mates from tool children', async () => {
    vi.mocked(listSessionAgents).mockResolvedValue([
      { ...parent, live: false, state: null, role: null },
      { ...parent, id: 'mate', name: 'Research mate' },
      child,
    ]);
    const { container } = render(view());
    await act(async () => {});
    expect(screen.getByText(/待唤醒|Dormant/)).toBeInTheDocument();
    expect(container.querySelector('[data-identity="primary"]')).toHaveTextContent('Main');
    expect(container.querySelector('[data-identity="mate"]')).toHaveTextContent('Research mate');
    expect(container.querySelector('[data-identity="tool"]')).toHaveTextContent('Web reader');
    expect(container.querySelector('[data-identity="tool"]')).toHaveAttribute('data-tone', 'active');
  });

  it('does not display a previous session snapshot after switching or a failed refresh', async () => {
    vi.mocked(listSessionAgents).mockResolvedValueOnce([parent, child]).mockRejectedValue(new Error('offline'));
    const rendered = render(view());
    await act(async () => {});
    currentName = 'second';
    rendered.rerender(view());
    await act(async () => {});
    expect(screen.queryByText('Web reader')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

it('selects from the card surface while keeping lifecycle details independent', async () => {
  const select = vi.fn();
  vi.mocked(listSessionAgents).mockResolvedValue([parent]);
  render(<I18nProvider><SessionAgents onSelectAgent={select} /></I18nProvider>);
  const button = await screen.findByRole('button', { name: /Main/ });
  fireEvent.click(button);
  expect(select).toHaveBeenCalledWith(null);
  select.mockClear();
  fireEvent.click(screen.getByText(/Lifecycle records|生命周期记录/));
  expect(select).not.toHaveBeenCalled();
});

afterEach(() => resetSessionResources());
