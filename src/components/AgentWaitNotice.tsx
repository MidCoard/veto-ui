import type { SessionAgent } from '../api/types';
import { useI18n } from '../i18n/I18nContext';
import { agentWait } from '../lib/agentWait';

export default function AgentWaitNotice({ agent, stale = false }: { agent?: SessionAgent; stale?: boolean }) {
  const { t } = useI18n();
  const wait = agentWait(agent);
  if (wait === null) return null;
  return <div role="status" className="mt-2 rounded border border-rule bg-raised px-3 py-2 text-xs leading-relaxed text-paper">
    <p className="font-medium">{stale && `${t('agents.wait.stale')} · `}{t(`agents.wait.${wait}`)}</p>
    <p className="mt-1 break-words text-dim">{t(`agents.waitHint.${wait}`)}</p>
  </div>;
}
