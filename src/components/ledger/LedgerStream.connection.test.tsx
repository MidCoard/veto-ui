import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/I18nContext';
import LedgerStream from './LedgerStream';
const state = vi.hoisted(() => ({ busStatus: 'connected', pending: false, history: { data: null as unknown, loading: true, stale: true, error: null as unknown } }));
vi.mock('../../state/SessionContext', () => ({ useSessions: () => ({ ...state, currentName: 's', sessions: [], entries: [], vetoes: [], questions: [] }) }));
vi.mock('../../state/useSessionResource', () => ({ useSessionResource: () => state.history }));
beforeEach(() => { localStorage.clear(); state.busStatus = 'connected'; state.pending = false; state.history = { data: null, loading: true, stale: true, error: null }; });
afterEach(cleanup);
const show = () => render(<I18nProvider><LedgerStream /></I18nProvider>);
it('does not invite a first message while history is loading or failed', () => {
  const view = show();
  expect(screen.queryByText('Start a conversation')).not.toBeInTheDocument();
  state.history = { data: null, loading: false, stale: true, error: new Error('offline') };
  view.rerender(<I18nProvider><LedgerStream /></I18nProvider>);
  expect(screen.getByText('Try again shortly, or refresh the page to reload.')).toBeInTheDocument();
  expect(screen.queryByText('Start a conversation')).not.toBeInTheDocument();
});
it('shows the invitation only for successfully loaded empty history', () => {
  state.history = { data: [], loading: false, stale: false, error: null };
  show(); expect(screen.getByText('Start a conversation')).toBeInTheDocument();
});
it('prioritizes disconnection over empty and running states', () => {
  state.busStatus = 'reconnecting'; state.pending = true;
  show(); expect(screen.getByText('Connection unavailable')).toBeInTheDocument();
  expect(screen.queryByText('Start a conversation')).not.toBeInTheDocument();
});
