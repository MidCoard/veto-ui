import { Message, Session, WorkspaceNode, ConnectionState, RiskLevel } from './types';
import { WorkspaceTree } from './WorkspaceTree';
import { PreferencesVector } from './PreferencesVector';

/**
 * C2: Memory & Context System — Session Manager
 *
 * Manages the client's internal state:
 * - Dynamic workspace tree (WorkspaceTree)
 * - Sliding-window session history (messages per session)
 * - Vectorized long-term user preferences (PreferencesVector)
 * - DAGPayload message injection from WebSocket
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
    this.seedWorkspaceTree();
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

    // If not connected to backend, simulate a realistic Veto response
    if (this.connectionState !== 'connected') {
      this.simulateOfflineResponse(session.id, content);
    }
  }

  /**
   * Insert a message from the WebSocket into the appropriate session.
   * Called by VetoContext when DAGPayload arrives.
   */
  addExternalMessage(sessionId: string, message: Message): void {
    this.addMessageToSession(sessionId, message);
    this.processing = false;
  }

  /**
   * Handle a HITL approval/rejection decision.
   */
  handleApproval(messageId: string, approved: boolean): void {
    const session = this.getCurrentSession();
    if (!session) return;

    // Find the HITL message in the current session
    const hitlMsg = session.messages.find((m) => m.id === messageId);

    const responseMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      type: 'text',
      content: approved
        ? '✅ **HITL Approved.** Payload cleared for transmission to cloud backend via C3 Communication Bus.\n\n```json\n{\n  "veto_action": "pass",\n  "approved_by": "user",\n  "timestamp": "' + new Date().toISOString() + '"\n}\n```'
        : '⛔ **HITL Rejected.** Payload blocked by user intervention. Logged to C9 Observability.\n\n```json\n{\n  "veto_action": "block",\n  "blocked_by": "user",\n  "timestamp": "' + new Date().toISOString() + '"\n}\n```',
      timestamp: new Date(),
      metadata: {
        approved,
        vetoAction: approved ? 'pass' : 'block',
        originalMessageId: messageId,
        originalContent: hitlMsg?.metadata?.dagPayload,
      },
    };
    this.addMessageToSession(session.id, responseMsg);
    this.processing = false;
    this.notifyListeners();
  }

  // ---- Private: Offline simulation for demo purposes ----

  private simulateOfflineResponse(sessionId: string, userContent: string): void {
    const riskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    const randomRisk = riskLevels[Math.floor(Math.random() * riskLevels.length)];

    // Step 1: Show processing message
    setTimeout(() => {
      const processingMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'streaming',
        content: `**🛡️ Veto Gateway — Processing**\n\n\`\`\`\nAnalyzing: "${userContent.slice(0, 60)}${userContent.length > 60 ? '...' : ''}"\nToken estimate: ${Math.ceil(userContent.length / 4)}\nSLM check: pending...\nRedaction scan: pending...\n\`\`\`\n\n*Local SLM performing safety check before any data leaves this machine.*`,
        isStreaming: true,
        timestamp: new Date(),
      };
      this.addMessageToSession(sessionId, processingMsg);
    }, 500);

    // Step 2: Show redaction/safety results
    setTimeout(() => {
      const safetyMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        type: 'text',
        content: `**🔍 Veto Gateway — Safety Check Complete**\n\n| Check | Status |\n|-------|--------|\n| PII Detection | ✅ Not found |\n| Secrets Scanning | ✅ Not found |\n| Policy Compliance | ⚠️ ${randomRisk === 'critical' ? 'Flagged' : randomRisk === 'high' ? 'Review needed' : 'Passed'} |\n| Content Safety | ✅ Passed |\n\nRisk assessment: **${randomRisk.toUpperCase()}**`,
        timestamp: new Date(),
      };
      this.addMessageToSession(sessionId, safetyMsg);
    }, 1200);

    // Step 3: HITL approval if high/critical, otherwise auto-process
    if (randomRisk === 'high' || randomRisk === 'critical') {
      setTimeout(() => {
        const approvalPayload = JSON.stringify({
          action: 'agent_execute',
          params: {
            task: userContent.slice(0, 100),
            target: 'cloud-backend',
            model: 'gpt-4o-mini',
          },
          veto_context: {
            session_id: sessionId,
            risk_level: randomRisk,
            redacted_fields: [],
          },
        }, null, 2);

        const approvalMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'hitl_approval',
          content: '',
          timestamp: new Date(),
          metadata: {
            requires_approval: true,
            risk_level: randomRisk,
            title: randomRisk === 'critical'
              ? '🚨 Critical: Payload Blocked by SLM'
              : '⚠️ Review Required: Medium-Risk Payload',
            description: randomRisk === 'critical'
              ? 'Local SLM flagged this payload as potentially harmful. Manual review required before any data leaves this machine.'
              : 'This payload requires user authorization before transmission to the cloud backend.',
            payload: approvalPayload,
            approval_state: 'pending',
          },
        };
        this.addMessageToSession(sessionId, approvalMsg);
        this.processing = false;
        this.notifyListeners();
      }, 2000);
    } else {
      // Auto-process low/medium risk
      setTimeout(() => {
        const resultMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'text',
          content: `**✅ Veto Gateway — Transmission Complete**\n\nPayload sent to cloud backend (risk: ${randomRisk}).\n\n\`\`\`json\n{\n  "veto_action": "pass",\n  "risk_level": "${randomRisk}",\n  "processing_time": "1.2s",\n  "transmitted": true\n}\n\`\`\`\n\n*All outbound data passed through local Veto Gateway checks.*`,
          timestamp: new Date(),
        };
        this.addMessageToSession(sessionId, resultMsg);
        this.processing = false;
        this.notifyListeners();
      }, 2000);
    }
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

  addWorkspaceFolder(name: string, path: string, parentId: string = 'root'): WorkspaceNode {
    const node: WorkspaceNode = {
      id: crypto.randomUUID(),
      name,
      type: 'directory',
      path,
      children: [],
    };
    this.workspaceTree.addNode(parentId, node);
    this.notifyListeners();
    return node;
  }

  addWorkspaceFile(name: string, path: string, parentId: string = 'root'): WorkspaceNode {
    const node: WorkspaceNode = {
      id: crypto.randomUUID(),
      name,
      type: 'file',
      path,
    };
    this.workspaceTree.addNode(parentId, node);
    this.notifyListeners();
    return node;
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

  setProcessing(processing: boolean): void {
    this.processing = processing;
    this.notifyListeners();
  }

  // ---- Observer Pattern ----

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSessionsCount(): number {
    return this.sessions.size;
  }

  // ---- Private Helpers ----

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

  private notifyListeners(): void {
    this.listeners.forEach((fn) => fn());
  }

  private seedWorkspaceTree(): void {
    // Add some default workspace structure
    this.addWorkspaceFolder('source', '/source');
    this.addWorkspaceFolder('config', '/config');
    this.addWorkspaceFolder('output', '/output');
    this.addWorkspaceFile('main.ts', '/source/main.ts', this.getNodeIdByPath('/source') ?? 'root');
    this.addWorkspaceFile('veto.policy.json', '/config/veto.policy.json', this.getNodeIdByPath('/config') ?? 'root');
    this.addWorkspaceFile('agent.manifest.yaml', '/source/agent.manifest.yaml', this.getNodeIdByPath('/source') ?? 'root');
  }

  private getNodeIdByPath(path: string): string | null {
    // Simple lookup by path
    for (const node of this.workspaceTree.flatten()) {
      if (node.path === path) return node.id;
    }
    return null;
  }
}
