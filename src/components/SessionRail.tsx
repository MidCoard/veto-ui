import React, { useMemo, useState } from 'react';
import { ApiError } from '../api/client';
import { getBackendPort } from '../config/backend';
import { useI18n } from '../i18n/I18nContext';
import type { Translate } from '../i18n/I18nContext';
import { formatTimestamp, toDate } from '../lib/time';
import { groupSessionsByWorkspace } from '../lib/workspaces';
import { useSessions } from '../state/SessionContext';
import type { SessionWorkState } from '../state/SessionContext';

/** Workspace cards contain compact session cards and inline delete confirmation. */

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
  return t('error.backendUnreachable', { port: getBackendPort() });
}

const SessionRail: React.FC<{ onNewSession: () => void; onSelectSession?: () => void }> = ({ onNewSession, onSelectSession }) => {
  const { sessions, currentName, select, remove, sessionStates } = useSessions();
  const { t } = useI18n();

  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const workspaceGroups = useMemo(() => groupSessionsByWorkspace(sessions), [sessions]);
  const [collapsedWorkspaces, setCollapsedWorkspaces] = useState<Set<string>>(new Set());

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
          onClick={onNewSession}
          className="text-xs text-accent hover:bg-accent/10 rounded-md px-2 py-1"
        >
          {t('rail.newSession')}
        </button>
      </div>

      {deleteError !== null && (
        <p role="alert" className="mx-3 mt-2 text-xs text-verdict border border-verdict/40 rounded-md px-2 py-1.5">
          {deleteError}
        </p>
      )}

      <ul className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
        {sessions.length === 0 && (
          <li className="px-3 py-4 text-sm text-dim">
            {t('rail.empty')}
          </li>
        )}
        {workspaceGroups.map((group) => (
          <li key={group.key} className="overflow-hidden rounded-xl border border-rule bg-raised/40">
            <button
              type="button"
              aria-expanded={!collapsedWorkspaces.has(group.key)}
              title={group.roots.join(', ') || t('rail.noWorkspace')}
              onClick={() => setCollapsedWorkspaces((current) => {
                const next = new Set(current);
                if (next.has(group.key)) next.delete(group.key); else next.add(group.key);
                return next;
              })}
              className="flex w-full items-start gap-2.5 p-3 text-left text-paper hover:bg-raised/60"
            >
              <span aria-hidden="true">{collapsedWorkspaces.has(group.key) ? '▸' : '▾'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {group.roots.map((root) => root.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || root).join(' + ') || t('rail.noWorkspace')}
                </span>
                {group.roots.length > 0 && <span className="mt-1 block truncate font-mono text-[10px] text-dim">{group.roots.join(', ')}</span>}
              </span>
              <span className="shrink-0 rounded-md border border-rule bg-panel px-1.5 py-0.5 font-mono text-[10px] text-dim">{group.sessions.length}</span>
            </button>
            {!collapsedWorkspaces.has(group.key) && <ul className="space-y-1.5 px-2 pb-2">
                {group.sessions.map((session) => {
                  const active = session.id === resolvedActiveId;
                  const confirming = confirmingDelete === session.name;
                  // Duplicate names are legal (one per workspace) — disambiguate by id.
                  const duplicated = sessions.filter((candidate) => candidate.name === session.name).length > 1;
                  return (
                    <li key={session.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => { select(session.name); onSelectSession?.(); }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            select(session.name);
                            onSelectSession?.();
                          }
                        }}
                        className={[
                          'w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left cursor-pointer rounded-lg border',
                          active
                            ? 'bg-accent/10 border-accent/50'
                            : 'bg-panel border-rule/60 hover:border-dim/40 hover:bg-raised',
                        ].join(' ')}
                      >
                        <div className="min-w-0">
                          <div className={`flex items-center gap-1.5 text-xs ${active ? 'text-paper' : 'text-paper/80'}`}>
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${ledStyles[sessionStates[session.name] ?? 'idle']}`}
                              title={t(ledLabelKeys[sessionStates[session.name] ?? 'idle'])}
                            />
                            <span className="truncate" title={session.name}>
                              {session.name}
                              {duplicated && (
                                <span className="font-mono text-[10px] text-dim/70"> #{session.id.slice(0, 8)}</span>
                              )}
                            </span>
                          </div>
                          <div className="mt-1 pl-3 font-mono text-[10px] text-dim">
                            {formatTimestamp(session.lastActiveAt)}
                          </div>
                          {session.guidedEnabled && (
                            <span className="text-[10px] text-accent">{t('rail.guidedEnabled')}</span>
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
            </ul>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SessionRail;
