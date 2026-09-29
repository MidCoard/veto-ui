import BusyIndicator from './BusyIndicator';
import React, { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../api/client';
import { getBackendPort } from '../config/backend';
import { listPatterns } from '../api/endpoints';
import type { AgentPatternEntity, SystemInfo } from '../api/types';
import { useI18n, type Translate } from '../i18n/I18nContext';
import { loadSystemInfo } from '../lib/systemInfo';
import { appendRoot, recentWorkspaces, removeRoot, splitRoots } from '../lib/workspaces';
import { useSessions } from '../state/SessionContext';
import { listPlugins, type InstalledPlugin } from '../api/plugins';
import WorkspacePicker from './WorkspacePicker';

function errorText(error: unknown, t: Translate): string {
  return error instanceof ApiError ? error.message : t('error.backendUnreachable', { port: getBackendPort() });
}

export default function NewSessionPage({ onCreated, onCancel }: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const { sessions, create } = useSessions();
  const { t } = useI18n();
  const [plugins, setPlugins] = useState<InstalledPlugin[] | null>(null);
  const [pluginIds, setPluginIds] = useState<string[]>([]);
  const [patterns, setPatterns] = useState<AgentPatternEntity[] | null>(null);
  const [pattern, setPattern] = useState('');
  const [name, setName] = useState('');
  const [roots, setRoots] = useState('');
  const [additionalToolResultInfo, setAdditionalToolResultInfo] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [browseOpen, setBrowseOpen] = useState(false);
  const recentRoots = useMemo(() => recentWorkspaces(sessions), [sessions]);

  useEffect(() => {
    let active = true;
    void loadSystemInfo().then((info) => { if (active) setSystemInfo(info); }).catch(() => undefined);
    void listPlugins().then(list => {
      if (active) { setPlugins(list); setPluginIds(list.filter(p => p.active).map(p => p.id)); }
    }).catch(error => { if (active) setFormError(errorText(error, t)); });
    void listPatterns().then((list) => {
      if (!active) return;
      setPatterns(list);
      setPattern(list[0]?.name ?? '');
    }).catch((error) => { if (active) setFormError(errorText(error, t)); });
    return () => { active = false; };
  }, [t]);

  /** Append a picked root to the roots input (comma-joined, deduplicated). */
  const addRoot = (root: string): void => {
    setRoots((current) => appendRoot(current, root));
  };

  const dropRoot = (root: string): void => {
    setRoots((current) => removeRoot(current, root));
  };

  const rootChips = splitRoots(roots);

  const handleCreate = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (submitting || pattern === '' || plugins === null) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await create(
        pattern,
        name.trim() === '' ? undefined : name.trim(),
        roots.trim(),
        additionalToolResultInfo ? 'DETAILED' : 'BASIC',
        pluginIds,
      );
      onCreated();
      setName('');
      setRoots('');
      setAdditionalToolResultInfo(false);
    } catch (error) {
      setFormError(errorText(error, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
      <div className="mx-auto w-full max-w-2xl">
        <form
          noValidate
          onSubmit={(event) => void handleCreate(event)}
          aria-label={t('rail.newSession')}
          className="space-y-5 rounded-xl border border-rule bg-panel p-5"
        >
          <header className="border-b border-rule pb-4">
            <h1 className="font-display text-lg font-semibold text-paper">{t('rail.newSession')}</h1>
            <p className="mt-1 text-xs text-dim">{t('rail.newSessionDescription')}</p>
          </header>
          <div className="grid gap-5 min-[1400px]:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="session-pattern" className="block text-xs text-dim">
                {t('rail.pattern')}
              </label>
              <select
                id="session-pattern"
                value={pattern}
                onChange={(event) => setPattern(event.target.value)}
                className="ui-control w-full bg-raised border border-rule rounded-md px-3 py-2.5 text-sm text-paper focus:outline-none focus:border-dim"
              >
                {patterns === null ? (
                  <option value="">{t('rail.loadingPatterns')}</option>
                ) : patterns.length === 0 ? (
                  <option value="">{t('rail.noPatterns')}</option>
                ) : (
                  patterns.map((candidate) => (
                    <option key={candidate.id} value={candidate.name}>
                      {candidate.name} ({candidate.tier})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="session-name" className="block text-xs text-dim">
                {t('rail.name')} <span className="text-dim/70">{t('rail.optional')}</span>
              </label>
              <input
                id="session-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('rail.namePlaceholder')}
                className="ui-control w-full bg-raised border border-rule rounded-md px-3 py-2.5 text-sm text-paper placeholder-dim/60 focus:outline-none focus:border-dim"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="session-roots" className="block text-xs text-dim">
              {t('rail.workspaceRoots')}
            </label>
            <div className="flex items-stretch gap-2">
            <input
              id="session-roots"
              type="text"
              value={roots}
              onChange={(event) => setRoots(event.target.value)}
              placeholder={systemInfo?.pathExample ?? ''}
              className="ui-control min-w-0 flex-1 bg-raised border border-rule rounded-md px-3 py-2.5 text-sm font-mono text-paper placeholder-dim/60 focus:outline-none focus:border-dim"
            />
            <button
              type="button"
              onClick={() => setBrowseOpen(true)}
              className="ui-button shrink-0 whitespace-nowrap text-xs text-dim hover:text-paper hover:bg-raised border border-rule rounded-md px-3 py-2.5"
            >
              {t('rail.browse')}
            </button>
            </div>
            {rootChips.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {rootChips.map((root) => (
                  <span
                    key={root}
                    title={root}
                    className="inline-flex max-w-full items-center gap-1 font-mono text-[11px] text-dim border border-rule rounded px-1.5 py-0.5"
                  >
                    <span className="truncate">{root}</span>
                    <button
                      type="button"
                      aria-label={t('rail.removeWorkspaceRoot', { root })}
                      onClick={() => dropRoot(root)}
                      className="ui-button shrink-0 leading-none text-dim/70 hover:text-verdict"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {recentRoots.length > 0 && (
              <div className="space-y-1 pt-0.5">
                <span className="block text-[10px] uppercase tracking-wider text-dim/70">
                  {t('rail.recentWorkspaces')}
                </span>
                <div className="flex flex-wrap gap-1">
                  {recentRoots.map((root) => (
                    <button
                      key={root}
                      type="button"
                      title={root}
                      onClick={() => addRoot(root)}
                      className="ui-button max-w-full font-mono text-[11px] text-dim hover:text-paper hover:bg-raised border border-rule rounded px-1.5 py-0.5 truncate"
                    >
                      {root}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {browseOpen && (
              <WorkspacePicker onSelect={addRoot} onClose={() => setBrowseOpen(false)} />
            )}
          </div>

          <div>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-rule bg-ink/30 px-3 py-2">
              <input
                type="checkbox"
                checked={additionalToolResultInfo}
                onChange={(event) => setAdditionalToolResultInfo(event.target.checked)}
                className="ui-choice mt-0.5 h-4 w-4 accent-accent"
              />
              <span className="min-w-0">
                <span className="block text-xs text-paper">{t('rail.additionalToolResultInfo')}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-dim">
                  {t('rail.additionalToolResultInfoDescription')}
                </span>
              </span>
            </label>

          </div>

          <fieldset disabled={submitting} className="space-y-2">
            <legend className="mb-2 text-xs text-dim">{t('pluginManagement.sessionSelection')}</legend>
            {plugins === null ? <BusyIndicator label={t('pluginManagement.loading')} /> : plugins.map(plugin => (
              <label key={plugin.id} className="flex items-start gap-2 rounded-md border border-rule px-3 py-2">
                <input type="checkbox" className="ui-choice mt-0.5 h-4 w-4 accent-accent"
                  disabled={!plugin.active} checked={pluginIds.includes(plugin.id)}
                  onChange={event => setPluginIds(current => event.target.checked ? [...current, plugin.id] : current.filter(id => id !== plugin.id))} />
                <span className="min-w-0 text-xs text-paper"><span className="block font-medium">{plugin.name || plugin.id}</span>
                  <span className="block break-all text-dim">{plugin.id} · v{plugin.version} · {t('plugins.tools', { count: plugin.tools.length })}</span>
                  {!plugin.active && <span className="ml-2 text-verdict">{t('pluginManagement.failed')}</span>}
                </span>
              </label>
            ))}
          </fieldset>

          {formError !== null && (
            <p role="alert" className="text-xs text-verdict border border-verdict/40 rounded-md px-2 py-1.5">
              {formError}
            </p>
          )}

          <div className="flex gap-3 border-t border-rule pt-6">
            <button
              type="submit"
              disabled={submitting || pattern === '' || plugins === null}
              className="ui-button flex-1 bg-accent text-onaccent text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-accent/85 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <BusyIndicator label={t('rail.creating')} /> : t('rail.create')}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={onCancel}
              className="ui-button flex-1 text-sm text-dim hover:text-paper hover:bg-raised border border-rule rounded-md px-3 py-1.5"
            >
              {t('rail.cancel')}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
