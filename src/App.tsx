import React, { useState } from 'react';
import StreamingMarkdown from './components/StreamingMarkdown';
import HITLApprovalCard from './components/HITLApprovalCard';
import SessionSidebar from './components/SessionSidebar';
import VetoStatusBar from './components/VetoStatusBar';
import { SessionManager } from './context/SessionManager';
import { useSession } from './context/useSession';

/**
 * C1: UI & Presentation Engine — Main Application Shell
 * Orchestrates layout: sidebar (sessions), main chat area, HITL approval cards.
 * Contains zero routing or data-processing logic.
 */
const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sessionManager = new SessionManager();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950">
      {/* Session Sidebar (C2) */}
      <SessionSidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        sessionManager={sessionManager}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-gray-800 flex items-center px-6 gap-4 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-veto-500 rounded-full" />
            <h1 className="text-lg font-semibold text-gray-200">Project Veto</h1>
            <span className="text-xs text-gray-500">Zero-Trust Agent Client</span>
          </div>
          <div className="flex-1" />
          <VetoStatusBar />
        </header>

        {/* Main Chat / Streaming Area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <ChatArea sessionManager={sessionManager} />
        </main>

        {/* Input Area */}
        <footer className="border-t border-gray-800 p-4 shrink-0">
          <ChatInput sessionManager={sessionManager} />
        </footer>
      </div>
    </div>
  );
};

/**
 * ChatArea — renders the streaming conversation with code highlighting
 * and HITL approval cards where needed.
 */
const ChatArea: React.FC<{ sessionManager: SessionManager }> = ({ sessionManager }) => {
  const { messages } = useSession(sessionManager);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {messages.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-veto-600/20 border border-veto-500/20
                        flex items-center justify-center">
            <svg className="w-8 h-8 text-veto-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-300 mb-2">Veto Agent Ready</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Connect to the cloud backend to start working. All outbound data passes through the local Veto Gateway.
          </p>
        </div>
      )}

      {messages.map((msg, idx) => (
        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {msg.role === 'assistant' && msg.isStreaming ? (
            <StreamingMarkdown content={msg.content ?? ''} />
          ) : msg.role === 'assistant' && msg.type === 'hitl_approval' ? (
            <HITLApprovalCard
              title={String(msg.metadata?.title ?? 'Approval Required')}
              description={String(msg.metadata?.description ?? '')}
              payload={String(msg.metadata?.payload ?? '')}
              riskLevel={(msg.metadata?.riskLevel as 'low' | 'medium' | 'high' | 'critical') ?? 'medium'}
              onApprove={() => sessionManager.handleApproval(msg.id ?? 'unknown', true)}
              onReject={() => sessionManager.handleApproval(msg.id ?? 'unknown', false)}
            />
          ) : msg.role === 'assistant' ? (
            <div className="veto-card p-4 max-w-[80%]">
              <StreamingMarkdown content={msg.content ?? ''} />
            </div>
          ) : (
            <div className="bg-veto-600/10 border border-veto-500/20 rounded-xl p-4 max-w-[80%]">
              <StreamingMarkdown content={msg.content ?? ''} />
            </div>
          )}
        </div>
      ))}

      {/* Streaming dots when waiting */}
      {sessionManager.isProcessing() && (
        <div className="flex items-center gap-2 text-gray-500 px-2">
          <span className="streaming-dot">●</span>
          <span className="streaming-dot" style={{ animationDelay: '0.33s' }}>●</span>
          <span className="streaming-dot" style={{ animationDelay: '0.66s' }}>●</span>
          <span className="text-sm ml-2">Veto gateway processing...</span>
        </div>
      )}
    </div>
  );
};

/**
 * ChatInput — text input for sending messages to the agent
 */
const ChatInput: React.FC<{ sessionManager: SessionManager }> = ({ sessionManager }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sessionManager.sendMessage(input.trim());
    setInput('');
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-3">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type a message or task description..."
        className="veto-input flex-1"
        disabled={sessionManager.isProcessing()}
      />
      <button
        type="submit"
        disabled={!input.trim() || sessionManager.isProcessing()}
        className="veto-button-primary"
      >
        Send
      </button>
    </form>
  );
};

export default App;
