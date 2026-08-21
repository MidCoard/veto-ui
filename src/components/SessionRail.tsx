import React, { useMemo, useState } from 'react';
import { ApiError } from '../api/client';
import { browseFs, listPatterns } from '../api/endpoints';
import type { AgentPatternEntity, FsBrowseResponse, SystemInfo } from '../api/types';
import { useI18n } from '../i18n/I18nContext';
import type { Translate } from '../i18n/I18nContext';
import { loadSystemInfo } from '../lib/systemInfo';
import { formatTimestamp, toDate } from '../lib/time';
import { recentWorkspaces } from '../lib/workspaces';
import { useSessions } from '../state/SessionContext';
import type { SessionWorkState } from '../state/SessionContext';

/**
 * SessionRail — left column. Session list with mono last-active times,
 * an inline new-session dialog (pattern dropdown, optional name, workspace
 * roots CSV), and two-step inline delete confirmation. API errors render
 * inline where they happened. Each row carries a status LED: pulsing cyan =
 * a prompt is running, pulsing red = a veto awaits your decision, dim green
 * = idle.
 */

const ledStyles: Record<SessionWorkState, string> = {
  working: 'bg-accent animate-pulse',
  awaiting: 'bg-verdict animate-pulse',
  idle: 'bg-pass/50',
};

const ledLabelKeys = {
  working: 'rail.ledWorking',
  awaiting: 'rail.ledAwaiting',
  idle: 'rail.ledIdle',
} as const;

function errorText(error: unknown, t: Translate): string {
  if (error instanceof ApiError) return error.message;
  return t('error.backendUnreachable');
}

const SessionRail: React.FC = () => {
  const { sessions, currentName, select, create, remove, sessionStates } = useSessions();
  const { t } = useI18n();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [patterns, setPatterns] = useState<AgentPatternEntity[] | null>(null);
  const [pattern, setPattern] = useState('');
  const [name, setName] = useState('');
  const [roots, setRoots] = useState('');
  const [rootsFocused, setRootsFocused] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Server-filesystem browser for the workspace field
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browse, setBrowse] = useState<FsBrowseResponse | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);

  const loadBrowse = async (path?: string): Promise<void> => {
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      setBrowse(await browseFs(path));
    } catch (error) {
      setBrowseError(errorText(error, t));
    } finally {
      setBrowseLoading(false);
    }
  };

  const toggleBrowse = (): void => {
    if (!browseOpen && browse === null) void loadBrowse();
    setBrowseOpen((open) => !open);
  };

  // The backend resolves a duplicate name to the most-recently-active session
  // (findFirstByNameAndOwnerOrderByLastActiveAtDesc) — mirror that so only one
  // of several same-named rows highlights as active.
  const resolvedActiveId = (() => {
    if (currentName === null) return null;
    const same = sessions.filter((candidate) => candidate.name === currentName);
    if (same.length === 0) return null;
    const millis = (session: (typeof same)[number]): number =>
      toDate(session.lastActiveAt)?.getTime() ?? 0;
    return same.reduce((a, b) => (millis(a) >= millis(b) ? a : b)).id;
  })();

  const openDialog = async (): Promise<void> => {
    setDialogOpen(true);
    setFormError(null);
    // Server OS info drives the path-syntax hint (cached app-level).
    void loadSystemInfo()
      .then(setSystemInfo)
      .catch(() => undefined);
    if (patterns === null) {
      try {
        const list = await listPatterns();
        setPatterns(list);
        if (list.length > 0) setPattern(list[0].name);
      } catch (error) {
        setFormError(errorText(error, t));
      }
    }
  };

  // Recently-used roots from the loaded sessions, most-recent-first.
  const recentRoots = useMemo(() => recentWorkspaces(sessions), [sessions]);

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
      await create(pattern, name.trim() === '' ? undefined : name.trim(), roots.trim());
      setDialogOpen(false);
      setName('');
      setRoots('');
    } catch (error) {
      setFormError(errorText(error, t));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (sessionName: string): Promise<void> => {
    setDeleteError(null);
    try {
      await remove(sessionName);
      setConfirmingDelete(null);
    } catch (error) {
      setDeleteError(errorText(error, t));
      setConfirmingDelete(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-panel">
      <div className="flex items-center justify-between px-3 h-12 border-b border-rule shrink-0">
        <span className="font-display text-[11px] uppercase tracking-[0.14em] text-dim">
          {t('rail.sessions')}
        </span>
        <button
          type="button"
          onClick={() => void openDialog()}
          className="text-xs text-accent hover:bg-accent/10 rounded-md px-2 py-1"
        >
          {t('rail.newSession')}
        </button>
      </div>

      {dialogOpen && (
        <form
          onSubmit={(event) => void handleCreate(event)}
          className="border-b border-rule p-3 space-y-3 bg-raised/40"
        >
          <div className="space-y-1">
            <label htmlFor="session-pattern" className="block text-xs text-dim">
              {t('rail.pattern')}
            </label>
            <select
              id="session-pattern"
              value={pattern}
              onChange={(event) => setPattern(event.target.value)}
              className="w-full bg-raised border border-rule rounded-md px-2 py-1.5 text-sm text-paper focus:outline-none focus:border-accent"
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
              className="w-full bg-raised border border-rule rounded-md px-2 py-1.5 text-sm text-paper placeholder-dim/60 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="session-roots" className="block text-xs text-dim">
              {t('rail.workspaceRoots')}
            </label>
            <input
              id="session-roots"
              type="text"
              value={roots}
              onChange={(event) => setRoots(event.target.value)}
              onFocus={() => setRootsFocused(true)}
              onBlur={() => setRootsFocused(false)}
              placeholder={systemInfo?.pathExample ?? ''}
              className="w-full bg-raised border border-rule rounded-md px-2 py-1.5 text-sm font-mono text-paper placeholder-dim/60 focus:outline-none focus:border-accent"
            />
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
                      className="max-w-full font-mono text-[11px] text-dim hover:text-paper hover:bg-raised border border-rule rounded px-1.5 py-0.5 truncate"
                    >
                      {root}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={toggleBrowse}
              className="text-xs text-accent hover:bg-accent/10 border border-rule rounded-md px-2 py-1"
            >
              {browseOpen ? t('rail.browseHide') : t('rail.browse')}
            </button>
            {browseOpen && (
              <div className="bg-raised border border-rule rounded-lg p-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={browse === null || (browse.path === null && browse.parent === null)}
                    onClick={() =>
                      void loadBrowse(
                        browse !== null && browse.path !== null
                          ? (browse.parent ?? undefined)
                          : undefined,
                      )
                    }
                    className="text-xs text-dim hover:text-paper hover:bg-panel border border-rule rounded-md px-2 py-0.5 disabled:opacity-40"
                  >
                    {t('rail.browseUp')}
                  </button>
                  <span className="flex-1 font-mono text-[11px] text-dim truncate" title={browse?.path ?? ''}>
                    {browse === null || browse.path === null ? t('rail.browseDrives') : browse.path}
                  </span>
                  <button
                    type="button"
                    disabled={browse === null || browse.path === null}
                    onClick={() => {
                      if (browse !== null && browse.path !== null) setRoots(browse.path);
                      setBrowseOpen(false);
                    }}
                    className="text-xs text-accent hover:bg-accent/10 border border-accent/40 rounded-md px-2 py-0.5 disabled:opacity-40"
                  >
                    {t('rail.browseUse')}
                  </button>
                </div>
                {browseLoading ? (
                  <p className="text-xs text-dim px-1 py-1">{t('rail.browseLoading')}</p>
                ) : browseError !== null ? (
                  <p role="alert" className="text-xs text-verdict px-1 py-1 break-words">
                    {browseError}
                  </p>
                ) : browse !== null && browse.entries.length === 0 ? (
                  <p className="text-xs text-dim px-1 py-1">{t('rail.browseEmpty')}</p>
                ) : (
                  <ul className="max-h-40 overflow-y-auto space-y-0.5">
                    {browse?.entries.map((entry) => (
                      <li key={entry.path}>
                        <button
                          type="button"
                          onClick={() => void loadBrowse(entry.path)}
                          className="w-full text-left font-mono text-[11px] text-paper/80 hover:text-paper hover:bg-panel rounded px-1.5 py-1 truncate"
                          title={entry.path}
                        >
                          {entry.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {formError !== null && (
            <p role="alert" className="text-xs text-verdict border border-verdict/40 rounded-md px-2 py-1.5">
              {formError}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || pattern === ''}
              className="flex-1 bg-accent text-onaccent text-sm font-medium rounded-md px-3 py-1.5 hover:bg-accent/85 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t('rail.creating') : t('rail.create')}
            </button>
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="flex-1 text-sm text-dim hover:text-paper hover:bg-raised border border-rule rounded-md px-3 py-1.5"
            >
              {t('rail.cancel')}
            </button>
          </div>
        </form>
      )}

      {deleteError !== null && (
        <p role="alert" className="mx-3 mt-2 text-xs text-verdict border border-verdict/40 rounded-md px-2 py-1.5">
          {deleteError}
        </p>
      )}

      <ul className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {sessions.length === 0 && (
          <li className="px-3 py-4 text-sm text-dim">
            {t('rail.empty')}
          </li>
        )}
        {sessions.map((session) => {
          const active = session.id === resolvedActiveId;
          const confirming = confirmingDelete === session.name;
          // Duplicate names are legal (one per workspace) — disambiguate by id.
          const duplicated = sessions.filter((candidate) => candidate.name === session.name).length > 1;
          return (
            <li key={session.id} className="mx-2">
              <div
                role="button"
                tabIndex={0}
                onClick={() => select(session.name)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    select(session.name);
                  }
                }}
                className={[
                  'w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left cursor-pointer rounded-md border-l-2',
                  active
                    ? 'bg-raised border-accent'
                    : 'border-transparent hover:bg-raised/60',
                ].join(' ')}
              >
                <div className="min-w-0">
                  <div className={`flex items-center gap-1.5 text-sm ${active ? 'text-paper' : 'text-paper/80'}`}>
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${ledStyles[sessionStates[session.name] ?? 'idle']}`}
                      title={t(ledLabelKeys[sessionStates[session.name] ?? 'idle'])}
                    />
                    <span className="truncate">
                      {session.name}
                      {duplicated && (
                        <span className="font-mono text-[10px] text-dim/70"> #{session.id.slice(0, 8)}</span>
                      )}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-dim">
                    {formatTimestamp(session.lastActiveAt)}
                  </div>
                  {session.workspaceRoots !== null && (
                    <div
                      className="font-mono text-[10px] text-dim/70 truncate"
                      title={session.workspaceRoots}
                    >
                      {session.workspaceRoots}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={t('rail.deleteAria', { name: session.name })}
                  onClick={(event) => {
                    event.stopPropagation();
                    setConfirmingDelete(session.name);
                  }}
                  className="text-dim/70 hover:text-verdict p-1 shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              {confirming && (
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="text-xs text-dim flex-1">
                    {duplicated
                      ? t('rail.deleteConfirmAll', {
                          count: sessions.filter((candidate) => candidate.name === session.name)
                            .length,
                          name: session.name,
                        })
                      : t('rail.deleteConfirm')}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(session.name)}
                    className="text-xs text-verdict border border-verdict/50 rounded-md px-2 py-0.5 hover:bg-verdict/10"
                  >
                    {t('rail.delete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(null)}
                    className="text-xs text-dim hover:text-paper hover:bg-raised rounded-md px-2 py-0.5"
                  >
                    {t('rail.keep')}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default SessionRail;
