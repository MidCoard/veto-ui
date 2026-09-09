import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/I18nContext';
import BackgroundTasksSection from './BackgroundTasksSection';

const state = vi.hoisted(() => ({ bgTasks: [], bgTasksStatus: 'loading', currentName: 'session', refreshBgTasks: vi.fn() }));
vi.mock('../../state/SessionContext', () => ({ useSessions: () => state }));
beforeEach(() => { localStorage.setItem('veto.lang', 'en'); });

it('only presents an empty list after a successful response, and recovers from failure', () => {
  state.bgTasksStatus = 'loading';
  const view = render(<I18nProvider><BackgroundTasksSection /></I18nProvider>);
  expect(screen.getByRole('status')).toBeInTheDocument();
  state.bgTasksStatus = 'error';
  view.rerender(<I18nProvider><BackgroundTasksSection /></I18nProvider>);
  expect(screen.getByRole('alert')).toHaveTextContent('Background tasks are unavailable');
  expect(screen.queryByText('No background tasks for this session.')).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  state.bgTasksStatus = 'ready';
  view.rerender(<I18nProvider><BackgroundTasksSection /></I18nProvider>);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByText('No background tasks for this session.')).toBeInTheDocument();
});
