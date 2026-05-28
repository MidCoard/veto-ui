import { useState, useEffect } from 'react';
import { SessionManager } from './SessionManager';
import { Message, ConnectionState } from './types';

/**
 * C2: React hook for consuming SessionManager state.
 * Re-renders components when session state changes.
 */
export function useSession(sessionManager: SessionManager) {
  const [messages, setMessages] = useState<Message[]>(
    sessionManager.getCurrentSessionMessages()
  );
  const [sessionId, setSessionId] = useState<string | null>(
    sessionManager.getCurrentSession()?.id ?? null
  );
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    sessionManager.getConnectionState()
  );
  const [processing, setProcessing] = useState(sessionManager.isProcessing());

  useEffect(() => {
    const unsubscribe = sessionManager.subscribe(() => {
      setMessages(sessionManager.getCurrentSessionMessages());
      setSessionId(sessionManager.getCurrentSession()?.id ?? null);
      setConnectionState(sessionManager.getConnectionState());
      setProcessing(sessionManager.isProcessing());
    });
    return unsubscribe;
  }, [sessionManager]);

  return { messages, sessionId, connectionState, processing };
}
