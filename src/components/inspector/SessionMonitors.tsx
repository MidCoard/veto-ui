import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { sessionResources } from '../../state/sessionResources';
import { formatFullTimestamp } from '../../lib/time';
import { useSessionResource } from '../../state/useSessionResource';
import type { SessionMonitor as Monitor } from '../../state/sessionResources';
import { useSessions } from '../../state/SessionContext';
import { useI18n } from '../../i18n/I18nContext';

export default function SessionMonitors({ onCount }: { onCount?: (count: number | null) => void }) {
  const { currentName, sessions, busStatus } = useSessions();
  const { t } = useI18n();
  const [working, setWorking] = useState<string | null>(null);
  const [controlError, setControlError] = useState<{ session: string; id: string } | null>(null);
  const snapshot = useSessionResource(currentName, 'monitors', sessions?.find(session => session.name === currentName)?.id);
  const failed = snapshot.error !== null || (busStatus !== undefined && busStatus !== 'connected');
  useEffect(() => {
    onCount?.(currentName === null ? 0 : failed || snapshot.data === null ? null : snapshot.data.length);
  }, [currentName, failed, snapshot.data, onCount]);
  if (currentName === null) return null;
  const items = snapshot.data ?? [];
  const control = async (item: Monitor, operation: 'pause' | 'resume' | 'cancel') => {
    if (working !== null || currentName === null) return;
    const name = currentName;
    const sessionId = sessions?.find(session => session.name === name)?.id;
    setWorking(item.id);
    setControlError(null);
    try {
      await apiRequest(`/api/sessions/${encodeURIComponent(name)}/monitors/${encodeURIComponent(item.id)}/${operation}`, { method: 'POST' });
      sessionResources(name, sessionId).monitors.invalidate();
    } catch {
      setControlError({ session: name, id: item.id });
      sessionResources(name, sessionId).monitors.invalidate();
    } finally { setWorking(null); }
  };
  const label = (item: Monitor) => {
    if (item.state === 'INTERRUPTED') return t('monitors.interrupted');
    if (item.state === 'CANCELLED') return t('monitors.cancelled');
    if (item.state === 'PAUSED') return t('monitors.paused');
    if (item.pending.length > 0) return t('monitors.pending');
    if (item.state === 'COMPLETED') return t('monitors.triggered');
    return t('monitors.active');
  };
  const canControl = (item: Monitor) => item.kind === 'TIME_ONCE' && (
    item.state === 'ACTIVE' || item.state === 'PAUSED'
    || (item.state === 'COMPLETED' && (item.pending.length > 0 || (item.delivered ?? []).some(event =>
      !['COMPLETED', 'FAILED', 'CANCELLED', 'INTERRUPTED'].includes(item.activations?.[event.id]?.state ?? '')
    )))
  );
  return <div className="min-h-full p-3 space-y-2">
    {failed && <p role="alert" className="text-xs text-verdict">{t('monitors.error')}</p>}
    {!failed && items.length === 0 && <p className="text-xs text-dim">{t('monitors.empty')}</p>}
    {items.map(item => <article key={item.id} className="rounded-xl border border-rule bg-ink/40 p-3 text-xs">
      <div className="flex flex-wrap justify-between gap-2 text-dim"><span>{item.kind === 'TIME_ONCE' ? t('monitors.time') : item.kind === 'PROCESS_EVENT' ? t('inspector.bgTasks') : t('monitors.group')}</span><span>{(failed || snapshot.stale) && `${t('agents.wait.stale')} · `}{label(item)}</span></div>
      <p className="mt-2 text-paper whitespace-pre-wrap break-words">{item.kind === 'RESOURCE_EVENT' ? t('monitors.groupPurpose') : item.purpose}</p>
      {item.dueAt && <time className="mt-2 block text-dim">{formatFullTimestamp(item.dueAt)}</time>}
      {canControl(item) && <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={working !== null || failed || snapshot.stale} onClick={() => void control(item, item.state === 'PAUSED' ? 'resume' : 'pause')} className="ui-button rounded border border-rule px-2 py-1.5 disabled:opacity-50">{t(item.state === 'PAUSED' ? 'monitors.resume' : 'monitors.pause')}</button>
          <button type="button" disabled={working !== null || failed || snapshot.stale} onClick={() => void control(item, 'cancel')} className="ui-button rounded border border-rule px-2 py-1.5 disabled:opacity-50">{t('monitors.cancel')}</button>
        </div>
        <p className="text-dim">{working === item.id ? t('monitors.updating') : t('monitors.controlHint')}</p>
      </div>}
      {controlError?.session === currentName && controlError.id === item.id && <p role="alert" className="mt-2 text-verdict">{t('monitors.controlError')}</p>}
      <details className="mt-2 text-dim"><summary className="cursor-pointer">{t('monitors.details')}</summary>
        <p className="mt-2 break-all">Agent: {item.agentId}</p>
        {(item.delivered ?? []).map(event => {
          const state = item.activations?.[event.id]?.state;
          const known = state === 'APPENDED' || state === 'RUNNING' || state === 'COMPLETED' || state === 'FAILED' || state === 'CANCELLED' || state === 'INTERRUPTED';
          return <div key={event.id} className="mt-2 whitespace-pre-wrap break-words">
            <p className={state === 'FAILED' || state === 'CANCELLED' || state === 'INTERRUPTED' ? 'text-verdict' : 'text-paper'}>{t(`monitors.activation.${known ? state : 'UNKNOWN'}`)}</p>
            {state === 'INTERRUPTED' && <p className="mt-1">{t('monitors.activation.interruptedHint')}</p>}
            <p className="mt-1">{event.content}</p>
          </div>;
        })}
        {item.pending.map(event => <p key={event.id} className="mt-2 whitespace-pre-wrap break-words">{event.content}</p>)}
      </details>
    </article>)}
  </div>;
}
