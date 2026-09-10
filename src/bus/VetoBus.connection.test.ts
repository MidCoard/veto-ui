import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { VetoBus } from './VetoBus';
import { setToken } from '../api/client';

class Socket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: Socket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor() { Socket.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  ack(seq: number) { this.onmessage?.({ data: 'a' + JSON.stringify([JSON.stringify({ type: 'heartbeat_ack', seq })]) }); }
}

beforeEach(() => {
  vi.useFakeTimers(); Socket.instances = []; setToken('test');
  vi.stubGlobal('WebSocket', Socket);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); setToken(null); });

it('reconnects a half-open socket without replaying a command', async () => {
  const bus = new VetoBus(); bus.connect();
  const socket = Socket.instances[0]; socket.open();
  await vi.advanceTimersByTimeAsync(40000);
  expect(socket.close).toHaveBeenCalledWith(4000, expect.any(String));
  expect(bus.getStatus()).toBe('reconnecting');
  await vi.advanceTimersByTimeAsync(2500);
  expect(Socket.instances).toHaveLength(2);
  expect(socket.send).toHaveBeenCalledTimes(1);
  expect(socket.send.mock.calls[0][0]).toContain('heartbeat');
  bus.disconnect();
});

it('requires the matching heartbeat acknowledgement and stops reconnecting on logout', async () => {
  const bus = new VetoBus(); bus.connect();
  const socket = Socket.instances[0]; socket.open();
  await vi.advanceTimersByTimeAsync(30000);
  socket.ack(1);
  await vi.advanceTimersByTimeAsync(10000);
  expect(socket.close).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(20000);
  socket.ack(999);
  await vi.advanceTimersByTimeAsync(10000);
  expect(bus.getStatus()).toBe('reconnecting');
  bus.disconnect();
  await vi.advanceTimersByTimeAsync(60000);
  expect(Socket.instances).toHaveLength(1);
});
