import React, { useState } from 'react';
import CodeHighlight from './CodeHighlight';

/**
 * C1: Human-in-the-Loop (HITL) Approval Card
 * Presents outbound payloads for user authorization before transmission.
 * Shows the sanitized payload (post-veto) for final human approval.
 * Contains zero routing or data-processing logic — pure presentation.
 */
interface HITLApprovalCardProps {
  title: string;
  description: string;
  payload: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  onApprove: () => void;
  onReject: () => void;
  payloadLanguage?: string;
}

const HITLApprovalCard: React.FC<HITLApprovalCardProps> = ({
  title,
  description,
  payload,
  riskLevel,
  onApprove,
  onReject,
  payloadLanguage = 'json',
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const riskColors = {
    low: { badge: 'veto-badge-pass', border: 'border-vetoGreen-500/30', bg: 'bg-vetoGreen-500/5' },
    medium: { badge: 'veto-badge-redact', border: 'border-vetoAmber-500/30', bg: 'bg-vetoAmber-500/5' },
    high: { badge: 'veto-badge-block', border: 'border-vetoRed-500/30', bg: 'bg-vetoRed-500/5' },
    critical: { badge: 'veto-badge-block', border: 'border-red-600/40', bg: 'bg-red-900/10' },
  };

  const colors = riskColors[riskLevel];

  const handleApprove = () => {
    setIsProcessing(true);
    onApprove();
  };

  const handleReject = () => {
    setIsProcessing(true);
    onReject();
  };

  return (
    <div className={`veto-card border-2 ${colors.border} ${colors.bg} max-w-2xl`}>
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-800">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${
            riskLevel === 'low' || riskLevel === 'medium'
              ? 'bg-vetoAmber-500/10'
              : 'bg-vetoRed-500/10'
          }`}>
            <svg className={`w-5 h-5 ${
              riskLevel === 'low' || riskLevel === 'medium'
                ? 'text-vetoAmber-500'
                : 'text-vetoRed-500'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-200">{title}</h3>
              <span className={colors.badge}>{riskLevel.toUpperCase()}</span>
            </div>
            <p className="text-sm text-gray-400 mt-1">{description}</p>
          </div>
        </div>
      </div>

      {/* Payload Preview */}
      <div className="p-4 border-b border-gray-800">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          <svg className={`w-4 h-4 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
               fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {expanded ? 'Hide' : 'Show'} sanitized payload ({payload.length} bytes)
        </button>

        {expanded && (
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-vetoGreen-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-xs text-vetoGreen-500">Veto Gateway: Redacted — safe to review</span>
            </div>
            <CodeHighlight code={payload} language={payloadLanguage} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 p-4">
        <button
          onClick={handleReject}
          disabled={isProcessing}
          className="veto-button px-6 py-2 border border-gray-700 rounded-lg
                     text-gray-300 hover:bg-gray-800 hover:text-red-400
                     disabled:opacity-50 transition-all"
        >
          Reject
        </button>
        <button
          onClick={handleApprove}
          disabled={isProcessing}
          className="veto-button-primary px-6"
        >
          {isProcessing ? 'Processing...' : 'Approve & Send'}
        </button>
      </div>
    </div>
  );
};

export default HITLApprovalCard;
