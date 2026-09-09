import BusyIndicator from './BusyIndicator';
import React, { useEffect, useState } from 'react';
import { listSessionAgents, getSessionRecords } from '../api/endpoints';
import type { SessionAgent, SessionRecord } from '../api/types';
import { tokenUsageFromHistory } from '../lib/tokenUsage';
import { useI18n } from '../i18n/I18nContext';
import { useSessions } from '../state/SessionContext';
import AgentCard from './AgentCard';

const SessionAgents: React.FC<{ onSelectAgent?: (id: string | null) => void; selectedAgent?: string | null; onCount?: (count: number | null) => void }> = ({ onSelectAgent, selectedAgent, onCount }) => {
  const { currentName, sessions } = useSessions();
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<{ name: string; agents: SessionAgent[]; records: SessionRecord[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSnapshot(null);
    setFailed(false);
    if (currentName === null) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async (): Promise<void> => {
      try {
        const [agents, records] = await Promise.all([listSessionAgents(currentName, controller.signal), getSessionRecords(currentName, controller.signal)]);
        if (!controller.signal.aborted) {
          setSnapshot({ name: currentName, agents, records: records.records });
          setFailed(false);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(() => void refresh(), 1000);
      }
    };
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [currentName]);

  useEffect(() => {
    onCount?.(currentName === null ? 0 : failed || snapshot?.name !== currentName ? null : snapshot.agents.length);
  }, [currentName, failed, snapshot, onCount]);

  if (currentName === null) return null;
  const agents = snapshot?.name === currentName ? snapshot.agents : null;
  const records = snapshot?.name === currentName ? snapshot.records : [];
  const agentUsage = (id: string) => tokenUsageFromHistory(records.filter(record => record.agentId === id).sort((a, b) => a.turnNumber - b.turnNumber));
  const totals = [...new Set(records.map(record => record.agentId))].map(id => agentUsage(id).total).filter((value): value is number => value !== null);
  const total = totals.length === 0 ? null : totals.reduce((sum, value) => sum + value, 0);
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
      {failed ? <p role="alert" className="mt-2 text-xs text-verdict">{t('agents.unavailable')}</p>
        : agents === null ? <p className="mt-2 text-xs text-dim"><BusyIndicator label={t('app.loading')} /></p>
        : agents.length === 0 ? <p className="mt-2 text-xs text-dim">{t('agents.empty')}</p>
        : <ul className="flex flex-col gap-2.5" aria-label={t('agents.title')}>
          {[...agents].sort((a, b) => Number(b.live) - Number(a.live)).map((agent) => {
            return <AgentCard key={agent.id} agent={agent} primaryAgentId={primaryAgentId}
              parent={agents.find(candidate => candidate.id === agent.parentAgentId)}
              selected={selectedAgent == null ? agent.id === primaryAgentId : selectedAgent === agent.id}
              onSelect={onSelectAgent ? () => onSelectAgent(agent.id === primaryAgentId ? null : agent.id) : undefined}
              usedTokens={agentUsage(agent.id).total} />;
          })}
        </ul>}
      </div>
    </section>
  );
};

export default SessionAgents;
