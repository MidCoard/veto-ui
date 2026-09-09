import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';
import { AuthProvider } from '../state/AuthContext';
import LoginGate from './LoginGate';

const available = (setupNeeded = false, authenticated = false) => new Response(
  JSON.stringify({ setupNeeded, authenticated }), { status: 200 },
);
const fetchMock = vi.fn<typeof fetch>();
const mount = async () => {
  let view: ReturnType<typeof render>;
  await act(async () => {
    view = render(<I18nProvider><AuthProvider><LoginGate /></AuthProvider></I18nProvider>);
  });
  return view!;
};

describe('automatic backend entrance', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('hides login offline and opens it on the next one-second check', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Connection refused'))
      .mockImplementation(async () => available());
    await mount();
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apply/ })).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(999); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Connected');
  });

  it('hides login again when the backend becomes unavailable', async () => {
    fetchMock.mockResolvedValueOnce(available()).mockRejectedValue(new TypeError('Offline'));
    await mount();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
  });

  it('does not probe invalid ports or persist an unreachable port', async () => {
    fetchMock.mockImplementation(async () => available());
    await mount();
    fireEvent.change(screen.getByLabelText('Backend port'), { target: { value: '70000' } });
    expect(screen.getByLabelText('Backend port')).toHaveAttribute('aria-invalid', 'true');
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRejectedValue(new TypeError('Offline'));
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Backend port'), { target: { value: '9443' } });
    });
    expect(localStorage.getItem('veto.backend.port')).toBe('8443');
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
  });

  it('ignores an old probe after switching ports and automatically saves the reachable port', async () => {
    let resolveOld!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
      .mockImplementation(async () => available());
    await mount();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Backend port'), { target: { value: '9443' } });
    });
    expect(String(fetchMock.mock.calls[1][0])).toContain(':9443/api/auth/status');
    await act(async () => { resolveOld(available(true)); });
    expect(localStorage.getItem('veto.backend.port')).toBe('9443');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it('rejects an accessible service that is not a Veto backend', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    await mount();
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for backend');
  });

  it('shows first-run setup only after a successful check', async () => {
    fetchMock.mockResolvedValue(available(true));
    await mount();
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('shows credential errors without treating them as an expired session', async () => {
    fetchMock.mockImplementation(async (url) => String(url).endsWith('/login')
      ? new Response(JSON.stringify({ message: 'Invalid credentials' }), { status: 401 })
      : available());
    await mount();
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign in' })); });
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
  });

  it('stops polling on unmount', async () => {
    fetchMock.mockImplementation(async () => available());
    const view = await mount();
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('restores an authenticated session and stops entrance polling', async () => {
    localStorage.setItem('veto.session.token', 'test-token');
    fetchMock.mockResolvedValue(available(false, true));
    await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ 'X-Veto-Session-Token': 'test-token' });
  });
});
