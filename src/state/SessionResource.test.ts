import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SessionResource } from './SessionResource';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('shares a snapshot, coalesces bursts and never polls an idle resource', async () => {
  const fetch = vi.fn().mockResolvedValue(['first']);
  const resource = new SessionResource(fetch);
  resource.subscribe(() => {});
  resource.subscribe(() => {});
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 100; i++) resource.invalidate();
  await vi.advanceTimersByTimeAsync(249);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(60000);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('does not starve under a continuous event stream', async () => {
  const fetch = vi.fn().mockResolvedValue('data');
  const resource = new SessionResource(fetch);
  resource.subscribe(() => {});
  await vi.advanceTimersByTimeAsync(0);
  resource.invalidate();
  for (let i = 0; i < 4; i++) {
    await vi.advanceTimersByTimeAsync(50);
    resource.invalidate();
  }
  await vi.advanceTimersByTimeAsync(50);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('queues one follow-up for a change during a fetch and accepts metadata-only changes', async () => {
  let resolve!: (value: { text: string }[]) => void;
  const fetch = vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r; }))
    .mockResolvedValue([{ text: 'updated metadata' }]);
  const resource = new SessionResource(fetch);
  resource.subscribe(() => {});
  resource.invalidate();
  resource.invalidate();
  await vi.advanceTimersByTimeAsync(1000);
  expect(fetch).toHaveBeenCalledTimes(1);
  resolve([{ text: 'before' }]);
  await vi.advanceTimersByTimeAsync(0);
  expect(resource.getSnapshot().stale).toBe(true);
  await vi.advanceTimersByTimeAsync(250);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(resource.getSnapshot().data).toEqual([{ text: 'updated metadata' }]);
  expect(resource.getSnapshot().stale).toBe(false);
});

it('keeps inactive resources dirty without fetching and reuses clean cached snapshots', async () => {
  const fetch = vi.fn().mockResolvedValue('cached');
  const resource = new SessionResource(fetch);
  const stop = resource.subscribe(() => {});
  await vi.advanceTimersByTimeAsync(0);
  stop();
  const again = resource.subscribe(() => {});
  expect(fetch).toHaveBeenCalledTimes(1);
  again();
  resource.invalidate();
  await vi.advanceTimersByTimeAsync(1000);
  expect(fetch).toHaveBeenCalledTimes(1);
  resource.subscribe(() => {});
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('retains the last snapshot on failure without retry loops', async () => {
  const fetch = vi.fn().mockResolvedValueOnce('cached').mockRejectedValue(new Error('offline'));
  const resource = new SessionResource(fetch);
  resource.subscribe(() => {});
  await vi.advanceTimersByTimeAsync(0);
  resource.invalidate();
  await vi.advanceTimersByTimeAsync(60000);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(resource.getSnapshot()).toMatchObject({ data: 'cached', loading: false, stale: true });
  expect(resource.getSnapshot().error).toBeInstanceOf(Error);
});

it('aborts disposed scopes and ignores even an abort-insensitive response', async () => {
  let resolve!: (value: string) => void;
  const fetch = vi.fn().mockImplementation(() => new Promise(r => { resolve = r; }));
  const resource = new SessionResource(fetch);
  const listener = vi.fn();
  resource.subscribe(listener);
  resource.dispose();
  listener.mockClear();
  expect(fetch.mock.calls[0][0].aborted).toBe(true);
  resolve('old account');
  await vi.advanceTimersByTimeAsync(0);
  expect(resource.getSnapshot().data).toBeNull();
  expect(listener).not.toHaveBeenCalled();
});
