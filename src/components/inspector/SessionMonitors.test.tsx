import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nProvider } from '../../i18n/I18nContext';
import SessionMonitors from './SessionMonitors';
import { apiRequest } from '../../api/client';

vi.mock('../../state/SessionContext', () => ({ useSessions: () => ({ currentName: 'sample' }) }));
vi.mock('../../api/client', () => ({ apiRequest: vi.fn(), setHttpErrorLocalizer: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('SessionMonitors', () => {
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
    expect(screen.getByText('Added to Agent context')).toBeInTheDocument();
  });
});
