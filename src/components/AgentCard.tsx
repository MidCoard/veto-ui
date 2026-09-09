import type { SessionAgent } from '../api/types';
import { useI18n } from '../i18n/I18nContext';
import { formatFullTimestamp, toDate } from '../lib/time';

function agentTone(agent: SessionAgent): string {
  if (!agent.live || agent.state === 'TERMINATED') return 'offline';
  if (agent.state === 'INTERCEPTED' || agent.state === 'PAUSED') return 'attention';
  if (agent.state === 'RUNNING' || agent.state === 'WAITING') return 'active';
  return 'idle';
}

export default function AgentCard({ agent, primaryAgentId, parent, selected, onSelect, usedTokens, ariaLabel }: {
  agent: SessionAgent; primaryAgentId?: string | null; parent?: SessionAgent;
  selected: boolean; onSelect?: () => void; usedTokens: number | null; ariaLabel?: string;
}) {
  const { t } = useI18n();
  const identity = agent.id === primaryAgentId ? 'primary'
    : agent.parentAgentId !== null && agent.parentCallId !== null ? 'tool'
      : agent.role === 'MATE' ? 'mate' : 'other';
  const dormantPrimary = identity === 'primary' && !agent.live;
  return <li className="agent-card" data-selected={Boolean(onSelect && selected)} data-identity={identity} data-tone={agentTone(agent)}>
              <button type="button" disabled={!onSelect} aria-label={ariaLabel ?? `${t('conversation.viewAgent')}: ${agent.name}`} aria-pressed={onSelect ? selected : undefined} onClick={onSelect} className="agent-card-select block w-full p-3 text-left disabled:cursor-default">
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
              {agent.role === 'MATE' && agent.responsibility && <p className="mt-2 text-[11px] leading-relaxed text-dim line-clamp-3" title={agent.responsibility}>{agent.responsibility}</p>}
              {dormantPrimary && <p className="mt-2 text-[10px] leading-relaxed text-dim">{t('agents.dormantHint')}</p>}
              {agent.parentAgentId !== null && <p className="text-dim mt-2 truncate text-[10px]" title={t('agents.childOf', { name: parent?.name ?? agent.parentAgentId })}>
                {t('agents.childOf', { name: parent?.name ?? agent.parentAgentId.slice(0, 8) })}
              </p>}
              <p className="mt-3 border-t border-rule/50 pt-2 font-mono text-[11px] tabular-nums text-dim">{t('status.tokensUsed')}: {usedTokens?.toLocaleString() ?? '—'}</p>
              </button>
              <details className="agent-card-details">
                <summary className="cursor-pointer px-3 py-2.5 text-[10px] text-dim hover:bg-paper/5">{t('agents.details')}</summary>
              <dl className="space-y-2 px-3 pb-3 text-[10px] text-dim">
                {([['createdAt', agent.createdAt], ['startedAt', agent.startedAt], ['endedAt', agent.endedAt]] as const).map(([label, value]) => value && (
                  <div key={label} className="flex flex-wrap gap-x-2">
                    <dt>{t(`agents.${label}`)}</dt>
                    <dd><time dateTime={toDate(value)?.toISOString()}>{formatFullTimestamp(value)}</time></dd>
                  </div>
                ))}
              </dl>
              </details>
            </li>;
}
