import type { PluginContextSnapshot } from '../api/types';
import { useI18n } from '../i18n/I18nContext';

/** Counts package identities in this agent's tool context, never server-wide installations. */
export default function PluginContextLine({ context, loading, failed, stale }: {
  context?: PluginContextSnapshot | null; loading: boolean; failed: boolean; stale: boolean;
}) {
  const { t, lang } = useI18n();
  if (!context) return <p role="status" aria-label={t('plugins.label')} className="mt-2 text-xs text-dim">
    {t(loading ? 'plugins.loading' : failed ? 'plugins.failed' : 'plugins.unavailable')}
  </p>;
  const toolCount = context.plugins.reduce((total, plugin) => total + plugin.tools.length, 0);
  return <details className="group mt-2 min-w-0 text-xs text-dim">
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 rounded py-1 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
      <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 3v4m6-4v4M6 7h12v4a6 6 0 0 1-12 0V7Zm6 10v4" /></svg>
      <span className="font-medium text-paper">{t('plugins.count', { count: context.plugins.length.toLocaleString(lang) })}</span>
      <span>· {t('plugins.tools', { count: toolCount.toLocaleString(lang) })}</span>
      <span>· {t(context.lastRequest ? 'plugins.lastRequest' : 'plugins.available')}</span>
      {(stale || failed) && <span>· {t('plugins.stale')}</span>}
      <svg aria-hidden="true" className="h-3 w-3 group-open:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="m3 4.5 3 3 3-3" /></svg>
    </summary>
    <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-rule bg-raised p-3">
      <p className="mb-2 leading-relaxed">{t('plugins.help')}</p>
      {context.plugins.length === 0 ? <p>{t('plugins.empty')}</p> : <ul className="space-y-3">
        {context.plugins.map(plugin => <li key={plugin.id} className="min-w-0">
          <div className="flex flex-wrap gap-x-2"><span className="break-all font-medium text-paper">{plugin.id}</span><span className="font-mono">v{plugin.version}</span></div>
          <ul className="mt-1 space-y-1">{plugin.tools.map(tool => <li key={tool} className="break-all font-mono text-[11px]">{tool}</li>)}</ul>
        </li>)}
      </ul>}
    </div>
  </details>;
}
