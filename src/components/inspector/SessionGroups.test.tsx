import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SessionGroups from './SessionGroups';
const mocks = vi.hoisted(() => ({ name: 'old-group', load: vi.fn() }));
vi.mock('../../state/SessionContext', () => ({ useSessions: () => ({ currentName: mocks.name }) }));
vi.mock('../../i18n/I18nContext', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../api/endpoints', () => ({ listSessionGroups: mocks.load }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.name = 'old-group'; });
describe('Session group history', () => {
  it('shows legacy node evidence and links its Mate without claiming independent verification', async () => {
    mocks.load.mockResolvedValue([{ id: 'g', leaderId: 'leader', brief: 'Read two pages', state: 'DISBANDED', historical: true, live: false, changes: [], nodes: [{ id: 'rfc', description: 'Read RFC', dependencies: [], state: 'REPORTED', mateId: 'mate-id', report: 'Actual report', retries: 0 }] }]);
    const select = vi.fn();
    render(<SessionGroups onSelectAgent={select} />);
    expect(await screen.findByText('Read RFC')).toBeTruthy();
    expect(screen.getByText('groups.historical')).toBeTruthy();
    expect(screen.getByText('groups.reported')).toBeTruthy();
    expect(screen.getByText('Actual report')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /groups.mate/ }));
    expect(select).toHaveBeenCalledWith('mate-id');
    expect(mocks.load).toHaveBeenCalledWith('old-group', expect.any(AbortSignal));
  });
  it('does not show another session nodes while a new session request is pending', async () => {
    mocks.load.mockResolvedValueOnce([{ id: 'g', brief: 'First session', state: 'DISBANDED', historical: true, live: false, changes: [], nodes: [] }]);
    const view = render(<SessionGroups />);
    await screen.findByText('First session');
    mocks.name = 'other-session';
    mocks.load.mockImplementation(() => new Promise(() => {}));
    view.rerender(<SessionGroups />);
    await waitFor(() => expect(screen.queryByText('First session')).toBeNull());
  });
});
