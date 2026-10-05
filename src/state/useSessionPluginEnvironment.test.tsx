import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { useSessionPluginEnvironment } from './useSessionPluginEnvironment';

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it('scopes continuation to the session and exact unavailable environment snapshot', async () => {
  vi.mocked(apiRequest)
    .mockResolvedValueOnce([{ id: 'one', version: '1', revision: 'a', available: false, availability: 'ABSENT' }])
    .mockResolvedValueOnce([{ id: 'one', version: '1', revision: 'b', available: false, availability: 'REVISION_MISMATCH' }]);
  const { result, rerender } = renderHook(({ name }) => useSessionPluginEnvironment(name), { initialProps: { name: 'alpha' as string | null } });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.acknowledged).toBe(false);
  act(() => result.current.acknowledge());
  expect(result.current.acknowledged).toBe(true);

  rerender({ name: 'beta' });
  await waitFor(() => expect(result.current.missing[0]?.revision).toBe('b'));
  expect(result.current.acknowledged).toBe(false);
});

it('requires a fresh continuation choice after leaving and returning to a session', async () => {
  vi.mocked(apiRequest).mockResolvedValue([{ id: 'one', version: '1', revision: 'a', available: false, availability: 'ABSENT' }]);
  const { result, rerender } = renderHook(({ name }) => useSessionPluginEnvironment(name), { initialProps: { name: 'alpha' as string | null } });
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.acknowledge());
  expect(result.current.acknowledged).toBe(true);

  rerender({ name: null });
  rerender({ name: 'alpha' });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.acknowledged).toBe(false);
});

it('expires continuation on reconnect and explicit revalidation with the same missing plugins', async () => {
  vi.mocked(apiRequest).mockResolvedValue([{ id: 'one', version: '1', revision: 'a', available: false, availability: 'ABSENT' }]);
  const { result, rerender } = renderHook(({ epoch }) => useSessionPluginEnvironment('alpha', epoch), { initialProps: { epoch: 'connected' } });
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.acknowledge());
  expect(result.current.acknowledged).toBe(true);

  rerender({ epoch: 'disconnected' });
  await waitFor(() => expect(result.current.loading).toBe(false));
  rerender({ epoch: 'connected' });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.acknowledged).toBe(false);

  act(() => result.current.acknowledge());
  expect(result.current.acknowledged).toBe(true);
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.acknowledged).toBe(false);
});
