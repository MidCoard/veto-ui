import React, { useEffect, useState } from 'react';
import { listSessionAgents } from '../api/endpoints';
import type { SessionAgent } from '../api/types';
import { useI18n } from '../i18n/I18nContext';
import { useSessions } from '../state/SessionContext';
import { formatFullTimestamp, toDate } from '../lib/time';

function agentTone(agent: SessionAgent): string {
  if (!agent.live || agent.state === 'TERMINATED') return 'offline';
  if (agent.state === 'INTERCEPTED' || agent.state === 'PAUSED') return 'attention';
  if (agent.state === 'RUNNING' || agent.state === 'WAITING') return 'active';
  return 'idle';
}

const SessionAgents: React.FC = () => {
  const { currentName, sessions } = useSessions();
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<{ name: string; agents: SessionAgent[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSnapshot(null);
    setFailed(false);
    if (currentName === null) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async (): Promise<void> => {
      try {
        const agents = await listSessionAgents(currentName, controller.signal);
        if (!controller.signal.aborted) {
          setSnapshot({ name: currentName, agents });
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

  if (currentName === null) return null;
  const agents = snapshot?.name === currentName ? snapshot.agents : null;
  const primaryAgentId = sessions.find((session) => session.name === currentName)?.primaryAgentId;
  const active = agents?.filter((agent) => agent.live && agent.state !== null && !['IDLE', 'TERMINATED'].includes(agent.state)).length ?? 0;

  return (
    <section className="agent-window" aria-label={t('agents.title')}>
      <header className="agent-window-header">
        <div className="flex items-center gap-2 text-paper">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="6" width="16" height="14" rx="4" /><path d="M12 2v4M8 11v3m8-3v3M9 17h6" /></svg>
          <h2 className="text-xs font-semibold tracking-wide">{t('agents.title')}</h2>
        </div>
        <p className="mt-2 font-mono text-[10px] text-dim">{!failed && agents !== null ? t('agents.count', { active, total: agents.length }) : t('app.loading')}</p>
      </header>
      <div className="agent-window-body" tabIndex={0} aria-label={t('agents.title')}>
      {failed ? <p role="alert" className="mt-2 text-xs text-verdict">{t('agents.unavailable')}</p>
        : agents === null ? <p className="mt-2 text-xs text-dim">{t('app.loading')}</p>
        : agents.length === 0 ? <p className="mt-2 text-xs text-dim">{t('agents.empty')}</p>
        : <ul className="flex flex-col gap-2.5" aria-label={t('agents.title')}>
          {[...agents].sort((a, b) => Number(b.live) - Number(a.live)).map((agent) => {
            const parent = agents.find((candidate) => candidate.id === agent.parentAgentId);
            const identity = agent.id === primaryAgentId ? 'primary'
              : agent.parentAgentId !== null && agent.parentCallId !== null ? 'tool'
                : agent.role === 'MATE' ? 'mate' : 'other';
            const dormantPrimary = identity === 'primary' && !agent.live;
            return <li key={agent.id} className="agent-card" data-identity={identity} data-tone={agentTone(agent)}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="agent-avatar" aria-hidden="true">{agent.name.slice(0, 2).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-xs font-semibold text-paper" title={agent.name}>{agent.name}</h3>
                  <p className="agent-identity mt-1 text-[10px]">{t(`agents.identity.${identity}`)}{agent.role === 'LEADER' && ' · Leader'}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="agent-status"><span className="agent-status-light" aria-hidden="true" />{t(`agents.state.${dormantPrimary ? 'DORMANT' : agent.state ?? 'UNLOADED'}`)}</span>
                <span className="font-mono text-[10px] text-dim" title={agent.id}>{agent.id.slice(0, 8)}</span>
              </div>
              {dormantPrimary && <p className="mt-2 text-[10px] leading-relaxed text-dim">{t('agents.dormantHint')}</p>}
              {agent.parentAgentId !== null && <p className="text-dim mt-2 truncate text-[10px]" title={t('agents.childOf', { name: parent?.name ?? agent.parentAgentId })}>
                {t('agents.childOf', { name: parent?.name ?? agent.parentAgentId.slice(0, 8) })}
              </p>}
              <details className="agent-card-details">
                <summary className="cursor-pointer text-[10px] text-dim">{t('agents.details')}</summary>
              <dl className="mt-2 space-y-2 text-[10px] text-dim">
                {([['createdAt', agent.createdAt], ['startedAt', agent.startedAt], ['endedAt', agent.endedAt]] as const).map(([label, value]) => value && (
                  <div key={label} className="flex flex-wrap gap-x-2">
                    <dt>{t(`agents.${label}`)}</dt>
                    <dd><time dateTime={toDate(value)?.toISOString()}>{formatFullTimestamp(value)}</time></dd>
                  </div>
                ))}
              </dl>
              </details>
            </li>;
          })}
        </ul>}
      </div>
      <footer className="border-t border-rule px-3 py-2 text-[10px] text-dim">{t('agents.retained')}</footer>
    </section>
  );
};

export default SessionAgents;
