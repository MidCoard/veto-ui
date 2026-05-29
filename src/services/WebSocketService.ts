/**
 * C3: WebSocket Service (UI-side)
 *
 * Client-side WebSocket connection to the Veto Core backend at
 * ws://localhost:9090/ws/veto/bus.
 *
 * Handles:
 *   - Connection lifecycle with exponential backoff reconnection
 *   - DAGPayload formatted message send/receive
 *   - Heartbeat keepalive
 *   - Typed event emission for React consumption
 */

import { DAGPayload, DAGAck, ConnectionState } from '../context/types';

export type ConnectionStatus = ConnectionState;

export interface WSMessageEvent {
  type: 'message';
  payload: DAGPayload;
}

export interface WSStatusEvent {
  type: 'status';
  status: ConnectionStatus;
}

export interface WSErrorEvent {
  type: 'error';
  error: string;
}

export type WSEvent = WSMessageEvent | WSStatusEvent | WSErrorEvent;

export type WSEventListener = (event: WSEvent) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private baseReconnectDelayMs = 1000;
  private maxReconnectDelayMs = 30_000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<WSEventListener> = new Set();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private messageListeners: Set<(payload: DAGPayload) => void> = new Set();
  private status: ConnectionStatus = 'disconnected';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualDisconnect = false;

  constructor(url: string = 'ws://localhost:9090/ws/veto/bus') {
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.manualDisconnect = false;
    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        this.startHeartbeat();
        this.emit({ type: 'status', status: 'connected' });
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string);

          // Handle DAGPayload messages
          if (data && typeof data === 'object' && data.type?.startsWith('dag_')) {
            const dagPayload = data as DAGPayload;
            this.messageListeners.forEach((fn) => fn(dagPayload));
            this.emit({ type: 'message', payload: dagPayload });
          } else if (data && data.type === 'heartbeat_ack') {
            // Heartbeat acknowledged — no-op
          } else {
            // Unknown format — still forward for inspection
            this.emit({ type: 'message', payload: data as DAGPayload });
          }
        } catch (parseError) {
          // Non-JSON message — forward raw
          console.warn('[Veto WS] Non-JSON message:', event.data);
          this.emit({ type: 'error', error: `Non-JSON: ${String(event.data).slice(0, 100)}` });
        }
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.stopHeartbeat();
        this.setStatus('disconnected');

        if (!this.manualDisconnect && event.code !== 1000) {
          this.scheduleReconnect();
        } else {
          this.setStatus('disconnected');
        }
        this.emit({ type: 'status', status: 'disconnected' });
      };

      this.ws.onerror = (_event: Event) => {
        console.error('[Veto WS] Connection error');
        this.emit({ type: 'error', error: 'WebSocket connection error' });
        // onclose will fire after onerror, triggering reconnect
      };
    } catch (error) {
      console.error('[Veto WS] Connection failed:', error);
      this.setStatus('disconnected');
      this.emit({ type: 'error', error: `Connection failed: ${error}` });
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.manualDisconnect = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnect

    if (this.ws) {
      // Remove handlers to prevent reconnect trigger
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setStatus('disconnected');
    this.emit({ type: 'status', status: 'disconnected' });
  }

  /**
   * Send a DAGPayload to the backend.
   * Automatically wraps in the correct format if needed.
   */
  send(payload: DAGPayload | DAGAck | string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[Veto WS] Cannot send — not connected');
      return false;
    }

    try {
      const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
      this.ws.send(data);
      return true;
    } catch (error) {
      console.error('[Veto WS] Send failed:', error);
      return false;
    }
  }

  /**
   * Send an approval or rejection for a HITL payload.
   */
  sendApproval(ackId: string, approved: boolean, sessionId: string): boolean {
    const ack: DAGAck = {
      type: 'dag_ack',
      ack_id: ackId,
      status: approved ? 'approved' : 'rejected',
      session_id: sessionId,
      timestamp: new Date().toISOString(),
    };
    return this.send(ack);
  }

  // ---- Event Subscriptions ----

  /**
   * Subscribe to all WebSocket events.
   */
  subscribe(listener: WSEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Subscribe to connection status changes.
   */
  onStatus(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status); // Immediately fire with current status
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Subscribe to DAGPayload messages.
   */
  onMessage(listener: (payload: DAGPayload) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.status === 'connected';
  }

  // ---- Internal ----

  private emit(event: WSEvent): void {
    this.listeners.forEach((fn) => fn(event));
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status));
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Veto WS] Max reconnect attempts reached');
      this.setStatus('disconnected');
      this.emit({ type: 'error', error: 'Max reconnect attempts reached' });
      return;
    }

    this.reconnectAttempts++;
    // Exponential backoff with jitter
    const baseDelay = this.baseReconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1);
    const jitter = Math.random() * 1000;
    const delay = Math.min(baseDelay + jitter, this.maxReconnectDelayMs);

    this.setStatus('reconnecting');
    console.log(`[Veto WS] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.send(JSON.stringify({ type: 'dag_heartbeat', id: crypto.randomUUID(), timestamp: new Date().toISOString() }));
    }, 30_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

// ---- Singleton Export ----
// The entire app uses one WebSocket connection.
export const wsService = new WebSocketService();
