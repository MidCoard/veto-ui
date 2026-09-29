import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiRequest } from '../../api/client';
import { useI18n } from '../../i18n/I18nContext';
import BusyIndicator from '../BusyIndicator';

import { setPluginEnabled, type InstalledPlugin } from '../../api/plugins';

const buttonClass = 'rounded-md border border-rule px-3 py-1.5 text-sm text-paper hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-not-allowed';

export default function PluginsSection() {
  const { t } = useI18n();
  const [plugins, setPlugins] = useState<InstalledPlugin[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [changing, setChanging] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const message = useCallback((reason: unknown) => reason instanceof ApiError && reason.status === 403
    ? t('pluginManagement.denied') : reason instanceof ApiError ? reason.message : t('error.backendUnreachable'), [t]);

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    try {
      const result = await apiRequest<InstalledPlugin[]>('/api/plugins', { signal: controller.signal });
      if (!controller.signal.aborted) setPlugins(result);
    } catch (reason) {
      if (!controller.signal.aborted) setError(message(reason));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [message]);

  const changeState = useCallback(async (plugin: InstalledPlugin) => {
    setChanging(plugin.id);
    setError(null);
    setNotice(null);
    try {
      await setPluginEnabled(plugin.id, plugin.state !== 'ACTIVE');
      const result = await apiRequest<InstalledPlugin[]>('/api/plugins');
      if (mounted.current) {
        setPlugins(result);
        setNotice(t('pluginManagement.updated'));
      }
    } catch (reason) {
      if (mounted.current) setError(message(reason));
    } finally {
      if (mounted.current) setChanging(null);
    }
  }, [message, t]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; request.current?.abort(); };
  }, [refresh]);

  return <section className="space-y-4" aria-busy={busy}>
    <div className="flex flex-wrap items-start justify-end gap-3">
      <button type="button" className={buttonClass} disabled={busy || changing !== null} onClick={() => void refresh()}>
        {t('pluginManagement.refresh')}
      </button>
    </div>
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    {notice && <p role="status" className="text-sm text-dim">{notice}</p>}
    {busy && <BusyIndicator label={t('pluginManagement.loading')} />}
    {plugins?.length === 0 && <p className="text-sm text-dim">{t('pluginManagement.emptyList')}</p>}
    <ul className="space-y-3">
      {plugins?.map(plugin => <li key={plugin.id} className="rounded-md border border-rule bg-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium text-paper">{plugin.name || plugin.id}</h2>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-dim">
              <span className="break-all font-mono">{plugin.id}</span>
              <span className="font-mono">v{plugin.version}</span>
              <span>{t(plugin.active ? 'pluginManagement.available' : 'pluginManagement.failed')}</span>
            </p>
          </div>
          <button type="button" className={buttonClass} disabled={busy || changing !== null}
            onClick={() => void changeState(plugin)}>
            {changing === plugin.id ? t('pluginManagement.saving') : t(plugin.state === 'ACTIVE' ? 'pluginManagement.disable' : 'pluginManagement.enable')}
          </button>
        </div>
        <details className="mt-3 text-xs text-dim">
          <summary className="cursor-pointer rounded py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">{t('pluginManagement.details')} · {t('plugins.tools', { count: plugin.tools.length })}</summary>
          <dl className="mt-2 space-y-2">
            <div><dt>{t('pluginManagement.state')}</dt><dd className="font-mono text-paper">{plugin.state}</dd></div>
            {plugin.sha256 && <div><dt>{t('pluginManagement.digest')}</dt><dd className="break-all font-mono">{plugin.sha256}</dd></div>}
            <div><dt>{t('pluginManagement.hooks')}</dt><dd className="break-all font-mono text-paper">{plugin.hooks.join(', ') || '—'}</dd></div>
          </dl>
          {plugin.tools.length ? <ul className="mt-3 space-y-1">{plugin.tools.map(tool => <li className="break-all font-mono text-paper" key={tool}>{tool}</li>)}</ul> : <p className="mt-3">{t('pluginManagement.noTools')}</p>}
        </details>
      </li>)}
    </ul>
  </section>;
}
