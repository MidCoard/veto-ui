import React from 'react';
import { useVeto } from '../context/VetoContext';
import { ConnectionState } from '../context/types';

/**
 * C1: Veto Status Bar — shows connection status, veto gateway state, and processing info.
 * Renders in the header area. Consumes VetoContext for reactive state.
 */
const VetoStatusBar: React.FC = () => {
  const { wsStatus, wsConnected, sessionManager, isProcessing } = useVeto();
  const currentNodeCount = sessionManager.getWorkspaceNodeCount();

  // Count messages across all sessions for a simple audit number
  const totalMessages = sessionManager.getSessions().reduce(
    (sum, s) => sum + s.messageCount, 0
  );

  return (
    <div className="flex items-center gap-3 md:gap-4 text-xs">
      {/* Veto Gateway Status */}
      <StatusBadge
        active={wsConnected}
        label="Veto"
        activeLabel="Active"
        inactiveLabel={getStatusLabel(wsStatus)}
        activeColor="text-vetoGreen-500"
        inactiveColor={getStatusColor(wsStatus)}
        dotColor={wsConnected ? 'bg-vetoGreen-500' : getDotColor(wsStatus)}
      />

      {/* Divider */}
      <div className="w-px h-4 bg-gray-800 hidden sm:block" />

      {/* Processing Indicator */}
      <div className="flex items-center gap-1.5 text-gray-500">
        <div className={`flex gap-0.5 ${isProcessing ? '' : 'opacity-30'}`}>
          <span className={`w-1 h-1 rounded-full bg-veto-500 ${isProcessing ? 'animate-bounce' : ''}`}
                style={isProcessing ? { animationDelay: '0ms' } : {}} />
          <span className={`w-1 h-1 rounded-full bg-veto-500 ${isProcessing ? 'animate-bounce' : ''}`}
                style={isProcessing ? { animationDelay: '150ms' } : {}} />
          <span className={`w-1 h-1 rounded-full bg-veto-500 ${isProcessing ? 'animate-bounce' : ''}`}
                style={isProcessing ? { animationDelay: '300ms' } : {}} />
        </div>
        <span className="hidden md:inline text-gray-600">
          {isProcessing ? 'Processing' : 'Idle'}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-gray-800 hidden sm:block" />

      {/* Connection Status */}
      <div className="flex items-center gap-1.5 text-gray-500">
        <div className={`w-1.5 h-1.5 rounded-full ${getDotColor(wsStatus)}`} />
        <span className={`hidden md:inline ${getStatusColor(wsStatus)}`}>
          {getStatusLabel(wsStatus)}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-gray-800 hidden sm:block" />

      {/* Audit / Stats */}
      <div className="flex items-center gap-1.5 text-gray-600">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <span className="hidden md:inline">Messages:</span>
        <span className="font-mono text-gray-500">{totalMessages}</span>
      </div>

      {/* Workspace nodes */}
      <div className="w-px h-4 bg-gray-800 hidden sm:block" />
      <div className="hidden md:flex items-center gap-1.5 text-gray-600">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span>{currentNodeCount}</span>
      </div>
    </div>
  );
};

/**
 * A single status badge indicator.
 */
const StatusBadge: React.FC<{
  active: boolean;
  label: string;
  activeLabel: string;
  inactiveLabel: string;
  activeColor: string;
  inactiveColor: string;
  dotColor: string;
}> = ({ active, label, activeLabel, inactiveLabel, activeColor, inactiveColor, dotColor }) => (
  <div className="flex items-center gap-1.5">
    <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
    <span className="text-gray-500">{label}</span>
    <span className={active ? activeColor : inactiveColor}>
      {active ? activeLabel : inactiveLabel}
    </span>
  </div>
);

/**
 * Get a human-readable label for a connection state.
 */
function getStatusLabel(state: ConnectionState): string {
  switch (state) {
    case 'connected': return 'Connected';
    case 'connecting': return 'Connecting...';
    case 'reconnecting': return 'Reconnecting...';
    case 'disconnected': return 'Disconnected';
    case 'error': return 'Error';
  }
}

/**
 * Get a Tailwind color for a connection state.
 */
function getStatusColor(state: ConnectionState): string {
  switch (state) {
    case 'connected': return 'text-vetoGreen-500';
    case 'connecting': return 'text-vetoAmber-500';
    case 'reconnecting': return 'text-vetoAmber-500';
    case 'disconnected': return 'text-gray-500';
    case 'error': return 'text-vetoRed-500';
  }
}

/**
 * Get a Tailwind dot color for a connection state.
 */
function getDotColor(state: ConnectionState): string {
  switch (state) {
    case 'connected': return 'bg-vetoGreen-500';
    case 'connecting': return 'bg-vetoAmber-500 animate-pulse';
    case 'reconnecting': return 'bg-vetoAmber-500 animate-pulse';
    case 'disconnected': return 'bg-gray-600';
    case 'error': return 'bg-vetoRed-500';
  }
}

export default VetoStatusBar;
