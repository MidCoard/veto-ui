import React from 'react';
import { SessionManager } from '../context/SessionManager';

/**
 * C1/C2: Session Sidebar — displays session history and workspace tree.
 * Integrated with C2 Memory & Context System for session management.
 */
interface SessionSidebarProps {
  open: boolean;
  onToggle: () => void;
  sessionManager: SessionManager;
}

const SessionSidebar: React.FC<SessionSidebarProps> = ({
  open,
  onToggle,
  sessionManager,
}) => {
  const sessions = sessionManager.getSessions();
  const currentSession = sessionManager.getCurrentSession();

  return (
    <>
      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-10 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-20
        w-72 bg-gray-900 border-r border-gray-800
        transform transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full lg:-translate-x-full'}
        flex flex-col
      `}>
        {/* Sidebar Header */}
        <div className="h-14 border-b border-gray-800 flex items-center px-4 gap-2 shrink-0">
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-300">Sessions</span>
          <span className="text-xs text-gray-500">({sessions.length})</span>
        </div>

        {/* New Session Button */}
        <div className="p-3 border-b border-gray-800">
          <button
            onClick={() => sessionManager.createSession()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2
                       border border-dashed border-gray-700 rounded-lg
                       text-sm text-gray-400 hover:text-gray-200 hover:border-gray-600
                       transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v16m8-8H4" />
            </svg>
            New Session
          </button>
        </div>

        {/* Session List (C2) */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => sessionManager.switchToSession(session.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                currentSession?.id === session.id
                  ? 'bg-veto-600/20 border border-veto-500/30 text-gray-200'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate max-w-[160px]">{session.name}</span>
                <span className="text-xs text-gray-600">
                  {session.messageCount} msgs
                </span>
              </div>
              <div className="text-xs text-gray-600 mt-0.5">
                {new Date(session.lastActivity).toLocaleTimeString()}
              </div>
            </button>
          ))}

          {sessions.length === 0 && (
            <div className="text-center py-8 text-gray-600 text-sm">
              <p>No sessions yet</p>
              <p className="text-xs mt-1">Start by sending a message</p>
            </div>
          )}
        </div>

        {/* Workspace Info (C2) */}
        <div className="border-t border-gray-800 p-3 shrink-0">
          <div className="text-xs text-gray-500 flex items-center justify-between">
            <span>Workspace Tree</span>
            <span className="veto-badge-pass">{sessionManager.getWorkspaceNodeCount()} nodes</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default SessionSidebar;
