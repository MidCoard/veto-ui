import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import SessionRail from './SessionRail';
import NewSessionPage from './NewSessionPage';
import { ApiError } from '../api/client';
import { browseFs } from '../api/endpoints';
import type { SessionEntity } from '../api/types';

const { create, state } = vi.hoisted(() => ({ create: vi.fn(), state: { sessions: [] as SessionEntity[] } }));
vi.mock('../state/SessionContext', () => ({
  useSessions: () => ({ sessions: state.sessions, currentName: null, select: vi.fn(), create, remove: vi.fn(), sessionStates: {} }),
}));
vi.mock('../api/endpoints', () => ({
  browseFs: vi.fn(),
  listPatterns: vi.fn().mockResolvedValue([{ id: 'pattern', name: 'default', tier: 'LOW' }]),
}));
vi.mock('../lib/systemInfo', () => ({ loadSystemInfo: vi.fn().mockResolvedValue({ pathExample: 'D:/workspace' }) }));

function SessionFlow() {
  const [creating, setCreating] = useState(false);
  return creating
    ? <NewSessionPage onCreated={() => setCreating(false)} onCancel={() => setCreating(false)} />
    : <SessionRail onNewSession={() => setCreating(true)} />;
}

describe('workspace cards and new session page', () => {
  beforeEach(() => {
    localStorage.clear();
    state.sessions = [];
    create.mockReset().mockResolvedValue(undefined);
    // jsdom has no native dialog implementation; browser QA covers top-layer behavior.
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  });

  it('opens the directory picker as a modal and returns the selected root to the form', async () => {
    vi.mocked(browseFs).mockResolvedValue({ path: 'D:/workspace', parent: 'D:/', entries: [] });
    render(<I18nProvider><SessionFlow /></I18nProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'New session' }));
    await screen.findByRole('option', { name: 'default (LOW)' });
    fireEvent.click(screen.getByRole('button', { name: 'Browse server…' }));
    const picker = screen.getByRole('dialog', { name: 'Workspace roots' });
    await waitFor(() => expect(within(picker).getByRole('button', { name: 'Use this directory' })).toBeEnabled());
    fireEvent.click(within(picker).getByRole('button', { name: 'Use this directory' }));
    expect(screen.queryByRole('dialog', { name: 'Workspace roots' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Workspace roots')).toHaveValue('D:/workspace');
    fireEvent.click(screen.getByRole('button', { name: 'Browse server…' }));
    fireEvent(screen.getByRole('dialog', { name: 'Workspace roots' }), new Event('cancel', { bubbles: true, cancelable: true }));
    expect(screen.getByRole('heading', { name: 'New session', level: 1 })).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('selects the new-session card independently of the existing session', () => {
    const view = render(<I18nProvider><SessionRail creating={false} onNewSession={vi.fn()} /></I18nProvider>);
    expect(screen.getByRole('button', { name: 'New session' })).toHaveAttribute('aria-pressed', 'false');
    view.rerender(<I18nProvider><SessionRail creating onNewSession={vi.fn()} /></I18nProvider>);
    expect(screen.getByRole('button', { name: 'New session' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks sessions with additional tool-result information independently of guided execution', () => {
    state.sessions = [
      { id: 'detailed', name: 'Detailed session', owner: 'admin', workspaceRoots: 'D:/project', primaryAgentId: null, toolResultPresentation: 'DETAILED', guidedEnabled: false, createdAt: 0, lastActiveAt: 1000 },
      { id: 'basic', name: 'Basic session', owner: 'admin', workspaceRoots: 'D:/project', primaryAgentId: null, toolResultPresentation: 'BASIC', guidedEnabled: true, createdAt: 0, lastActiveAt: 1000 },
    ];
    render(<I18nProvider><SessionFlow /></I18nProvider>);
    const detailed = screen.getByText('Detailed session').closest('li')!;
    const basic = screen.getByText('Basic session').closest('li')!;
    expect(within(detailed).getByRole('img', { name: 'Additional tool-result information' })).toHaveAttribute('title', 'Additional tool-result information');
    expect(within(basic).queryByRole('img', { name: 'Additional tool-result information' })).not.toBeInTheDocument();
    expect(within(basic).getByRole('img', { name: 'Guided execution' })).toBeInTheDocument();
  });

  it('groups sessions under collapsible workspace headings', () => {
    state.sessions = ['first', 'second'].map((name) => ({
      id: name, name, owner: 'admin', workspaceRoots: 'D:/project', primaryAgentId: null,
      toolResultPresentation: 'BASIC', guidedEnabled: false, createdAt: 0, lastActiveAt: 1000,
    }));
    render(<I18nProvider><SessionFlow /></I18nProvider>);
    const group = screen.getByRole('button', { name: 'project D:/project 2' });
    expect(screen.getByText('first')).toBeVisible();
    fireEvent.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('first')).not.toBeInTheDocument();
    fireEvent.click(group);
    expect(screen.getByText('second')).toBeVisible();
  });

  it('returns from the creation page without creating a session', async () => {
    render(<I18nProvider><SessionFlow /></I18nProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'New session' }));
    await screen.findByRole('option', { name: 'default (LOW)' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New session' })).toBeVisible();
    expect(create).not.toHaveBeenCalled();
  });

  it('preserves the form when creation fails so the user can retry', async () => {
    create.mockRejectedValueOnce(new ApiError(500, 'Creation failed'));
    render(<I18nProvider><SessionFlow /></I18nProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'New session' }));
    await screen.findByRole('option', { name: 'default (LOW)' });
    fireEvent.change(screen.getByLabelText('Workspace roots'), { target: { value: 'D:/project' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Creation failed');
    expect(screen.getByLabelText('Workspace roots')).toHaveValue('D:/project');
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
  });

  it.each([false, true])('creates a session with guidedEnabled=%s independently of presentation', async (enabled) => {
    render(<I18nProvider><SessionFlow /></I18nProvider>);
    fireEvent.click(screen.getByRole('button', { name: /new/i }));
    await screen.findByRole('option', { name: 'default (LOW)' });
    const guided = screen.getByRole('checkbox', { name: /Guided execution/ });
    expect(guided).toBeChecked();
    if (!enabled) fireEvent.click(guided);
    fireEvent.change(screen.getByLabelText('Workspace roots'), { target: { value: 'D:/workspace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith('default', undefined, 'D:/workspace', 'BASIC', enabled));
    fireEvent.click(screen.getByRole('button', { name: /new/i }));
    await screen.findByRole('option', { name: 'default (LOW)' });
    expect(screen.getByRole('checkbox', { name: /Guided execution/ })).toBeChecked();
  });
});
