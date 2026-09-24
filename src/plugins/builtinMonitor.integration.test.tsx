import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { activateFrontend } from './runtime';
import { apiRequest } from '../api/client';
import { publishPluginResource } from './events';
import type { FrontendPlugin, PluginContext } from './api';

vi.mock('../api/client', () => ({ apiRequest: vi.fn(), setHttpErrorLocalizer: vi.fn() }));
const source = readFileSync(resolve(process.env.VETO_SOURCE_ROOT ?? '../../IdeaProjects/veto', 'veto-builtin/src/main/resources/frontend/monitors.js'), 'utf8');
const plugin: FrontendPlugin = { activate: new Function(source.replace('export function activate', 'return function activate'))() };
const cleanups: (() => void)[] = [];
afterEach(() => { cleanup(); cleanups.splice(0).forEach(dispose => dispose()); vi.clearAllMocks(); });
function mount(locale = 'en', connected = true) {
  const registration = activateFrontend(plugin, { id: 'top.focess.builtin:monitors', pluginId: 'top.focess.builtin', apiVersion: 1, source }, 'sample', 'agent', new AbortController().signal);
  cleanups.push(registration.dispose);
  const Component = registration.inspectors.get('monitors')!.Component;
  const context: PluginContext = { session: 'sample', agent: 'agent', locale, connected, invoke: registration.invoke, subscribe: registration.subscribe };
  const onCount = vi.fn();
  const view = render(<Component context={context} onCount={onCount} />);
  return { ...view, registration, onCount, context, Component };
}
const record = (state = 'ACTIVE') => ({ id: 'timer', agentId: 'leader', kind: 'TIME_ONCE', purpose: 'Review later', state, dueAt: '', pending: 0, controllable: false });
it('owns pause, resume and cancel actions and waits for authoritative state', async () => {
  let state = 'ACTIVE';
  vi.mocked(apiRequest).mockImplementation(async (_path, options) => {
    const action = (options?.body as { action: string }).action;
    if (action === 'list') return { items: [record(state)], total: 1 } as never;
    state = action === 'pause' ? 'PAUSED' : action === 'resume' ? 'ACTIVE' : 'CANCELLED';
    return true as never;
  });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Pause reminder' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Resume reminder' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel reminder' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel reminder' })).not.toBeInTheDocument());
  expect(vi.mocked(apiRequest).mock.calls.map(([, options]) => (options?.body as { action: string }).action).filter(action => action !== 'list')).toEqual(['pause', 'resume', 'cancel']);
});
it('blocks duplicate writes and retains data after a failed update', async () => {
  let reject!: (error: Error) => void;
  const write = new Promise<never>((_, fail) => { reject = fail; });
  vi.mocked(apiRequest).mockImplementation((_path, options) => (options?.body as { action: string }).action === 'list' ? Promise.resolve({ items: [record()], total: 1 }) as never : write);
  mount();
  const pause = await screen.findByRole('button', { name: 'Pause reminder' });
  fireEvent.click(pause); fireEvent.click(pause);
  expect(pause).toBeDisabled();
  await act(async () => reject(new Error('offline')));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not update this reminder');
  expect(screen.getByText('Review later')).toBeInTheDocument();
  expect(vi.mocked(apiRequest).mock.calls.filter(([, options]) => (options?.body as { action: string }).action === 'pause')).toHaveLength(1);
});
it('distinguishes pending delivery, triggered state and interrupted sources', async () => {
  vi.mocked(apiRequest).mockResolvedValue({ items: [
    { ...record('COMPLETED'), pending: 1, controllable: true },
    { ...record('COMPLETED'), id: 'done' },
    { ...record('INTERRUPTED'), id: 'old', kind: 'RESOURCE_EVENT' },
  ], total: 3 });
  mount();
  expect(await screen.findByText('Awaiting delivery')).toBeInTheDocument();
  expect(screen.getByText('Triggered')).toBeInTheDocument();
  expect(screen.getByText('Source needs recovery')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Pause reminder' })).toHaveLength(1);
});
it.each([
  ['APPENDED', 'Added to context · Awaiting processing'], ['RUNNING', 'Agent processing'],
  ['COMPLETED', 'Agent processing completed'], ['FAILED', 'Agent processing failed'],
  ['CANCELLED', 'Request cancelled · No automatic processing'], ['INTERRUPTED', 'Processing interrupted · Outcome unknown'],
  ['FUTURE_STATE', 'Added to context · Processing state unknown'],
])('owns the %s outcome label independently of rule state', async (state, label) => {
  vi.mocked(apiRequest).mockImplementation(async (_path, options) => (options?.body as { action: string }).action === 'list'
    ? { items: [record('PAUSED')], total: 1 } as never : { items: [{ id: 'event', content: 'Result', state }], total: 1 } as never);
  mount();
  const details = (await screen.findByText('Details')).closest('details')!;
  details.open = true; fireEvent(details, new Event('toggle'));
  expect(await screen.findByText(label)).toBeInTheDocument();
});
it('localizes plugin-owned UI and cancels subscriptions and requests on disposal', async () => {
  vi.mocked(apiRequest).mockResolvedValue({ items: [record()], total: 1 });
  const mounted = mount('zh-CN');
  expect(await screen.findByText('Review later')).toBeInTheDocument();
  const calls = vi.mocked(apiRequest).mock.calls.length;
  act(() => publishPluginResource('sample', 'monitors'));
  await waitFor(() => expect(vi.mocked(apiRequest).mock.calls.length).toBeGreaterThan(calls));
  mounted.unmount(); mounted.registration.dispose();
  const stopped = vi.mocked(apiRequest).mock.calls.length;
  publishPluginResource('sample', 'monitors');
  expect(vi.mocked(apiRequest).mock.calls).toHaveLength(stopped);
  expect(mounted.registration.inspectors.size).toBe(0);
});
it('shows loading, empty, failure and disconnection without enabling stale controls', async () => {
  vi.mocked(apiRequest).mockRejectedValue(new Error('unavailable'));
  const mounted = mount();
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  vi.mocked(apiRequest).mockResolvedValue({ items: [], total: 0 });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('No Monitors in this session')).toBeInTheDocument();
  mounted.rerender(<mounted.Component context={{ ...mounted.context, connected: false }} />);
  expect(screen.getByRole('status')).toHaveTextContent('Waiting for connection');
});
