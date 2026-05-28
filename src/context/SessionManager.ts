import { Message, Session, WorkspaceNode, ConnectionState } from './types';
import { WorkspaceTree } from './WorkspaceTree';
import { PreferencesVector } from './PreferencesVector';

/**
 * C2: Memory & Context System — Session Manager
 *
 * Manages the client's internal state:
 * - Dynamic workspace tree (WorkspaceTree)
 * - Sliding-window session history (messages per session)
 * - Vectorized long-term user preferences (PreferencesVector)
 *
 * This is used by the UI but contains no rendering or routing logic.
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private currentSessionId: string | null = null;
  private processing = false;
  private connectionState: ConnectionState = 'disconnected';
  private workspaceTree: WorkspaceTree = new WorkspaceTree();
  private preferences: PreferencesVector = new PreferencesVector();
  private maxMessagesPerSession = 100; // Sliding window limit
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.createSession('Default');
  }

  // ---- Session Lifecycle ----

  createSession(name?: string): Session {
    const session: Session = {
      id: crypto.randomUUID(),
      name: name ?? `Session ${this.sessions.size + 1}`,
      created: new Date(),
      lastActivity: new Date(),
      messageCount: 0,
      messages: [],
    };
    this.sessions.set(session.id, session);
    this.currentSessionId = session.id;
    this.notifyListeners();
    return session;
  }

  switchToSession(sessionId: string): boolean {
    if (!this.sessions.has(sessionId)) return false;
    this.currentSessionId = sessionId;
    this.notifyListeners();
    return true;
  }

  deleteSession(sessionId: string): boolean {
    if (this.sessions.size <= 1) return false; // Keep at least one
    const deleted = this.sessions.delete(sessionId);
    if (deleted && this.currentSessionId === sessionId) {
      this.currentSessionId = this.sessions.keys().next().value ?? null;
    }
    this.notifyListeners();
    return deleted;
  }

  // ---- Message Management (Sliding Window) ----

  sendMessage(content: string): void {
    const session = this.getCurrentSession();
    if (!session) return;

    // Add user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      type: 'text',
      content,
      timestamp: new Date(),
    };
    this.addMessageToSession(session.id, userMsg);
    this.processing = true;
    this.notifyListeners();

    // Simulate assistant response (will be replaced by real Veto flow)
    setTimeout(() => {
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'text',
        content: `**Veto Gateway:** Message received. Processing through C7 Local SLM...\n\nPayload length: ${content.length} bytes\nRedaction check: pending\n\n*Waiting for HITL approval before transmitting to cloud backend.*`,
        timestamp: new Date(),
      };
      this.addMessageToSession(session.id, assistantMsg);
      this.processing = false;
      this.notifyListeners();
    }, 800);
  }

  private addMessageToSession(sessionId: string, message: Message): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.messages.push(message);
    session.messageCount = session.messages.length;
    session.lastActivity = new Date();

    // Enforce sliding window
    if (session.messages.length > this.maxMessagesPerSession) {
      const overflow = session.messages.length - this.maxMessagesPerSession;
      session.messages.splice(0, overflow);
    }

    this.notifyListeners();
  }

  handleApproval(messageId: string, approved: boolean): void {
    // In production, routes to C3 Bus for transmission or C7 for blocking
    const session = this.getCurrentSession();
    if (!session) return;

    const responseMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      type: 'text',
      content: approved
        ? '✅ **HITL Approved.** Payload transmitted to cloud backend via C3 Communication Bus.'
        : '⛔ **HITL Rejected.** Payload blocked by user. Logged to C9 Observability.',
      timestamp: new Date(),
      metadata: {
        approved,
        messageId,
        vetoAction: approved ? 'pass' : 'block',
      },
    };
    this.addMessageToSession(session.id, responseMsg);
    this.processing = false;
    this.notifyListeners();
  }

  // ---- Connection State ----

  setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.notifyListeners();
  }

  // ---- Workspace Tree (C2) ----

  addWorkspaceNode(parentId: string, node: WorkspaceNode): boolean {
    return this.workspaceTree.addNode(parentId, node);
  }

  getWorkspaceTree(): WorkspaceTree {
    return this.workspaceTree;
  }

  getWorkspaceNodeCount(): number {
    return this.workspaceTree.getNodeCount();
  }

  // ---- Preferences (C2) ----

  getPreferences(): PreferencesVector {
    return this.preferences;
  }

  // ---- Getters ----

  getCurrentSession(): Session | null {
    if (!this.currentSessionId) return null;
    return this.sessions.get(this.currentSessionId) ?? null;
  }

  getSessions(): Session[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  getCurrentSessionMessages(): Message[] {
    return this.getCurrentSession()?.messages ?? [];
  }

  isProcessing(): boolean {
    return this.processing;
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  // ---- Observer Pattern ----

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((fn) => fn());
  }
}
