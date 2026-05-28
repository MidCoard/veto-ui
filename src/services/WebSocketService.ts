/**
 * C3: WebSocket Service (UI-side)
 * Client-side WebSocket connection to the Veto Core backend.
 * Handles connection lifecycle, reconnection, and message routing to C2 SessionManager.
 */

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelayMs = 2000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private messageListeners: Set<(data: unknown) => void> = new Set();
  private status: ConnectionStatus = 'disconnected';

  constructor(url: string = 'ws://localhost:9090/veto/bus') {
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.setStatus('connecting');
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.messageListeners.forEach((fn) => fn(data));
        } catch {
          this.messageListeners.forEach((fn) => fn(event.data));
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.setStatus('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        console.error('[Veto WS] Connection error');
        this.ws?.close();
      };
    } catch (error) {
      console.error('[Veto WS] Connection failed:', error);
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnect
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  send(data: string | object): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[Veto WS] Cannot send — not connected');
      return;
    }
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    this.ws.send(payload);
  }

  onStatus(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onMessage(listener: (data: unknown) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status));
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1),
      30_000
    );

    this.setStatus('reconnecting');
    console.log(`[Veto WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.send(JSON.stringify({ type: 'heartbeat', ts: Date.now() }));
    }, 30_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
