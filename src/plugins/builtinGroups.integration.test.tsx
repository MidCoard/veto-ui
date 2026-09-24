import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { activateFrontend } from './runtime';
import { apiRequest } from '../api/client';
import { publishPluginResource, recoverPluginResources } from './events';
import type { FrontendPlugin, PluginContext } from './api';

vi.mock('../api/client', () => ({ apiRequest: vi.fn(), setHttpErrorLocalizer: vi.fn() }));
const source = readFileSync(resolve(process.env.VETO_SOURCE_ROOT ?? '../../IdeaProjects/veto', 'veto-builtin/src/main/resources/frontend/groups.js'), 'utf8');
let plugin: FrontendPlugin;
beforeAll(async () => { plugin = await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`); });
const disposers: (() => void)[] = [];
afterEach(() => { cleanup(); disposers.splice(0).forEach(dispose => dispose()); vi.clearAllMocks(); });
const group = { id: 'group', state: 'ACTIVE', live: false, historical: true, nodeCount: 1, changeCount: 21 };
const node = { id: 'task', state: 'CANCEL_REQUESTED', mateId: 'mate', dependsOn: ['prior'], retries: 1, requestId: 'request-1', dispatchId: 'dispatch-1', descriptionLength: 12, reportLength: 9000 };
function mount(locale = 'en') {
  const registration = activateFrontend(plugin, { id: 'top.focess.builtin:groups', pluginId: 'top.focess.builtin', apiVersion: 1, source }, 'sample', 'agent', new AbortController().signal);
  disposers.push(registration.dispose);
  const context: PluginContext = { session: 'sample', agent: 'agent', locale, connected: true, invoke: registration.invoke, subscribe: registration.subscribe, openAgent: vi.fn().mockResolvedValue(undefined) };
  const Component = registration.inspectors.get('groups')!.Component;
  const onCount = vi.fn();
  return { ...render(<Component context={context} onCount={onCount} />), registration, context, Component, onCount };
}
function backend() {
  vi.mocked(apiRequest).mockImplementation(async (_path, options) => {
    const { action, arguments: args } = options!.body as { action: string; arguments: Record<string, number | string> };
    if (action === 'list') return { items: [group], total: 1, totalNodeCount: 37 } as never;
    if (action === 'nodes' || action === 'changeNodes') return { items: [node], total: 1 } as never;
    if (action === 'changes') return { items: [{ index: args.offset, at: '2026-09-24T00:00:00Z', state: 'INTERRUPTED', nodeCount: 1 }], total: 21 } as never;
    const text = args.field === 'report' ? '报告🛰️'.repeat(2000) : 'Task objective';
    const offset = Number(args.offset); const nextOffset = Math.min(text.length, offset + 8192);
    return { text: text.slice(offset, nextOffset), total: text.length, nextOffset } as never;
  });
}
function expand(label: string | RegExp) { const summary = screen.getByText(label); const details = summary.closest('details')!; details.open = true; fireEvent(details, new Event('toggle')); }
it('loads the actual ESM and preserves status, request identity, full reports and Mate navigation', async () => {
  backend(); const mounted = mount();
  expect(await screen.findByText('Cancellation requested · awaiting stop confirmation')).toBeVisible();
  expect(screen.getByText(/Recovered from legacy/)).toBeVisible();
  expect(mounted.onCount).toHaveBeenLastCalledWith(37);
  expect(screen.getByText('Request: request-1')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'View Mate · mate' }));
  await waitFor(() => expect(mounted.context.openAgent).toHaveBeenCalledWith('mate'));
  expand('Report');
  fireEvent.click(await screen.findByRole('button', { name: 'Read more' }));
  expect(await screen.findByText('报告🛰️'.repeat(2000))).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Read more' })).not.toBeInTheDocument();
  expect(document.querySelector('.builtin-groups style')?.textContent).toContain('focus-visible');
});
it('pages through old changes and reads snapshot nodes without dropping history', async () => {
  backend(); mount(); await screen.findByText('task'); expand('State history (21)');
  const next = await screen.findByRole('button', { name: 'Next' }); fireEvent.click(next);
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: expect.objectContaining({ action: 'changes', arguments: { groupId: 'group', offset: 20, limit: 20 } }) })));
  await screen.findByText(/Interrupted · not automatically replayed/); expand(/Interrupted · not automatically replayed/);
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: expect.objectContaining({ action: 'changeNodes', arguments: { groupId: 'group', changeIndex: 20, offset: 0, limit: 20 } }) })));
});
it('refreshes on resource and focus recovery, localizes, and cancels on unload', async () => {
  backend(); const mounted = mount('zh-CN'); await screen.findByText('已请求取消 · 等待停止确认');
  const count = vi.mocked(apiRequest).mock.calls.length;
  act(() => recoverPluginResources());
  await waitFor(() => expect(vi.mocked(apiRequest).mock.calls.length).toBeGreaterThan(count));
  let pending!: AbortSignal;
  vi.mocked(apiRequest).mockImplementation((_path, options) => { pending = options!.signal!; return new Promise(() => {}); });
  act(() => publishPluginResource('sample', 'groups'));
  await waitFor(() => expect(pending).toBeDefined());
  mounted.unmount(); mounted.registration.dispose(); expect(pending.aborted).toBe(true);
  const stopped = vi.mocked(apiRequest).mock.calls.length; act(() => recoverPluginResources()); expect(apiRequest).toHaveBeenCalledTimes(stopped);
});
it('offers retry and retains cached data offline rather than reporting an empty group', async () => {
  vi.mocked(apiRequest).mockRejectedValue(new Error('unavailable')); const mounted = mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not refresh');
  backend(); fireEvent.click(screen.getByRole('button', { name: 'Retry' })); await screen.findByText('task');
  mounted.rerender(<mounted.Component context={{ ...mounted.context, connected: false }} />);
  expect(screen.getByText(/Waiting for connection/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'View Mate · mate' })).toBeDisabled();
});

it('clears prior session content immediately and handles terminal nullable text offsets', async () => {
  backend(); const mounted = mount(); await screen.findByText('task'); expand('Report');
  await screen.findByRole('button', { name: 'Read more' });
  vi.mocked(apiRequest).mockImplementation(() => new Promise(() => {}));
  mounted.rerender(<mounted.Component context={{ ...mounted.context, session: 'other' }} />);
  expect(screen.queryByText('task')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Read more' })).not.toBeInTheDocument();
  mounted.unmount(); mounted.registration.dispose();
  backend();
  const normal = vi.mocked(apiRequest).getMockImplementation()!;
  vi.mocked(apiRequest).mockImplementation((path, options) => (options!.body as { action: string }).action === 'text' ? Promise.resolve({ text: 'End of report', total: 13, nextOffset: null }) as never : normal(path, options));
  mount(); await screen.findByText('task'); expand('Report'); await screen.findByText('End of report');
  expect(screen.queryByRole('button', { name: 'Read more' })).not.toBeInTheDocument();
});
