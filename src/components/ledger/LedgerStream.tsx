import React, { useEffect, useRef } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { Translate } from '../../i18n/I18nContext';
import type { LedgerEntry } from '../../state/ledger';
import { useSessions } from '../../state/SessionContext';
import LedgerEntryView from './LedgerEntry';
import VetoPromptCard from './VetoPromptCard';

/**
 * LedgerStream — the center column. Auto-scrolls to the newest entry.
 * The empty ledger invites the first prompt. While the agent runs, a live
 * WorkingIndicator streams at the bottom (like Claude Code's activity line) —
 * the ledger itself, not the input field, shows the run is alive.
 */

/** Compact elapsed label: 75 → "1:15", 8 → "0:08". */
function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Derive the live activity label from the newest ledger entry. */
function activityLabel(last: LedgerEntry | undefined, t: Translate): string {
  if (last === undefined) return t('ledger.working');
  if (last.kind === 'tool_call' && last.toolName !== undefined) {
    return t('ledger.runningTool', { tool: last.toolName });
  }
  if (last.kind === 'thought') return t('ledger.thinking');
  return t('ledger.working');
}

/**
 * The live "agent is working" line. Rendered only while the run is in flight
 * and no veto is parked (a parked veto's own card is the indicator then).
 */
const WorkingIndicator: React.FC = () => {
  const { pending, elapsedSeconds, entries, vetoes } = useSessions();
  const { t } = useI18n();
  if (!pending || vetoes.length > 0) return null;
  const label = activityLabel(entries[entries.length - 1], t);
  return (
    <div className="ledger-enter flex gap-3 py-2 items-center" aria-live="polite">
      <span className="w-12 shrink-0" aria-hidden="true" />
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
      </span>
      <span className="font-mono text-[11px] tracking-wider text-accent">
        {label} · {formatElapsed(elapsedSeconds)}
      </span>
    </div>
  );
};

/** Empty state: the ledger's first line, waiting to be written. */
const EmptyLedger: React.FC<{ title: string; hint: string }> = ({ title, hint }) => (
  <div className="flex-1 flex items-center justify-center px-6">
    <div className="w-full max-w-sm">
      <div className="flex items-center gap-3 font-mono text-[11px] tracking-widest text-dim/60">
        <span>T-01</span>
        <span className="flex-1 border-t border-dashed border-rule" aria-hidden="true" />
      </div>
      <div className="py-6 text-center space-y-2">
        <p className="text-paper/85">{title}</p>
        <p className="text-dim text-sm leading-relaxed">{hint}</p>
      </div>
      <div className="border-t border-dashed border-rule" aria-hidden="true" />
    </div>
  </div>
);

const LedgerStream: React.FC = () => {
  const { currentName, entries, vetoes, resolveVeto, pending } = useSessions();
  const { t } = useI18n();
  const bottomRef = useRef<HTMLDivElement>(null);
  // The working indicator appears/disappears with the run state too — scroll on it.
  const showWorking = pending && vetoes.length === 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [entries.length, vetoes.length, showWorking]);

  if (currentName === null) {
    return (
      <EmptyLedger
        title={t('ledger.noSessionTitle')}
        hint={t('ledger.noSessionHint')}
      />
    );
  }

  if (entries.length === 0 && vetoes.length === 0) {
    return (
      <EmptyLedger
        title={t('ledger.emptyTitle')}
        hint={t('ledger.emptyHint')}
      />
    );
  }

  // A parked veto renders even on an empty ledger: the agent can intercept the
  // very first tool call before any entry lands.
  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4">
      <div className="max-w-3xl mx-auto">
        {entries.map((entry) => (
          <LedgerEntryView key={entry.id} entry={entry} />
        ))}
        {vetoes.map((veto) => (
          <VetoPromptCard
            key={veto.callId}
            veto={veto}
            onResolve={(option) => resolveVeto(veto.callId, option)}
          />
        ))}
        <WorkingIndicator />
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default LedgerStream;
