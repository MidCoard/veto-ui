import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./state/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ status: 'signedIn' }),
}));
vi.mock('./state/SessionContext', () => ({
  useSessions: () => ({ currentName: 'test-session' }),
  SessionProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('./components/StatusBar', () => ({ default: ({ onToggleRecords }: { onToggleRecords: () => void }) => <header><button onClick={onToggleRecords}>Records</button></header> }));
vi.mock('./components/SessionRail', () => ({ default: ({ onNewSession, onSelectSession }: { onNewSession: () => void; onSelectSession: () => void }) => (
  <nav aria-label="Workspaces"><button onClick={onNewSession}>New session</button><button onClick={onSelectSession}>Existing session</button></nav>
) }));
vi.mock('./components/NewSessionPage', () => ({ default: ({ onCancel }: { onCancel: () => void }) => <form aria-label="Create session"><button onClick={onCancel}>Cancel</button></form> }));
vi.mock('./components/ledger/LedgerStream', () => ({ default: () => <div>Conversation content</div> }));
vi.mock('./components/ConversationPane', () => ({ default: ({ onToggleInspector, inspectorOpen }: { onToggleInspector: () => void; inspectorOpen: boolean }) => <div>Conversation content<button onClick={onToggleInspector} aria-expanded={inspectorOpen}>Toggle inspector</button></div> }));
vi.mock('./components/Composer', () => ({ default: () => <div>Composer</div> }));
vi.mock('./components/inspector/InspectorPanel', () => ({ default: () => <div>Inspector content</div> }));
vi.mock('./components/records/SessionRecordsView', () => ({ default: () => <div>Session records</div> }));
vi.mock('./components/settings/SettingsView', () => ({ default: () => null }));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => vi.unstubAllGlobals());

it('keeps side panels mounted while creating and returns to a selected session', () => {
  render(<App />);
  const sidebar = screen.getByRole('navigation', { name: 'Workspaces' });
  fireEvent.click(screen.getByRole('button', { name: 'New session' }));
  expect(screen.getByRole('navigation', { name: 'Workspaces' })).toBe(sidebar);
  expect(screen.getByRole('main')).toContainElement(screen.getByRole('form', { name: 'Create session' }));
  expect(screen.getByText('Inspector content')).toBeInTheDocument();
  expect(screen.getByRole('separator')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Existing session' }));
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
  expect(screen.getByText('Conversation content')).toBeInTheDocument();
});

it('preserves records mode when selecting another session', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Records' }));
  expect(screen.getByText('Session records')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Existing session' }));
  expect(screen.getByText('Session records')).toBeInTheDocument();
  expect(screen.queryByText('Conversation content')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Records' }));
  expect(screen.getByText('Conversation content')).toBeInTheDocument();
});

it('opens and dismisses the inspector on a narrow window', () => {
  vi.stubGlobal('innerWidth', 390);
  render(<App />);
  const toggle = screen.getByRole('button', { name: 'Toggle inspector' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Inspector content').closest('aside')).toHaveClass('block');
  fireEvent.click(screen.getByRole('button', { name: 'Close sidebar' }));
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(toggle);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
