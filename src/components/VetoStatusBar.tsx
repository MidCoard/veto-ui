import React from 'react';

/**
 * C1: Veto Status Bar — shows connection status, veto gateway state, and audit count.
 * A compact indicator rendered in the header area.
 */
const VetoStatusBar: React.FC = () => {
  // In production, these would come from a connection service
  const vetoEnabled = true;
  const redactionCount = 0;

  return (
    <div className="flex items-center gap-4 text-xs">
      {/* Veto Gateway Status */}
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${
          vetoEnabled ? 'bg-vetoGreen-500' : 'bg-vetoRed-500'
        }`} />
        <span className="text-gray-400">Veto</span>
        <span className={vetoEnabled ? 'text-vetoGreen-500' : 'text-vetoRed-500'}>
          {vetoEnabled ? 'Active' : 'Disabled'}
        </span>
      </div>

      {/* Connection Status — always disconnected for now */}
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
        <span className="text-gray-400">Disconnected</span>
      </div>

      {/* Redaction Count */}
      <div className="flex items-center gap-1.5 text-gray-500">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <span>{redactionCount} redacted</span>
      </div>
    </div>
  );
};

export default VetoStatusBar;
