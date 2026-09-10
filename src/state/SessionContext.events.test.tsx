import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SessionProvider, useSessions } from './SessionContext';
import { useSessionResource } from './useSessionResource';
import { resetSessionResources } from './sessionResources';
import type { BusListeners, DeltaFrame } from '../bus/VetoBus';
import { apiRequest } from '../api/client';
import * as api from '../api/endpoints';

const mock = vi.hoisted(() => ({ listeners: {} as BusListeners, auth: 'signedIn' }));
vi.mock('./AuthContext', () => ({ useAuth: () => ({ status: mock.auth }) }));
vi.mock('../i18n/I18nContext', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../bus/VetoBus', () => ({ VetoBus: class {
  constructor(listeners: BusListeners) { mock.listeners = listeners; }
  connect() { mock.listeners.onStatus?.('connected'); }
  disconnect() {}
} }));
vi.mock('../api/client', async original => ({ ...await original<typeof import('../api/client')>(), apiRequest: vi.fn() }));
vi.mock('../api/endpoints', () => ({
  listSessions: vi.fn(), getSessionHistory: vi.fn(), getSessionRecords: vi.fn(), listSessionAgents: vi.fn(),
  listBgTasks: vi.fn(), listVetoes: vi.fn(), listUserQuestions: vi.fn(), listSessionGroups: vi.fn(),
  sendPrompt: vi.fn(), createSession: vi.fn(), deleteSession: vi.fn(), cancelSession: vi.fn(),
  answerUserQuestions: vi.fn(), cancelUserQuestions: vi.fn(), resolveVeto: vi.fn(),
}));

function Probe() {
  const context = useSessions();
  const id = context.sessions.find(session => session.name === context.currentName)?.id;
  const records = useSessionResource(context.currentName, 'records', id);
  useSessionResource(context.currentName, 'agents', id);
  return <><output data-testid="entries">{JSON.stringify(context.entries)}</output><div>{context.currentName ?? 'none'}:{context.pending ? 'busy' : 'idle'}:{context.questions.length}:{records.data?.rawRecordCount ?? 0}</div></>;
}
const mount = () => <SessionProvider><Probe /><Probe /></SessionProvider>;
const emit = (kind: DeltaFrame['kind'], attrs: Record<string, unknown> = {}) => mock.listeners.onDelta?.({ sessionId: 'id', kind, attrs, text: '', sequence: 1, emittedAt: '' });

beforeEach(() => {
  vi.useFakeTimers(); mock.auth = 'signedIn';
  vi.mocked(api.listSessions).mockResolvedValue([{ id: 'id', name: 'example', primaryAgentId: 'primary' } as never]);
  vi.mocked(api.getSessionHistory).mockResolvedValue([]);
  vi.mocked(api.getSessionRecords).mockResolvedValue({ rawRecordCount: 0 } as never);
  vi.mocked(api.listSessionAgents).mockResolvedValue([]);
  vi.mocked(api.listBgTasks).mockResolvedValue({ tasks: [] } as never);
  vi.mocked(api.listVetoes).mockResolvedValue([]);
  vi.mocked(api.listUserQuestions).mockResolvedValue([]);
  vi.mocked(apiRequest).mockResolvedValue([]);
});
afterEach(() => { cleanup(); resetSessionResources(); vi.resetAllMocks(); vi.useRealTimers(); });

it('shares reads across panels, batches record events and makes no idle session requests', async () => {
  render(mount()); await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(api.getSessionRecords).toHaveBeenCalledTimes(1);
  expect(api.listSessionAgents).toHaveBeenCalledTimes(1);
  const counts = [api.getSessionHistory, api.getSessionRecords, api.listBgTasks, api.listVetoes, api.listUserQuestions, apiRequest].map(fn => vi.mocked(fn).mock.calls.length);
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect([api.getSessionHistory, api.getSessionRecords, api.listBgTasks, api.listVetoes, api.listUserQuestions, apiRequest].map(fn => vi.mocked(fn).mock.calls.length)).toEqual(counts);
  await act(async () => { for (let i = 0; i < 100; i++) emit('RECORD_UPDATED'); await vi.advanceTimersByTimeAsync(250); });
  expect(api.getSessionRecords).toHaveBeenCalledTimes(2);
  expect(api.listSessionAgents).toHaveBeenCalledTimes(1);
  const tasksBefore = vi.mocked(api.listBgTasks).mock.calls.length;
  await act(async () => { emit('TASK_EXITED'); await vi.advanceTimersByTimeAsync(250); });
  expect(api.listBgTasks).toHaveBeenCalledTimes(tasksBefore + 1);
  expect(api.getSessionRecords).toHaveBeenCalledTimes(2);
});

it('receives remote execution and questions without a local prompt and heals on reconnect', async () => {
  render(mount()); await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  vi.mocked(apiRequest).mockResolvedValue([{ agentId: 'primary', busy: true }]);
  vi.mocked(api.listUserQuestions).mockResolvedValue([{ callId: 'remote', questions: [] } as never]);
  await act(async () => { emit('SESSION_INVALIDATED', { resources: ['execution', 'interactions'] }); await vi.advanceTimersByTimeAsync(250); });
  expect(screen.getAllByText('example:busy:1:0')).toHaveLength(2);
  // An old episode-done must not clear a still-busy runtime.
  await act(async () => { emit('EPISODE_DONE'); await vi.advanceTimersByTimeAsync(500); });
  expect(screen.getAllByText('example:busy:1:0')).toHaveLength(2);
  vi.mocked(apiRequest).mockResolvedValue([]);
  vi.mocked(api.listUserQuestions).mockResolvedValue([]);
  await act(async () => { mock.listeners.onStatus?.('reconnecting'); });
  await act(async () => { mock.listeners.onStatus?.('connected'); });
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  expect(screen.getAllByText('example:idle:0:0')).toHaveLength(2);
});

it('ignores a catalogue response after logout', async () => {
  let resolve!: (value: never[]) => void;
  vi.mocked(api.listSessions).mockImplementation(() => new Promise(r => { resolve = r; }));
  const view = render(mount());
  mock.auth = 'signedOut'; view.rerender(mount());
  await act(async () => { resolve([{ id: 'id', name: 'secret' } as never]); });
  expect(screen.getAllByText('none:idle:0:0')).toHaveLength(2);
  expect(api.getSessionRecords).not.toHaveBeenCalled();
});

it('never places a child message into the primary live ledger', async () => {
  render(mount()); await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  await act(async () => {
    mock.listeners.onDelta?.({ sessionId: 'id', kind: 'ASSISTANT_MESSAGE', attrs: { agentId: 'child' }, text: 'child private answer', sequence: 4, emittedAt: '' });
  });
  expect(screen.getAllByTestId('entries')[0]).not.toHaveTextContent('child private answer');
  await act(async () => {
    mock.listeners.onDelta?.({ sessionId: 'id', kind: 'ASSISTANT_MESSAGE', attrs: { agentId: 'primary' }, text: 'primary answer', sequence: 5, emittedAt: '' });
  });
  expect(screen.getAllByTestId('entries')[0]).toHaveTextContent('primary answer');
});
