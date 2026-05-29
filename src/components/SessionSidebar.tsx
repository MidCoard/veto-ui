import React from 'react';
import { SessionManager } from '../context/SessionManager';
import { useVeto } from '../context/VetoContext';

/**
 * C1/C2: Session Sidebar — displays session history and workspace tree.
 * Integrated with C2 Memory & Context System for session management.
 *
 * This component consumes VetoContext for reactive state updates.
 * When sessions change (create/switch/delete), the sidebar re-renders.
 */
interface SessionSidebarProps {
  open: boolean;
  onToggle: () => void;
  sessionManager: SessionManager;
}

const SessionSidebarInner: React.FC = () => {
  const {
    sessionManager,
    createSession,
    switchSession,
    deleteSession,
    sessionId: currentSessionId,
    wsConnected,
  } = useVeto();

  const sessions = sessionManager.getSessions();
  const workspaceNodeCount = sessionManager.getWorkspaceNodeCount();

  // Session count badge color
  const sessionCount = sessions.length;

  return (
    <div className="flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {}} // Toggle handled by parent
            className="text-gray-500 hover:text-gray-200 transition-colors p-1 rounded hover:bg-gray-800"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-300">Sessions</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 font-mono">
            {sessionCount}
          </span>
        </div>
        {/* Connection indicator */}
        <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-vetoGreen-500' : 'bg-gray-600'}`} title={wsConnected ? 'Connected' : 'Offline'} />
      </div>

      {/* New Session Button */}
      <div className="p-3 border-b border-gray-800/50">
        <button
          onClick={() => createSession()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5
                     border border-dashed border-gray-700 rounded-lg
                     text-sm text-gray-500 hover:text-gray-200 hover:border-veto-500/40
                     hover:bg-veto-500/5 transition-all group"
        >
          <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200"
               fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 4v16m8-8H4" />
          </svg>
          New Session
        </button>
      </div>

      {/* Session List (C2) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {sessions.map((session) => {
          const isActive = session.id === currentSessionId;
          const timeStr = getRelativeTime(session.lastActivity);

          return (
            <div key={session.id} className="group relative">
              <button
                onClick={() => switchSession(session.id)}
                className={`
                  w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-150
                  ${isActive
                    ? 'bg-veto-600/15 border border-veto-500/25 text-gray-200 shadow-sm shadow-veto-900/20'
                    : 'text-gray-500 hover:bg-gray-800/80 hover:text-gray-300 border border-transparent'
                  }
                `}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">{session.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-veto-500" />
                    )}
                    <span className="text-[10px] text-gray-600 font-mono">
                      {session.messageCount}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-600">{timeStr}</span>
                  {session.messageCount > 0 && (
                    <span className="text-[10px] text-gray-700">
                      · {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </button>

              {/* Delete button (only show on hover, not for active if only one session) */}
              {sessions.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded
                             text-gray-600 hover:text-vetoRed-500 hover:bg-vetoRed-500/10
                             opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete session"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}

        {sessions.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-8 h-8 mx-auto text-gray-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-sm text-gray-600">No sessions yet</p>
            <p className="text-xs text-gray-700 mt-1">Click "New Session" to start</p>
          </div>
        )}
      </div>

      {/* Workspace Tree Info (C2) */}
      <div className="border-t border-gray-800 p-3 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500 font-medium">Workspace</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 font-mono">
            {workspaceNodeCount} nodes
          </span>
        </div>
        <div className="text-[10px] text-gray-700 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-vetoAmber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span>source/</span>
          </div>
          <div className="flex items-center gap-1.5 pl-4">
            <svg className="w-3 h-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>main.ts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>veto.policy.json</span>
          </div>
        </div>
      </div>

      {/* Veto Version */}
      <div className="border-t border-gray-800/50 px-4 py-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-700">Veto UI v1.0</span>
          <span className="text-[10px] text-gray-800">C1 + C2</span>
        </div>
      </div>
    </div>
  );
};

/**
 * SessionSidebar — wraps SessionSidebarInner in the proper layout container.
 */
const SessionSidebar: React.FC<SessionSidebarProps> = ({
  open,
  onToggle,
}) => {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-10 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-20
        w-72 bg-gray-900 border-r border-gray-800/80
        transform transition-transform duration-200 ease-in-out
        shadow-2xl shadow-black/30
        ${open ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
        <SessionSidebarInner />
      </aside>
    </>
  );
};

/**
 * Get a human-readable relative time string.
 */
function getRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default SessionSidebar;
