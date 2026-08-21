import { describe, it, expect } from 'vitest';
import { classifyFrame, sockJsUrl, unwrapSockJsFrame } from './VetoBus';
import { setBackendPort } from '../config/backend';

describe('unwrapSockJsFrame', () => {
  it('ignores open, heartbeat, and close frames', () => {
    expect(unwrapSockJsFrame('o')).toEqual([]);
    expect(unwrapSockJsFrame('h')).toEqual([]);
    expect(unwrapSockJsFrame('c[3000,"Go away!"]')).toEqual([]);
    expect(unwrapSockJsFrame('')).toEqual([]);
  });

  it('unwraps a single-message data frame', () => {
    const welcome = JSON.stringify({ type: 'welcome', sessionId: 'abc', timestamp: 't', version: '1' });
    const payloads = unwrapSockJsFrame(`a[${JSON.stringify(welcome)}]`);
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({ type: 'welcome', sessionId: 'abc' });
  });

  it('unwraps batched data frames', () => {
    const one = JSON.stringify({ type: 'heartbeat_ack', seq: 1 });
    const two = JSON.stringify({ kind: 'ASSISTANT_MESSAGE', sessionId: 's', text: 'hi' });
    const payloads = unwrapSockJsFrame(`a[${JSON.stringify(one)},${JSON.stringify(two)}]`);
    expect(payloads).toHaveLength(2);
  });

  it('skips unparseable entries instead of throwing', () => {
    expect(unwrapSockJsFrame('a["not json"]')).toEqual([]);
    expect(unwrapSockJsFrame('a{broken')).toEqual([]);
    expect(unwrapSockJsFrame('a123')).toEqual([]);
  });

  it('unwrapped payloads classify correctly end-to-end', () => {
    const delta = JSON.stringify({
      sessionId: 's', sequence: 2, emittedAt: 't', kind: 'ASSISTANT_THOUGHT', text: 'thinking', attrs: {},
    });
    const [payload] = unwrapSockJsFrame(`a[${JSON.stringify(delta)}]`);
    expect(classifyFrame(payload)?.family).toBe('delta');
  });
});

describe('sockJsUrl', () => {
  it('builds a SockJS websocket-transport URL', () => {
    expect(sockJsUrl('localhost:5173', 'ws')).toMatch(
      /^ws:\/\/localhost:5173\/ws\/veto\/bus\/\d{3}\/[a-z0-9]+\/websocket$/,
    );
  });

  it('can target the configured backend instead of the Vite port', () => {
    setBackendPort(9443);
    expect(sockJsUrl('localhost:9443', 'ws')).toMatch(
      /^ws:\/\/localhost:9443\/ws\/veto\/bus\/\d{3}\/[a-z0-9]+\/websocket$/,
    );
  });
});

describe('classifyFrame', () => {
  it('recognizes a DeltaFrame by kind + sessionId', () => {
    const incoming = classifyFrame({
      sessionId: '3f6b2a1e-1234-4abc-9def-000000000001',
      sequence: 7,
      emittedAt: '2026-08-10T10:00:00Z',
      kind: 'ASSISTANT_THOUGHT',
      text: 'I should read the file first.',
      attrs: {},
    });

    expect(incoming).not.toBeNull();
    expect(incoming?.family).toBe('delta');
    if (incoming?.family === 'delta') {
      expect(incoming.frame.kind).toBe('ASSISTANT_THOUGHT');
      expect(incoming.frame.sequence).toBe(7);
      expect(incoming.frame.text).toBe('I should read the file first.');
    }
  });

  it('recognizes bus messages by type', () => {
    const welcome = classifyFrame({
      type: 'welcome',
      sessionId: 'ws-conn-id',
      timestamp: '2026-08-10T10:00:00Z',
      version: '1.0.59',
    });
    // Has BOTH kind absent and type present → bus message even though sessionId exists.
    expect(welcome?.family).toBe('bus');

    const ack = classifyFrame({ type: 'heartbeat_ack', seq: 3, timestamp: '2026-08-10T10:00:00Z' });
    expect(ack?.family).toBe('bus');
    if (ack?.family === 'bus') {
      expect(ack.message.type).toBe('heartbeat_ack');
      expect(ack.message.seq).toBe(3);
    }
  });

  it('tolerates missing optional DeltaFrame fields', () => {
    const incoming = classifyFrame({ kind: 'ASSISTANT_MESSAGE', sessionId: 'abc' });
    expect(incoming?.family).toBe('delta');
    if (incoming?.family === 'delta') {
      expect(incoming.frame.sequence).toBe(0);
      expect(incoming.frame.text).toBe('');
      expect(incoming.frame.attrs).toEqual({});
    }
  });

  it('returns null for unrecognized shapes', () => {
    expect(classifyFrame(null)).toBeNull();
    expect(classifyFrame('string')).toBeNull();
    expect(classifyFrame(42)).toBeNull();
    expect(classifyFrame({})).toBeNull();
    expect(classifyFrame({ seq: 1 })).toBeNull();
  });
});
