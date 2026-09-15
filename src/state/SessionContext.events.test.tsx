import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SessionProvider, useSessions } from './SessionContext';
import { useSessionResource } from './useSessionResource';
import { resetSessionResources } from './sessionResources';
import type { BusListeners, DeltaFrame } from '../bus/VetoBus';
import { ApiError, apiRequest } from '../api/client';
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
  return <><button onClick={context.cancelPrompt}>Cancel waiting</button><button onClick={() => { void context.sendPrompt("synthetic-secret-draft").catch(() => undefined); }}>Submit protected draft</button><output data-testid="entries">{JSON.stringify(context.entries)}</output><div>{context.currentName ?? 'none'}:{context.pending ? 'busy' : 'idle'}:{context.questions.length}:{records.data?.rawRecordCount ?? 0}</div></>;
}
const mount = () => <SessionProvider><Probe /><Probe /></SessionProvider>;
const emit = (kind: DeltaFrame['kind'], attrs: Record<string, unknown> = {}) => mock.listeners.onDelta?.({ sessionId: 'id', kind, attrs, text: '', sequence: 1, emittedAt: '' });

it('keeps primary execution failures through completion and record refresh without leaking child errors', async () => {
  render(mount()); await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  await act(async () => {
    mock.listeners.onDelta?.({ sessionId: 'id', kind: 'ERROR', attrs: { agentId: 'child' }, text: 'private child failure', sequence: 2, emittedAt: '' });
    mock.listeners.onDelta?.({ sessionId: 'id', kind: 'ERROR', attrs: { agentId: 'primary' }, text: 'Context input budget exceeded', sequence: 3, emittedAt: '' });
    emit('EPISODE_DONE'); emit('RECORD_UPDATED');
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(screen.getAllByTestId('entries')[0]).toHaveTextContent('Context input budget exceeded');
  expect(screen.getAllByTestId('entries')[0]).not.toHaveTextContent('private child failure');
});

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

it('never adds raw submitted text to the local ledger, including rejection', async () => {
  let reject!: (error: unknown) => void;
  vi.mocked(api.sendPrompt).mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
  render(mount());
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  fireEvent.click(screen.getAllByRole('button', { name: 'Submit protected draft' })[0]);
  expect(screen.getAllByTestId('entries')[0]).not.toHaveTextContent('synthetic-secret-draft');
  await act(async () => { reject(new ApiError(422, 'Safe rejection', 'PROTECTED_INPUT_UNAVAILABLE')); });
  expect(screen.getAllByTestId('entries')[0]).not.toHaveTextContent('synthetic-secret-draft');
  expect(screen.getAllByTestId('entries')[0]).toHaveTextContent('error.protectedInput');
  expect(api.sendPrompt).toHaveBeenCalledOnce();
});
it('waits for cancellation acknowledgement, deduplicates clicks and keeps the notice before later turns', async () => {
  let resolve!: (value: { status: string; declined: number }) => void;
  vi.mocked(api.cancelSession).mockImplementation(() => new Promise(done => { resolve = done; }));
  vi.mocked(api.getSessionHistory).mockResolvedValue([{ turnNumber: 1, type: 'USER_PROMPT', payload: { content: 'Original request' } }] as never);
  render(mount()); await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  fireEvent.click(screen.getAllByRole('button', { name: 'Cancel waiting' })[0]);
  fireEvent.click(screen.getAllByRole('button', { name: 'Cancel waiting' })[0]);
  expect(api.cancelSession).toHaveBeenCalledOnce();
  expect(screen.getAllByTestId('entries')[0]).not.toHaveTextContent('error.promptCancelled');
  await act(async () => { resolve({ status: 'ok', declined: 1 }); });
  expect(screen.getAllByTestId('entries')[0]).toHaveTextContent('error.promptCancelled');
  vi.mocked(api.getSessionHistory).mockResolvedValue([
    { turnNumber: 1, type: 'USER_PROMPT', payload: { content: 'Original request' } },
    { turnNumber: 2, type: 'USER_PROMPT', payload: { content: 'Later request' } },
  ] as never);
  await act(async () => { emit('RECORD_UPDATED'); await vi.advanceTimersByTimeAsync(1000); });
  const entries = screen.getAllByTestId('entries')[0].textContent ?? '';
  expect(entries).toContain('Later request');
  expect(entries.indexOf('error.promptCancelled')).toBeLessThan(entries.indexOf('Later request'));
});

it('reports a failed cancellation without clearing pending questions and permits an explicit retry', async () => {
  vi.mocked(api.listUserQuestions).mockResolvedValue([{ callId: 'question', questions: [] }] as never);
  vi.mocked(api.cancelSession).mockRejectedValue(new Error('offline'));
  vi.mocked(api.cancelUserQuestions).mockRejectedValue(new Error('offline'));
  render(mount()); await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Cancel waiting' })[0]); });
  expect(screen.getAllByTestId('entries')[0]).toHaveTextContent('error.cancelUnconfirmed');
  expect(screen.getAllByTestId('entries')[0]).not.toHaveTextContent('error.promptCancelled');
  expect(screen.getAllByText('example:idle:1:0')).toHaveLength(2);
  await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Cancel waiting' })[0]); });
  expect(api.cancelSession).toHaveBeenCalledTimes(2);
});

it('ignores cancellation feedback arriving after logout', async () => {
  let resolve!: (value: { status: string; declined: number }) => void;
  vi.mocked(api.cancelSession).mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = render(mount()); await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  fireEvent.click(screen.getAllByRole('button', { name: 'Cancel waiting' })[0]);
  mock.auth = 'signedOut'; view.rerender(mount());
  await act(async () => { resolve({ status: 'ok', declined: 1 }); });
  expect(screen.getAllByTestId('entries')[0]).not.toHaveTextContent('error.promptCancelled');
});