import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { listSessionAgents } from '../api/endpoints';
import SessionAgents from './SessionAgents';

let currentName = 'first';
vi.mock('../state/SessionContext', () => ({ useSessions: () => ({ currentName, sessions: [{ name: 'first', primaryAgentId: 'parent' }] }) }));
vi.mock('../api/endpoints', () => ({ listSessionAgents: vi.fn() }));
const parent = { id: 'parent', name: 'Main', role: 'MATE' as const, state: 'WAITING' as const, parentAgentId: null, parentCallId: null, live: true, createdAt: null, startedAt: null, endedAt: null };
const child = { id: 'reader', name: 'Web reader', role: 'STANDALONE' as const, state: 'RUNNING' as const, parentAgentId: 'parent', parentCallId: 'call-1', live: true, createdAt: null, startedAt: null, endedAt: null };
const view = () => <I18nProvider><SessionAgents /></I18nProvider>;

afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); currentName = 'first'; });

describe('session agents', () => {
  it('keeps an ended child and counts the idle primary after runtime cleanup', async () => {
    vi.useFakeTimers();
    vi.mocked(listSessionAgents).mockResolvedValueOnce([parent, child]).mockResolvedValue([{ ...parent, state: 'IDLE' }, { ...child, live: false, state: 'TERMINATED', endedAt: Date.parse('2026-09-08T10:00:00Z') / 1000 }]);
    const rendered = render(view());
    await act(async () => {});
    expect(screen.getByText('Web reader')).toBeInTheDocument();
    expect(screen.getByText(/由 Main 启动|Started by Main/)).toBeInTheDocument();
    expect(screen.getByText(/工具 Agent|Tool agent/)).toBeInTheDocument();
    expect(screen.getByText(/主 Agent|Primary agent/)).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
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
