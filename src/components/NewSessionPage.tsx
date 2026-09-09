import BusyIndicator from './BusyIndicator';
import React, { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../api/client';
import { getBackendPort } from '../config/backend';
import { listPatterns } from '../api/endpoints';
import type { AgentPatternEntity, SystemInfo } from '../api/types';
import { useI18n, type Translate } from '../i18n/I18nContext';
import { loadSystemInfo } from '../lib/systemInfo';
import { recentWorkspaces } from '../lib/workspaces';
import { useSessions } from '../state/SessionContext';
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
  const [patterns, setPatterns] = useState<AgentPatternEntity[] | null>(null);
  const [pattern, setPattern] = useState('');
  const [name, setName] = useState('');
  const [roots, setRoots] = useState('');
  const [additionalToolResultInfo, setAdditionalToolResultInfo] = useState(false);
  const [guidedEnabled, setGuidedEnabled] = useState(true);
  const [rootsFocused, setRootsFocused] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [browseOpen, setBrowseOpen] = useState(false);
  const recentRoots = useMemo(() => recentWorkspaces(sessions), [sessions]);

  useEffect(() => {
    let active = true;
    void loadSystemInfo().then((info) => { if (active) setSystemInfo(info); }).catch(() => undefined);
    void listPatterns().then((list) => {
      if (!active) return;
      setPatterns(list);
      setPattern(list[0]?.name ?? '');
    }).catch((error) => { if (active) setFormError(errorText(error, t)); });
    return () => { active = false; };
  }, [t]);

  /** Fill the roots input with a picked root, or append it (comma-joined) if set. */
  const addRoot = (root: string): void => {
    setRoots((current) => {
      const parts = current
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== '');
      if (parts.includes(root)) return current;
      return [...parts, root].join(', ');
    });
  };

  const handleCreate = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (submitting || pattern === '') return;
    setSubmitting(true);
    setFormError(null);
    try {
      await create(
        pattern,
        name.trim() === '' ? undefined : name.trim(),
        roots.trim(),
        additionalToolResultInfo ? 'DETAILED' : 'BASIC',
        guidedEnabled,
      );
      onCreated();
      setName('');
      setRoots('');
      setAdditionalToolResultInfo(false);
      setGuidedEnabled(true);
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
              onFocus={() => setRootsFocused(true)}
              onBlur={() => setRootsFocused(false)}
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
            {recentRoots.length > 0 && (roots.trim() === '' || rootsFocused) && (
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
                      // Keep input focus so the list stays open for multi-picks.
                      onMouseDown={(event) => event.preventDefault()}
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
              <WorkspacePicker onSelect={setRoots} onClose={() => setBrowseOpen(false)} />
            )}
          </div>

          <div className="grid gap-3 min-[1400px]:grid-cols-2">
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

            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-rule bg-ink/30 px-3 py-2">
              <input
                type="checkbox"
                checked={guidedEnabled}
                onChange={(event) => setGuidedEnabled(event.target.checked)}
                className="ui-choice mt-0.5 h-4 w-4 accent-accent"
              />
              <span className="min-w-0">
                <span className="block text-xs text-paper">{t('rail.guidedEnabled')}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-dim">
                  {t('rail.guidedDescription')}
                </span>
              </span>
            </label>
          </div>

          {formError !== null && (
            <p role="alert" className="text-xs text-verdict border border-verdict/40 rounded-md px-2 py-1.5">
              {formError}
            </p>
          )}

          <div className="flex gap-3 border-t border-rule pt-6">
            <button
              type="submit"
              disabled={submitting || pattern === ''}
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
