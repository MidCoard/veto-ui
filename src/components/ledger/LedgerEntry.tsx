import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { turnLabel } from '../../state/ledger';
import type { LedgerEntry as LedgerEntryModel } from '../../state/ledger';
import StreamingMarkdown from '../StreamingMarkdown';
import {
  FileToolStatusChip,
  ToolCallRow,
  ToolResultBody,
} from './ToolCards';

/**
 * LedgerEntry — one numbered line in the audit ledger.
 * Turn labels (T-01…) are the absolute backend turnNumbers; entries without a
 * persisted turn yet (live bus frames) show "…" instead of a fake number.
 * Thoughts and tool results are dimmed/collapsible; pass and verdict colors
 * appear only on success/fail indicators.
 */

interface LedgerEntryProps {
  entry: LedgerEntryModel;
}

/** Absolute T-nn for persisted turns; "…" while an entry has no turn yet. */
function entryTag(entry: LedgerEntryModel): string {
  return entry.seq > 0 ? turnLabel(entry.seq) : '…';
}

const Chevron: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const TurnTag: React.FC<{ label: string; className?: string }> = ({ label, className = '' }) => (
  <span className={`font-mono text-[11px] shrink-0 w-12 pt-0.5 text-right select-none ${className}`}>
    {label}
  </span>
);

const LedgerEntry: React.FC<LedgerEntryProps> = ({ entry }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(entry.kind !== 'thought' && entry.kind !== 'tool_result');

  if (entry.kind === 'user') {
    return (
      <div className="ledger-enter flex gap-3 py-3">
        <TurnTag label={t('entry.tagYou')} className="text-dim" />
        <p className="text-paper whitespace-pre-wrap break-words min-w-0">{entry.text}</p>
      </div>
    );
  }

  if (entry.kind === 'thought') {
    return (
      <div className="ledger-enter flex gap-3 py-2">
        <TurnTag label={entryTag(entry)} className="text-dim/60" />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex items-center gap-1.5 text-xs text-dim hover:text-paper"
          >
            <Chevron open={open} />
            <span className="font-mono uppercase tracking-wider">{t('entry.thought')}</span>
            {entry.live === true && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
          </button>
          {open && (
            <p className="mt-1 text-sm text-dim italic whitespace-pre-wrap break-words">
              {entry.text}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (entry.kind === 'tool_call') {
    return (
      <ToolCallRow
        tag={<TurnTag label={entryTag(entry)} className="text-accent/70" />}
        toolName={entry.toolName ?? entry.text}
        args={entry.args}
      />
    );
  }

  if (entry.kind === 'tool_result') {
    // think's result is always empty — the call row already says it all.
    if (entry.toolName === 'think') return null;
    const succeeded = entry.success !== false;
    const isFileTool =
      entry.toolName === 'write_to_file' || entry.toolName === 'replace_file_content';
    // File-tool results are a one-line status — render the chip directly,
    // no collapse toggle.
    if (isFileTool) {
      return (
        <div className="ledger-enter flex gap-3 py-2">
          <TurnTag label={turnLabel(entry.seq)} className="text-dim/60" />
          <div className="min-w-0 flex-1">
            <FileToolStatusChip text={entry.text} />
          </div>
        </div>
      );
    }
    return (
      <div className="ledger-enter flex gap-3 py-2">
        <TurnTag label={turnLabel(entry.seq)} className="text-dim/60" />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex items-center gap-1.5 text-xs text-dim hover:text-paper"
          >
            <Chevron open={open} />
            <span className={`w-1.5 h-1.5 rounded-full ${succeeded ? 'bg-pass' : 'bg-verdict'}`} />
            <span className="font-mono uppercase tracking-wider">
              {succeeded ? t('entry.resultOk') : t('entry.resultFailed')}
            </span>
          </button>
          {open && (
            <div className="mt-1">
              <ToolResultBody toolName={entry.toolName} text={entry.text} />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (entry.kind === 'error') {
    return (
      <div className="ledger-enter flex gap-3 py-3">
        <TurnTag label={t('entry.tagErr')} className="text-verdict" />
        <p className="text-sm text-verdict border border-verdict/40 rounded-md px-3 py-2 min-w-0 break-words">
          {entry.text}
        </p>
      </div>
    );
  }

  // message
  return (
    <div className="ledger-enter flex gap-3 py-3">
      <TurnTag label={entryTag(entry)} className="text-accent" />
      <div className="min-w-0 flex-1">
        <StreamingMarkdown content={entry.text} isStreaming={entry.live === true} />
        {entry.success === false && (
          <p className="mt-2 text-xs text-verdict">{t('entry.runFailed')}</p>
        )}
      </div>
    </div>
  );
};

export default LedgerEntry;
