import BusyIndicator from './BusyIndicator';
import React, { useEffect, useMemo } from 'react';
import type { SessionRecord } from '../api/types';
import { useSessionResource } from '../state/useSessionResource';
import { tokenUsageFromHistory } from '../lib/tokenUsage';
import { useI18n } from '../i18n/I18nContext';
import { useSessions } from '../state/SessionContext';
import AgentCard from './AgentCard';

const NO_RECORDS: SessionRecord[] = [];

const SessionAgents: React.FC<{ onSelectAgent?: (id: string | null) => void; selectedAgent?: string | null; onCount?: (count: number | null) => void }> = ({ onSelectAgent, selectedAgent, onCount }) => {
  const { currentName, sessions, busStatus } = useSessions();
  const { t } = useI18n();
  const sessionId = sessions.find(session => session.name === currentName)?.id;
  const agentSnapshot = useSessionResource(currentName, 'agents', sessionId);
  const recordSnapshot = useSessionResource(currentName, 'records', sessionId);
  const agents = agentSnapshot.data;
  const records = recordSnapshot.data?.records ?? NO_RECORDS;
  const failed = agentSnapshot.error !== null || recordSnapshot.error !== null || (busStatus !== undefined && busStatus !== 'connected');
  useEffect(() => {
    onCount?.(currentName === null ? 0 : failed || agents === null ? null : agents.length);
  }, [currentName, failed, agents, onCount]);
  const usages = useMemo(() => {
    const byAgent = new Map<string, SessionRecord[]>();
    for (const record of records) {
      const group = byAgent.get(record.agentId) ?? [];
      group.push(record); byAgent.set(record.agentId, group);
    }
    return new Map([...byAgent].map(([id, turns]) => [id, tokenUsageFromHistory(turns.sort((a, b) => a.turnNumber - b.turnNumber)).total]));
  }, [records]);
  const totals = [...usages.values()].filter((value): value is number => value !== null);
  const total = totals.length === 0 ? null : totals.reduce((sum, value) => sum + value, 0);
  if (currentName === null) return null;
  const primaryAgentId = sessions.find((session) => session.name === currentName)?.primaryAgentId;
  const active = agents?.filter((agent) => agent.live && agent.state !== null && !['IDLE', 'TERMINATED'].includes(agent.state)).length ?? 0;

  return (
    <section className="agent-window" aria-label={t('agents.title')}>
      <header className="agent-window-header">
        <div className="flex items-center gap-2 text-paper">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="6" width="16" height="14" rx="4" /><path d="M12 2v4M8 11v3m8-3v3M9 17h6" /></svg>
          <h2 className="text-xs font-semibold tracking-wide">{t('agents.title')}</h2>
        </div>
        <p className="mt-2 font-mono text-[10px] text-dim">{agents !== null && !failed ? t('agents.count', { active, total: agents.length }) : ''}</p>
      </header>
      <p className="px-3 py-2 font-mono text-[11px] text-dim">{t('agents.totalTokens')}: {failed || total === null ? '—' : total.toLocaleString()}</p>
      <div className="agent-window-body" tabIndex={0} aria-label={t('agents.title')}>
      {failed && <p role="alert" className="mt-2 text-xs text-verdict">{t('agents.unavailable')}</p>}
      {agents === null ? <p className="mt-2 text-xs text-dim"><BusyIndicator label={t('app.loading')} /></p>
        : agents.length === 0 ? <p className="mt-2 text-xs text-dim">{t('agents.empty')}</p>
        : <ul className="flex flex-col gap-2.5" aria-label={t('agents.title')}>
          {[...agents].sort((a, b) => Number(b.live) - Number(a.live)).map((agent) => {
            return <AgentCard key={agent.id} agent={agent} primaryAgentId={primaryAgentId}
              parent={agents.find(candidate => candidate.id === agent.parentAgentId)}
              selected={selectedAgent == null ? agent.id === primaryAgentId : selectedAgent === agent.id}
              onSelect={onSelectAgent ? () => onSelectAgent(agent.id === primaryAgentId ? null : agent.id) : undefined}
              usedTokens={usages.get(agent.id) ?? null} />;
          })}
        </ul>}
      </div>
    </section>
  );
};

export default SessionAgents;
