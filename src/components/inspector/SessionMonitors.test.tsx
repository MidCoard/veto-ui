import { resetSessionResources } from '../../state/sessionResources';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '../../i18n/I18nContext';
import SessionMonitors from './SessionMonitors';
import { apiRequest } from '../../api/client';

vi.mock('../../state/SessionContext', () => ({ useSessions: () => ({ currentName: 'sample' }) }));
vi.mock('../../api/client', () => ({ apiRequest: vi.fn(), getToken: () => null, setHttpErrorLocalizer: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
beforeEach(() => localStorage.clear());
describe('SessionMonitors', () => {
  it('pauses, resumes and cancels through the server without optimistic state changes', async () => {
    let state = 'ACTIVE';
    const record = () => ({ id: 'timer', agentId: 'leader', kind: 'TIME_ONCE', purpose: 'Review later', state, dueAt: null, pending: [] });
    vi.mocked(apiRequest).mockImplementation(async (path, options) => {
      if (options?.method === 'POST') {
        state = String(path).endsWith('/pause') ? 'PAUSED' : String(path).endsWith('/resume') ? 'ACTIVE' : 'CANCELLED';
        return record() as never;
      }
      return [record()] as never;
    });
    render(<I18nProvider><SessionMonitors /></I18nProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Pause reminder' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resume reminder' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Resume reminder' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause reminder' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel reminder' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel reminder' })).not.toBeInTheDocument());
    expect(vi.mocked(apiRequest).mock.calls.filter(([, options]) => options?.method === 'POST').map(([path]) => path)).toEqual(['/api/sessions/sample/monitors/timer/pause', '/api/sessions/sample/monitors/timer/resume', '/api/sessions/sample/monitors/timer/cancel']);
  });

  it('blocks duplicate submissions and retains the reminder after a failed write', async () => {
    let rejectWrite: (reason: Error) => void = () => {};
    const write = new Promise<never>((_, reject) => { rejectWrite = reject; });
    vi.mocked(apiRequest).mockImplementation((_, options) => options?.method === 'POST' ? write : Promise.resolve([{ id: 'timer', agentId: 'leader', kind: 'TIME_ONCE', purpose: 'Review later', state: 'ACTIVE', dueAt: null, pending: [] }]) as never);
    render(<I18nProvider><SessionMonitors /></I18nProvider>);
    const pause = await screen.findByRole('button', { name: 'Pause reminder' });
    fireEvent.click(pause);
    expect(pause).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel reminder' })).toBeDisabled();
    fireEvent.click(pause);
    await act(async () => { rejectWrite(new Error('Connection lost')); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update this reminder');
    expect(screen.getByText('Review later')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause reminder' })).toBeEnabled());
    expect(vi.mocked(apiRequest).mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  });
  it('does not present an interrupted Group subscription as watching', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: 'old-group', agentId: 'leader', kind: 'RESOURCE_EVENT', purpose: 'Group task outcomes', state: 'INTERRUPTED', dueAt: null, pending: [] },
    ]);
    render(<I18nProvider><SessionMonitors /></I18nProvider>);
    expect(await screen.findByText('Source needs recovery')).toBeInTheDocument();
    expect(screen.queryByText('Watching')).not.toBeInTheDocument();
  });
  it('distinguishes a fired event awaiting delivery from a delivered reminder', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: 'a', agentId: 'leader', kind: 'TIME_ONCE', purpose: 'Review later', state: 'COMPLETED', dueAt: '2026-09-09T08:00:00Z', pending: [{ id: 'event', content: 'Time reached' }] },
      { id: 'b', agentId: 'leader', kind: 'TIME_ONCE', purpose: 'Review done', state: 'COMPLETED', dueAt: null, pending: [] },
    ]);
    render(<I18nProvider><SessionMonitors /></I18nProvider>);
    expect(await screen.findByText('Review later')).toBeInTheDocument();
    expect(screen.getByText('Awaiting delivery')).toBeInTheDocument();
    expect(screen.getByText('Triggered')).toBeInTheDocument();
    expect(screen.queryByText('Agent processing completed')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Pause reminder' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Cancel reminder' })).toHaveLength(1);
  });

  it.each([
    ['APPENDED', 'Added to context · Awaiting processing'],
    ['RUNNING', 'Agent processing'],
    ['COMPLETED', 'Agent processing completed'],
    ['FAILED', 'Agent processing failed'],
    ['CANCELLED', 'Request cancelled · No automatic processing'],
    ['INTERRUPTED', 'Processing interrupted · Outcome unknown'],
    ['FUTURE_STATE', 'Added to context · Processing state unknown'],
    [null, 'Added to context · Processing state unknown'],
  ])('shows %s as an event outcome independently of the rule state', async (state, label) => {
    vi.mocked(apiRequest).mockResolvedValue([{ id: 'a', agentId: 'leader', kind: 'TIME_ONCE', purpose: 'Review later', state: 'COMPLETED', dueAt: null, pending: [], delivered: [{ id: 'event', content: 'Time reached' }], activations: state ? { event: { state } } : undefined }]);
    render(<I18nProvider><SessionMonitors /></I18nProvider>);
    await screen.findByText('Review later');
    fireEvent.click(screen.getByText('Details'));
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByText('Time reached')).toBeVisible();
    const terminal = ['COMPLETED', 'FAILED', 'CANCELLED', 'INTERRUPTED'].includes(state ?? '');
    if (terminal) {
      expect(screen.queryByRole('button', { name: 'Pause reminder' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel reminder' })).not.toBeInTheDocument();
    } else {
      expect(screen.getByRole('button', { name: 'Pause reminder' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Cancel reminder' })).toBeEnabled();
    }
    if (state === 'INTERRUPTED') expect(screen.getByText(/No task was replayed/)).toBeVisible();
  });

  it('keeps a paused rule distinct from a completed activation in Chinese', async () => {
    localStorage.setItem('veto.lang', 'zh-CN');
    vi.mocked(apiRequest).mockResolvedValue([{ id: 'a', agentId: 'leader', kind: 'RESOURCE_EVENT', purpose: 'Group', state: 'PAUSED', dueAt: null, pending: [], delivered: [{ id: 'event', content: 'One task finished' }], activations: { event: { state: 'COMPLETED' } } }]);
    render(<I18nProvider><SessionMonitors /></I18nProvider>);
    expect(await screen.findByText('Agent 处理已完成')).toBeInTheDocument();
    expect(screen.queryByText('已触发')).not.toBeInTheDocument();
  });
});

afterEach(() => resetSessionResources());
