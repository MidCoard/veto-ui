import React, { useRef, useEffect, useState } from 'react';
import StreamingMarkdown from './components/StreamingMarkdown';
import HITLApprovalCard from './components/HITLApprovalCard';
import SessionSidebar from './components/SessionSidebar';
import VetoStatusBar from './components/VetoStatusBar';
import { VetoProvider, useVeto } from './context/VetoContext';

/**
 * C1: UI & Presentation Engine — Main Application Shell
 *
 * Orchestrates the complete layout:
 *   ┌──────────┬──────────────────────────────────────┐
 *   │          │           VetoStatusBar               │
 *   │ Session  │  ┌────────────────────────────────┐   │
 *   │ Sidebar  │  │     Message Stream (Chat)      │   │
 *   │  (C2)    │  │                                │   │
 *   │          │  │  ┌──────────────────────┐      │   │
 *   │          │  │  │ HITL Approval Card   │      │   │
 *   │          │  │  └──────────────────────┘      │   │
 *   │          │  └────────────────────────────────┘   │
 *   │          │           Chat Input Bar              │
 *   └──────────┴──────────────────────────────────────┘
 *
 * The HITL approval flow is the defining feature of Veto.
 */

const AppInner: React.FC = () => {
  const {
    messages,
    isProcessing,
    pendingApproval,
    sendMessage,
    handleApproval,
    createSession,
    sidebarOpen,
    toggleSidebar,
    wsConnected,
    sessionManager,
  } = useVeto();

  const mainRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = mainRef.current.scrollHeight;
    }
  }, [messages, pendingApproval]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;
    sendMessage(inputValue.trim());
    setInputValue('');
  };

  // Keyboard shortcut: Ctrl+Enter to send
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      onSubmit(e);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950 text-gray-100">
      {/* Session Sidebar */}
      <SessionSidebar
        open={sidebarOpen}
        onToggle={toggleSidebar}
        sessionManager={sessionManager}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header Bar */}
        <header className="h-14 border-b border-gray-800 flex items-center px-4 md:px-6 gap-3 shrink-0 bg-gray-950/80 backdrop-blur-sm z-10">
          <button
            onClick={toggleSidebar}
            className="text-gray-500 hover:text-gray-200 transition-colors p-1 rounded hover:bg-gray-800"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2.5">
            {/* Veto Logo */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-veto-600 to-veto-800 flex items-center justify-center shadow-lg shadow-veto-900/30">
              <svg className="w-4 h-4 text-veto-200" viewBox="0 0 100 100" fill="none">
                <path d="M50 5 L90 20 L90 50 C90 75 70 90 50 95 C30 90 10 75 10 50 L10 20 Z"
                  fill="currentColor" opacity="0.9" />
                <path d="M30 50 L45 65 L70 35" stroke="white" strokeWidth="8"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold text-gray-200 leading-tight">Project Veto</h1>
              <p className="text-[11px] text-gray-500 leading-tight">
                {wsConnected ? 'Connected to gateway' : 'Zero-Trust Agent Client'}
              </p>
            </div>
          </div>

          <div className="flex-1" />

          {/* Connection & Status */}
          <VetoStatusBar />
        </header>

        {/* Main Chat Area */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto"
        >
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-4">
            {/* Empty State */}
            {messages.length === 0 && !isProcessing && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-veto-600/20 to-veto-800/20
                              border border-veto-500/20 flex items-center justify-center">
                  <svg className="w-10 h-10 text-veto-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-300 mb-2">Veto Agent Ready</h2>
                <p className="text-gray-500 max-w-md text-sm leading-relaxed">
                  All outbound data passes through the local <strong className="text-veto-400">Veto Gateway</strong>.
                  Type a message to start. High-risk payloads will require your approval before transmission.
                </p>

                {/* Quick actions */}
                <div className="flex gap-3 mt-8">
                  {['Execute a shell command', 'Analyze a file', 'Call an API'].map((hint) => (
                    <button
                      key={hint}
                      onClick={() => sendMessage(hint)}
                      className="px-4 py-2 text-sm rounded-lg border border-gray-800
                                 text-gray-400 hover:text-gray-200 hover:border-veto-500/50
                                 hover:bg-veto-500/5 transition-all"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message Stream */}
            {messages.map((msg, idx) => (
              <MessageBubble key={msg.id || idx} message={msg} />
            ))}

            {/* Processing Indicator */}
            {isProcessing && !messages[messages.length - 1]?.isStreaming && (
              <div className="flex items-center gap-2.5 text-gray-500 px-2 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-veto-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-veto-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-veto-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-gray-500">Veto gateway processing...</span>
              </div>
            )}
          </div>
        </main>

        {/* HITL Approval Overlay (pops up when a payload needs approval) */}
        {pendingApproval && (
          <div className="border-t border-vetoRed-500/20 shrink-0 bg-gray-900/95 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto px-4 md:px-6 py-4">
              <HITLApprovalCard
                title={pendingApproval.title}
                description={pendingApproval.description}
                payload={pendingApproval.payload}
                riskLevel={pendingApproval.riskLevel}
                payloadLanguage={pendingApproval.payloadLanguage}
                onApprove={() => handleApproval(pendingApproval.id, true)}
                onReject={() => handleApproval(pendingApproval.id, false)}
              />
            </div>
          </div>
        )}

        {/* Chat Input */}
        <footer className="border-t border-gray-800 p-3 md:p-4 shrink-0 bg-gray-950/90 backdrop-blur-sm">
          <form onSubmit={onSubmit} className="max-w-4xl mx-auto">
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Type a message... (Ctrl+Enter to send)"
                  className="veto-input w-full pr-20"
                  disabled={isProcessing}
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 pointer-events-none hidden sm:block">
                  {inputValue.length > 0 ? `${inputValue.length} chars` : ''}
                </span>
              </div>
              <button
                type="submit"
                disabled={!inputValue.trim() || isProcessing}
                className="veto-button-primary flex items-center gap-2 px-5 py-2.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
            <div className="flex items-center gap-4 mt-1.5 px-1">
              <span className="text-[10px] text-gray-700">
                {wsConnected
                  ? '🟢 Connected to Veto Gateway'
                  : '🔴 Offline mode — simulation active'}
              </span>
              <button
                type="button"
                onClick={() => createSession()}
                className="text-[10px] text-gray-700 hover:text-gray-500 transition-colors"
              >
                + New session
              </button>
            </div>
          </form>
        </footer>
      </div>
    </div>
  );
};

/**
 * MessageBubble — renders a single message based on its type.
 */
const MessageBubble: React.FC<{ message: import('./context/types').Message }> = ({ message }) => {
  const { handleApproval } = useVeto();

  // HITL Approval Message
  if (message.type === 'hitl_approval') {
    return (
      <div className="flex justify-center my-4">
        <HITLApprovalCard
          title={String(message.metadata?.title ?? 'Approval Required')}
          description={String(message.metadata?.description ?? '')}
          payload={String(message.metadata?.payload ?? message.content ?? '')}
          riskLevel={(message.metadata?.risk_level as 'low' | 'medium' | 'high' | 'critical') ?? 'medium'}
          payloadLanguage={(message.metadata?.payloadLanguage as string) ?? 'json'}
          onApprove={() => handleApproval(message.id, true)}
          onReject={() => handleApproval(message.id, false)}
        />
      </div>
    );
  }

  // User messages — right-aligned
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] md:max-w-[70%]">
          <div className="bg-veto-600/15 border border-veto-500/20 rounded-2xl rounded-br-md px-4 py-3">
            <StreamingMarkdown content={message.content} />
          </div>
          <div className="text-[10px] text-gray-700 text-right mt-1 px-1">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    );
  }

  // System messages — centered
  if (message.role === 'system') {
    return (
      <div className="flex justify-center">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-2 text-sm text-gray-500 max-w-lg text-center">
          <StreamingMarkdown content={message.content} />
        </div>
      </div>
    );
  }

  // Error messages
  if (message.type === 'error') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] md:max-w-[70%]">
          <div className="bg-vetoRed-500/10 border border-vetoRed-500/30 rounded-2xl rounded-bl-md px-4 py-3">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-vetoRed-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <StreamingMarkdown content={message.content} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Assistant messages — left-aligned with Veto accent
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] md:max-w-[70%]">
        <div className="veto-card rounded-2xl rounded-bl-md">
          <div className="px-4 py-3">
            <StreamingMarkdown content={message.content} isStreaming={!!message.isStreaming} />
          </div>
        </div>
        <div className="text-[10px] text-gray-700 mt-1 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {message.metadata && typeof message.metadata.veto_action === 'string' && (
            <span className="ml-2">
              · Veto: <span className={
                message.metadata.veto_action === 'pass' ? 'text-vetoGreen-500' :
                message.metadata.veto_action === 'block' ? 'text-vetoRed-500' : 'text-vetoAmber-500'
              }>{message.metadata.veto_action}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Root App component — wraps everything in the VetoProvider
 */
const App: React.FC = () => {
  return (
    <VetoProvider>
      <AppInner />
    </VetoProvider>
  );
};

export default App;
