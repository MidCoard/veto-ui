import BusyIndicator from './BusyIndicator';
import { useEffect, useMemo, useState } from 'react';
import { getSessionRecords, listSessionAgents } from '../api/endpoints';
import type { SessionAgent, SessionRecordsView } from '../api/types';
import { useSessions } from '../state/SessionContext';
import { combineToolEntries, entriesFromHistory } from '../state/ledger';
import { useI18n } from '../i18n/I18nContext';
import LedgerStream from './ledger/LedgerStream';
import ConversationTimeline from './ledger/ConversationTimeline';
import Composer from './Composer';
import AgentComposer from './AgentComposer';
import TokenUsageLine from './TokenUsageLine';
import { tokenUsageFromHistory } from '../lib/tokenUsage';

export default function ConversationPane({ selectedAgent, inspectorOpen = false, onToggleInspector }: {
  selectedAgent: string | null;
  inspectorOpen?: boolean;
  onToggleInspector?: () => void;
}) {
  const { currentName, sessions, pending } = useSessions();
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<{ name: string; records: SessionRecordsView; agents: SessionAgent[] } | null>(null);
  const [error, setError] = useState(false);
  const [limit, setLimit] = useState(40);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { setLimit(40); }, [currentName, selectedAgent]);

  useEffect(() => {
    if (currentName === null) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const [records, agents] = await Promise.all([getSessionRecords(currentName, controller.signal), listSessionAgents(currentName, controller.signal)]);
        if (!controller.signal.aborted) { setSnapshot({ name: currentName, records, agents }); setError(false); }
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { if (!controller.signal.aborted && (pending || selectedAgent !== null)) timer = setTimeout(() => void load(), 2000); }
    };
    setError(false);
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [currentName, pending, selectedAgent, refresh]);

  const data = snapshot?.name === currentName ? snapshot : null;
  const primaryId = sessions.find((session) => session.name === currentName)?.primaryAgentId;
  const agentId = selectedAgent ?? primaryId;
  const isPrimary = selectedAgent === null || selectedAgent === primaryId;
  const agents = useMemo(() => {
    const result = new Map((data?.agents ?? []).map((agent) => [agent.id, agent.name]));
    for (const record of data?.records.records ?? []) if (!result.has(record.agentId)) result.set(record.agentId, record.agentId.slice(0, 8));
    return [...result];
  }, [data]);
  const records = useMemo(() => (data?.records.records ?? []).filter((record) => record.agentId === agentId), [data, agentId]);
  const entries = useMemo(() => combineToolEntries(entriesFromHistory(records.filter(record => record.active))), [records]);
  const nextHiddenTurn = entries.length > limit ? Number(entries[limit].id.slice(2)) : Infinity;
  const timelineRecords = records.filter(record => record.turnNumber < nextHiddenTurn);
  const selectedMetadata = data?.agents.find((agent) => agent.id === agentId);
  const agentRunning = selectedMetadata?.state === 'RUNNING';
  const canInteract = selectedMetadata?.live === true && selectedMetadata.userInteractionEnabled === true && selectedMetadata.state !== 'TERMINATED';

  return <>
    {currentName !== null && <header className="shrink-0 border-b border-rule bg-panel px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-paper">{isPrimary ? t('agents.identity.primary') : agents.find(([id]) => id === agentId)?.[1] ?? agentId}</span>
        {onToggleInspector && <button type="button" onClick={onToggleInspector} aria-label={t('status.toggleInspector')} title={t('status.toggleInspector')} aria-expanded={inspectorOpen} aria-controls="inspector" className="ui-button ml-auto shrink-0 rounded-md p-1.5 text-dim hover:bg-raised hover:text-paper">
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></svg>
        </button>}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-verdict">{t('records.loadFailed')}</p>}

    </header>}
    {isPrimary ? <><LedgerStream key={currentName} records={records} /><Composer /></> : <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6" key={`${currentName}-${agentId}`}>
        <div className="w-full min-w-0">
          {data === null ? <p className="text-sm text-dim">{error ? t('records.loadFailed') : <BusyIndicator label={t('records.loading')} />}</p> : entries.length === 0 && !records.some(record => !record.active && record.rewoundByTurnNumber > 0) ? <p className="text-sm text-dim">{t('records.agentEmpty')}</p> : <ConversationTimeline entries={entries.slice(0, limit)} records={timelineRecords} running={agentRunning} />}
          {entries.length > limit && <button type="button" onClick={() => setLimit((count) => count + 40)} className="ui-button mt-4 rounded border border-rule px-3 py-2 text-xs">{t('records.loadMore', { count: entries.length - limit })}</button>}
        </div>
      </div>
      {canInteract && currentName !== null && agentId ? <AgentComposer key={`${currentName}-${agentId}`} sessionName={currentName} agentId={agentId} onSubmitted={() => setRefresh(value => value + 1)} /> :
        <div className="border-t border-rule bg-panel px-4 py-3 text-xs text-dim"><p className="mb-2">{t('conversation.agentReadOnly')}</p></div>}
      <div className="bg-panel px-4 pb-3 text-xs text-dim"><TokenUsageLine usage={tokenUsageFromHistory(records)} /></div>
    </>}
  </>;
}
