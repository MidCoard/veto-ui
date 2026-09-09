import React, { useEffect, useState } from 'react';
import { listSessionGroups } from '../../api/endpoints';
import type { SessionGroup } from '../../api/types';
import { useSessions } from '../../state/SessionContext';
import { useI18n } from '../../i18n/I18nContext';

const SessionGroups: React.FC<{ onSelectAgent?: (id: string | null) => void; onCount?: (count: number | null) => void }> = ({ onSelectAgent, onCount }) => {
  const { currentName } = useSessions();
  const { t } = useI18n();
  const [data, setData] = useState<{ session: string; groups: SessionGroup[] } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (currentName === null) return;
    const controller = new AbortController();
    let pending = false;
    const load = async (): Promise<void> => {
      if (pending) return;
      pending = true;
      try {
        const groups = await listSessionGroups(currentName, controller.signal);
        if (!controller.signal.aborted) { setData({ session: currentName, groups }); setError(false); }
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { pending = false; }
    };
    setError(false);
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [currentName]);
  useEffect(() => {
    onCount?.(currentName === null ? 0 : error || data?.session !== currentName ? null : data.groups.reduce((total, group) => total + group.nodes.length, 0));
  }, [currentName, error, data, onCount]);
  const groups = data?.session === currentName ? data.groups : [];
  const status = (value: string): string => {
    switch (value) {
      case 'COMPLETED': return t('groups.completed');
      case 'RUNNING': return t('groups.running');
      case 'PENDING': return t('groups.pending');
      case 'FAILED': return t('groups.failed');
      case 'STALE': return t('groups.stale');
      case 'REPORTED': return t('groups.reported');
      case 'DISBANDED': return t('groups.disbanded');
      case 'ACTIVE': return t('groups.active');
      default: return t('groups.unknown');
    }
  };
  return <div className="min-h-full p-3 space-y-3">
    {error && <p role="alert" className="text-xs text-verdict">{t('error.backendUnreachable')}</p>}
    {!error && groups.length === 0 && <p className="text-xs text-dim">{t('groups.empty')}</p>}
    {groups.map(group => <section key={group.id} className="rounded-xl border border-rule bg-panel overflow-hidden">
      <header className="border-b border-rule bg-raised/60 p-3">
        <div className="flex items-center justify-between gap-2 text-xs"><span className="font-medium text-paper">{t('groups.title')}</span><span className="text-dim">{status(group.state)}</span></div>
        <details className="mt-2 text-xs text-dim"><summary className="cursor-pointer">{t('groups.brief')}</summary><p className="mt-2 whitespace-pre-wrap break-words">{group.brief}</p></details>
        {group.historical && <p className="mt-2 text-[11px] text-amber-300">{t('groups.historical')}</p>}
        {!group.historical && !group.live && group.state === 'ACTIVE' && <p className="mt-2 text-[11px] text-amber-300">{t('groups.offline')}</p>}
      </header>
      <div className="p-2 space-y-2">{group.nodes.map(node => <article key={node.id} className="rounded-lg border border-rule bg-ink/40 p-3">
        <div className="flex items-start justify-between gap-2"><span className="break-all font-mono text-xs text-paper">{node.id}</span><span className={`shrink-0 text-[11px] ${node.state === 'COMPLETED' ? 'text-emerald-300' : node.state === 'FAILED' ? 'text-verdict' : 'text-dim'}`}>{status(node.state)}</span></div>
        <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-paper/80">{node.description}</p>
        <p className="mt-2 text-[11px] text-dim">{t('groups.dependencies')}: {node.dependencies.length ? node.dependencies.join(', ') : t('groups.independent')}</p>
        {node.mateId && <button type="button" onClick={() => onSelectAgent?.(node.mateId)} className="ui-button mt-2 text-xs text-purple-300 hover:underline">{t('groups.mate')} 路 {node.mateId.slice(0, 8)}</button>}
        {node.report && <details className="mt-2 text-xs"><summary className="cursor-pointer text-accent">{t('groups.report')}</summary><p className="mt-2 whitespace-pre-wrap break-words leading-5 text-paper/80">{node.report}</p></details>}
      </article>)}</div>
      {group.changes.length > 0 && <details className="border-t border-rule p-3 text-xs text-dim"><summary className="cursor-pointer">{t('groups.history')}</summary><ol className="mt-2 space-y-2">{group.changes.map((change, index) => <li key={index}><time>{new Date(change.at).toLocaleString()}</time><div>{status(change.state)} 路 {change.nodes.map(node => `${node.id}: ${status(node.state)}`).join(' / ')}</div></li>)}</ol></details>}
    </section>)}
  </div>;
};
export default SessionGroups;
