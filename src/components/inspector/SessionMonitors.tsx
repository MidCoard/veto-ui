import { useEffect, useState } from 'react';
import { formatFullTimestamp } from '../../lib/time';
import { apiRequest } from '../../api/client';
import { useSessions } from '../../state/SessionContext';
import { useI18n } from '../../i18n/I18nContext';

interface Monitor {
  id: string;
  agentId: string;
  kind: string;
  purpose: string;
  state: string;
  dueAt: string | number | null;
  pending: { id: string; content: string }[];
  delivered?: { id: string; content: string }[] | null;
}

export default function SessionMonitors({ onCount }: { onCount?: (count: number | null) => void }) {
  const { currentName } = useSessions();
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<{ session: string; items: Monitor[] } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (currentName === null) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const items = await apiRequest<Monitor[]>(`/api/sessions/${encodeURIComponent(currentName)}/monitors`, { signal: controller.signal });
        if (!controller.signal.aborted) { setSnapshot({ session: currentName, items }); setFailed(false); }
      } catch { if (!controller.signal.aborted) setFailed(true); }
      finally { if (!controller.signal.aborted) timer = setTimeout(() => void refresh(), 2000); }
    };
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [currentName]);
  useEffect(() => {
    onCount?.(currentName === null ? 0 : failed || snapshot?.session !== currentName ? null : snapshot.items.length);
  }, [currentName, failed, snapshot, onCount]);
  if (currentName === null) return null;
  const items = snapshot?.session === currentName ? snapshot.items : [];
  const label = (item: Monitor) => {
    if (item.state === 'INTERRUPTED') return t('monitors.interrupted');
    if (item.state === 'CANCELLED') return t('monitors.cancelled');
    if (item.state === 'PAUSED') return t('monitors.paused');
    if (item.pending.length > 0) return t('monitors.pending');
    if (item.state === 'COMPLETED') return t('monitors.delivered');
    return t('monitors.active');
  };
  return <div className="min-h-full p-3 space-y-2">
    {failed && <p role="alert" className="text-xs text-verdict">{t('monitors.error')}</p>}
    {!failed && items.length === 0 && <p className="text-xs text-dim">{t('monitors.empty')}</p>}
    {items.map(item => <article key={item.id} className="rounded-xl border border-rule bg-ink/40 p-3 text-xs">
      <div className="flex justify-between gap-2 text-dim"><span>{item.kind === 'TIME_ONCE' ? t('monitors.time') : item.kind === 'PROCESS_EVENT' ? t('inspector.bgTasks') : t('monitors.group')}</span><span>{label(item)}</span></div>
      <p className="mt-2 text-paper whitespace-pre-wrap break-words">{item.kind === 'RESOURCE_EVENT' ? t('monitors.groupPurpose') : item.purpose}</p>
      {item.dueAt && <time className="mt-2 block text-dim">{formatFullTimestamp(item.dueAt)}</time>}
      <details className="mt-2 text-dim"><summary className="cursor-pointer">{t('monitors.details')}</summary>
        <p className="mt-2 break-all">Agent: {item.agentId}</p>
        {(item.delivered ?? []).map(event => <p key={event.id} className="mt-2 whitespace-pre-wrap break-words"><span className="block text-paper">{t('monitors.delivered')}</span>{event.content}</p>)}
        {item.pending.map(event => <p key={event.id} className="mt-2 whitespace-pre-wrap break-words">{event.content}</p>)}
      </details>
    </article>)}
  </div>;
}
