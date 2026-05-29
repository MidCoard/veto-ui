/**
 * C1/C2/C3: VetoContext — Global Application State Provider
 *
 * Provides a single source of truth for:
 *   - SessionManager (C2)
 *   - WebSocketService (C3) bridge
 *
 * All components consume state through React context + useSession hook.
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { SessionManager } from './SessionManager';
import { WebSocketService, wsService } from '../services/WebSocketService';
import { useSession } from './useSession';
import { DAGPayload, Message, ConnectionState, RiskLevel } from './types';

// ---- Veto Context Value ----

export interface VetoContextValue {
  /** Core session manager instance */
  sessionManager: SessionManager;
  /** WebSocket service instance */
  wsService: WebSocketService;

  /** Reactive state from useSession */
  messages: Message[];
  sessionId: string | null;
  connectionState: ConnectionState;
  isProcessing: boolean;

  /** Current pending HITL approval (null if none) */
  pendingApproval: PendingApproval | null;

  /** Connection status from WS service */
  wsConnected: boolean;
  wsStatus: ConnectionState;

  /** Actions */
  sendMessage: (content: string) => void;
  createSession: (name?: string) => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  handleApproval: (messageId: string, approved: boolean) => void;
  toggleSidebar: () => void;

  /** Sidebar state */
  sidebarOpen: boolean;
}

export interface PendingApproval {
  id: string;
  title: string;
  description: string;
  payload: string;
  riskLevel: RiskLevel;
  payloadLanguage: string;
  sessionId: string;
}

const VetoContext = createContext<VetoContextValue | null>(null);

// ---- Provider Component ----

export const VetoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Stable references (useRef ensures singletons survive re-renders)
  const sessionManagerRef = useRef<SessionManager>(new SessionManager());
  const sessionManager = sessionManagerRef.current;

  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // WebSocket reactive state
  const [wsStatus, setWsStatus] = useState<ConnectionState>(wsService.getStatus());

  // React to session state changes
  const { messages, sessionId, connectionState, processing: isProcessing } = useSession(sessionManager);

  // Wire up WebSocket → SessionManager bridging
  useEffect(() => {
    // Status listener
    const unsubStatus = wsService.onStatus((status) => {
      setWsStatus(status);
      sessionManager.setConnectionState(status);
    });

    // Message listener — transform DAGPayload → Message and inject into SessionManager
    const unsubMessage = wsService.onMessage((payload: DAGPayload) => {
      if (payload.type === 'dag_heartbeat') return; // Ignore heartbeats

      // Convert DAGPayload to our internal Message type
      const message: Message = {
        id: payload.id,
        role: payload.role === 'tool' ? 'assistant' : payload.role,
        type: payload.content_type === 'json' ? 'code_result'
          : payload.metadata?.requires_approval ? 'hitl_approval'
          : payload.role === 'user' ? 'text'
          : 'text',
        content: payload.content,
        isStreaming: false,
        metadata: {
          ...payload.metadata,
          dagPayload: payload,
        },
        timestamp: new Date(payload.timestamp),
      };

      // Add to current session
      if (payload.session_id === sessionManager.getCurrentSession()?.id) {
        // For now use the internal method
        sessionManager.addExternalMessage(payload.session_id, message);
      }

      // If this requires HITL approval, pop the card
      if (payload.metadata?.requires_approval && payload.metadata?.approval_state === 'pending') {
        setPendingApproval({
          id: payload.id,
          title: payload.metadata.title || 'Outbound Payload Requires Approval',
          description: payload.metadata.description || 'This payload must be reviewed before transmission to the cloud backend.',
          payload: payload.content,
          riskLevel: payload.metadata.risk_level,
          payloadLanguage: payload.content_type === 'json' ? 'json'
            : payload.content_type === 'code' ? 'text'
            : 'text',
          sessionId: payload.session_id,
        });
      }
    });

    // Connect on mount
    wsService.connect();

    return () => {
      unsubStatus();
      unsubMessage();
      // Don't disconnect on unmount — this is persistent
    };
  }, [sessionManager]);

  // ---- Actions ----

  const sendMessage = useCallback((content: string) => {
    const session = sessionManager.getCurrentSession();
    if (!session) return;

    // Add user message locally
    sessionManager.sendMessage(content);

    // Send via WebSocket if connected
    if (wsService.isConnected()) {
      const dagPayload: DAGPayload = {
        id: crypto.randomUUID(),
        type: 'dag_message',
        parent_ids: [],
        session_id: session.id,
        role: 'user',
        content,
        content_type: 'text',
        metadata: {
          requires_approval: false,
          risk_level: 'low',
          approval_state: 'approved',
          veto_action: 'pass',
        },
        timestamp: new Date().toISOString(),
      };
      wsService.send(dagPayload);
    }
  }, [sessionManager]);

  const createSession = useCallback((name?: string) => {
    sessionManager.createSession(name);
  }, [sessionManager]);

  const switchSession = useCallback((id: string) => {
    sessionManager.switchToSession(id);
    // Clear pending approval when switching sessions
    setPendingApproval(null);
  }, [sessionManager]);

  const deleteSession = useCallback((id: string) => {
    sessionManager.deleteSession(id);
  }, [sessionManager]);

  const handleApproval = useCallback((messageId: string, approved: boolean) => {
    // Handle via SessionManager
    sessionManager.handleApproval(messageId, approved);
    setPendingApproval(null);

    // Notify backend
    const session = sessionManager.getCurrentSession();
    if (session && wsService.isConnected()) {
      wsService.sendApproval(messageId, approved, session.id);
    }
  }, [sessionManager]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const wsConnected = wsStatus === 'connected';

  const value: VetoContextValue = {
    sessionManager,
    wsService,
    messages,
    sessionId,
    connectionState,
    isProcessing,
    pendingApproval,
    wsConnected,
    wsStatus,
    sendMessage,
    createSession,
    switchSession,
    deleteSession,
    handleApproval,
    toggleSidebar,
    sidebarOpen,
  };

  return (
    <VetoContext.Provider value={value}>
      {children}
    </VetoContext.Provider>
  );
};

// ---- Hook ----

export function useVeto(): VetoContextValue {
  const ctx = useContext(VetoContext);
  if (!ctx) {
    throw new Error('useVeto must be used within a VetoProvider');
  }
  return ctx;
}
