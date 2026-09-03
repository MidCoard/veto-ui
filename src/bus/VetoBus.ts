/**
 * Client for the veto-core WebSocket bus at /ws/veto/bus.
 *
 * Transport: the endpoint is SockJS-only ("Welcome to SockJS!" on the base
 * path; raw upgrades get a 400), so this client speaks the SockJS websocket
 * transport directly — no dependency needed, the framing is trivial:
 *   URL:    /ws/veto/bus/<server:3digits>/<session:alnum>/websocket
 *   Server: "o" open frame, then "a[\"<json>\",...]" message arrays,
 *           "h" heartbeats, "c[code,\"reason\"]" close.
 *   Client: sends ["<json>"] arrays.
 *
 * Application protocol (bus/VetoWebSocketHandler.java + bus/DeltaFrame.java):
 * - Server pushes two frame families as flat JSON objects (after unwrapping):
 *     a) DeltaFrames:  {sessionId, sequence, emittedAt, kind, text, attrs}
 *        (agent live stream; today only ASSISTANT_MESSAGE / ASSISTANT_THOUGHT are emitted)
 *     b) Bus messages: {type: "welcome" | "heartbeat_ack" | "subscribed" | "unsubscribed"
 *                       | "dag.received" | "dag.payload" | "dag.result" | "veto.result"
 *                       | "veto.stream" | "echo" | "error", ...}
 * - Client → server: {"type":"heartbeat","seq":n}, {"type":"subscribe","topic"?}, etc.
 * - The handshake carries the existing Veto session token; the backend binds
 *   the authenticated user to the socket and only forwards that user's frames.
 *
 * The dev server proxies /ws → http://localhost:8443 (ws:true), so the client
 * connects same-origin: ws(s)://<host>/ws/veto/bus/...
 */

import { backendWebSocketHost } from '../config/backend';
import { getToken } from '../api/client';

// ---- Frame types ----

export type DeltaKind =
  | 'ASSISTANT_THOUGHT'
  | 'ASSISTANT_MESSAGE'
  | 'TOOL_CALL'
  | 'TOOL_RESULT'
  | 'COMPACTION'
  | 'BREAKER_TRIPPED'
  | 'ERROR';

export interface DeltaFrame {
  sessionId: string;
  sequence: number;
  emittedAt: string;
  kind: DeltaKind | string;
  text: string;
  attrs: Record<string, unknown>;
}

export interface BusMessage {
  type: string;
  [key: string]: unknown;
}

export type IncomingFrame = { family: 'delta'; frame: DeltaFrame } | { family: 'bus'; message: BusMessage };

/**
 * Unwrap one SockJS websocket-transport frame into its application payloads.
 * Returns [] for open ("o"), heartbeat ("h") and close ("c[...]") frames;
 * for data frames ("a[...]") it returns the parsed JSON payload of each
 * message in the array (unparseable entries are skipped).
 */
export function unwrapSockJsFrame(data: string): unknown[] {
  if (data.length === 0 || !data.startsWith('a')) return [];
  let messages: unknown;
  try {
    messages = JSON.parse(data.slice(1));
  } catch {
    return [];
  }
  if (!Array.isArray(messages)) return [];
  const payloads: unknown[] = [];
  for (const message of messages) {
    if (typeof message !== 'string') continue;
    try {
      payloads.push(JSON.parse(message));
    } catch {
      // Skip unparseable entries.
    }
  }
  return payloads;
}

/** SockJS websocket-transport URL for the bus endpoint on a given host. */
export function sockJsUrl(host: string, protocol: 'ws' | 'wss', token: string): string {
  const server = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  const session = Math.random().toString(36).slice(2, 10);
  return `${protocol}://${host}/ws/veto/bus/${server}/${session}/websocket?token=${encodeURIComponent(token)}`;
}

/**
 * Classify a parsed JSON frame. DeltaFrames are distinguished by the presence
 * of `kind` + `sessionId` (they carry no `type` field). Returns null for
 * shapes that match neither family.
 */
export function classifyFrame(data: unknown): IncomingFrame | null {
  if (data === null || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;

  if (typeof record.kind === 'string' && typeof record.sessionId === 'string') {
    return {
      family: 'delta',
      frame: {
        sessionId: record.sessionId,
        sequence: typeof record.sequence === 'number' ? record.sequence : 0,
        emittedAt: typeof record.emittedAt === 'string' ? record.emittedAt : '',
        kind: record.kind,
        text: typeof record.text === 'string' ? record.text : '',
        attrs:
          record.attrs !== null && typeof record.attrs === 'object'
            ? (record.attrs as Record<string, unknown>)
            : {},
      },
    };
  }

  if (typeof record.type === 'string') {
    return { family: 'bus', message: record as BusMessage };
  }

  return null;
}

// ---- Connection ----

export type BusStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface BusListeners {
  onDelta?: (frame: DeltaFrame) => void;
  onMessage?: (message: BusMessage) => void;
  onStatus?: (status: BusStatus) => void;
}

const HEARTBEAT_INTERVAL_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 20;

export class VetoBus {
  private ws: WebSocket | null = null;
  private status: BusStatus = 'disconnected';
  private listeners: BusListeners;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private manualDisconnect = false;
  private heartbeatSeq = 0;

  constructor(listeners: BusListeners = {}) {
    this.listeners = listeners;
  }

  setListeners(listeners: BusListeners): void {
    this.listeners = listeners;
  }

  getStatus(): BusStatus {
    return this.status;
  }

  connect(): void {
    if (this.ws !== null && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.manualDisconnect = false;
    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    const token = getToken();
    if (token === null) {
      this.setStatus('disconnected');
      return;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(sockJsUrl(backendWebSocketHost(), protocol, token));

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus('connected');
      this.startHeartbeat();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      for (const payload of unwrapSockJsFrame(event.data as string)) {
        const incoming = classifyFrame(payload);
        if (incoming === null) continue;
        if (incoming.family === 'delta') {
          this.listeners.onDelta?.(incoming.frame);
        } else {
          this.listeners.onMessage?.(incoming.message);
        }
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.stopHeartbeat();
      this.setStatus('disconnected');
      if (!this.manualDisconnect && event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose follows and drives reconnection.
    };
  }

  disconnect(): void {
    this.manualDisconnect = true;
    this.stopHeartbeat();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = MAX_RECONNECT_ATTEMPTS;
    if (this.ws !== null) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  send(message: Record<string, unknown>): boolean {
    if (this.ws === null || this.ws.readyState !== WebSocket.OPEN) return false;
    // SockJS websocket transport: messages are JSON arrays of JSON strings.
    this.ws.send(JSON.stringify([JSON.stringify(message)]));
    return true;
  }

  private setStatus(status: BusStatus): void {
    this.status = status;
    this.listeners.onStatus?.(status);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.heartbeatSeq += 1;
      this.send({ type: 'heartbeat', seq: this.heartbeatSeq });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
    this.reconnectAttempts += 1;
    const base = BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
    const delay = Math.min(base + Math.random() * 1_000, MAX_RECONNECT_DELAY_MS);
    this.setStatus('reconnecting');
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
