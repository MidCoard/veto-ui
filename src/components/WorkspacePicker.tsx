import BusyIndicator from './BusyIndicator';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { getBackendPort } from '../config/backend';
import { browseFs, createFsDirectory } from '../api/endpoints';
import type { FsBrowseResponse } from '../api/types';
import { useI18n, type Translate } from '../i18n/I18nContext';
import Modal from './Modal';

function errorText(error: unknown, t: Translate): string {
  return error instanceof ApiError ? error.message : t('error.backendUnreachable', { port: getBackendPort() });
}

export default function WorkspacePicker({ onSelect, onClose }: {
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [browse, setBrowse] = useState<FsBrowseResponse | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const createPending = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => { if (newFolderOpen) nameInput.current?.focus(); }, [newFolderOpen]);

  const createFolder = async () => {
    if (createPending.current || !browse?.path || !browse.canCreate) return;
    const name = folderName.trim();
    if (!name || /[\\/<>:"|?*\x00-\x1f]/.test(name) || name === '.' || name === '..' || name.endsWith('.')) {
      setCreateError(t('rail.folderInvalid'));
      return;
    }
    const parent = browse.path;
    createPending.current = true;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createFsDirectory(parent, name);
      if (!mounted.current) return;
      setNewFolderOpen(false);
      setFolderName('');
      if (!created.expandable) {
        onSelect(created.path);
        onClose();
      } else {
        await loadBrowse(created.path);
      }
    } catch (error) {
      if (mounted.current) setCreateError(errorText(error, t));
    } finally {
      createPending.current = false;
      if (mounted.current) setCreating(false);
    }
  };

  const loadBrowse = async (path?: string): Promise<void> => {
    const version = ++requestVersion.current;
    setBrowseLoading(true);
    setNewFolderOpen(false);
    setCreateError(null);
    setBrowseError(null);
    try {
      const result = await browseFs(path);
      if (version === requestVersion.current && mounted.current) setBrowse(result);
    } catch (error) {
      if (version === requestVersion.current && mounted.current) setBrowseError(errorText(error, t));
    } finally {
      if (version === requestVersion.current && mounted.current) setBrowseLoading(false);
    }
  };

  useEffect(() => { mounted.current = true; void loadBrowse(); return () => { mounted.current = false; requestVersion.current++; }; }, []);

  return (
    <Modal title={t('rail.workspaceRoots')} closeLabel={t('rail.cancel')} onClose={onClose}>
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={creating || browseLoading || browse === null || (browse.path == null && browse.parent == null)}
            onClick={() =>
              void loadBrowse(
                browse !== null && browse.path != null
                  ? (browse.parent ?? undefined)
                  : undefined,
              )
            }
            className="ui-button text-xs text-dim hover:text-paper hover:bg-panel border border-rule rounded-md px-3 py-2 disabled:opacity-40"
          >
            {t('rail.browseUp')}
          </button>
          <span className="min-w-0 flex-1 font-mono text-[11px] text-dim truncate" title={browse?.path ?? ''}>
            {browse === null || browse.path == null ? t('rail.browseDrives') : browse.path}
          </span>
          <button type="button" disabled={creating || browseLoading || browseError !== null || !browse?.path || !browse.canCreate} onClick={() => { setNewFolderOpen(open => !open); setCreateError(null); }} className="ui-button inline-flex items-center gap-1.5 rounded-md border border-rule px-3 py-2 text-xs text-paper hover:bg-raised disabled:opacity-40">
            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7V5h6l2 2h10v13H3zM12 11v6M9 14h6" /></svg>
            {t('rail.newFolder')}
          </button>
          <button
            type="button"
            disabled={creating || browseLoading || browseError !== null || browse === null || browse.path == null || !browse.selectable}
            onClick={() => {
              if (browse !== null && browse.path != null && browse.selectable) {
                onSelect(browse.path);
                onClose();
              }
            }}
            className="ui-button text-xs text-accent hover:bg-accent/10 border border-accent/40 rounded-md px-3 py-2 disabled:opacity-40"
          >
            {t('rail.browseUse')}
          </button>
        </div>
        {newFolderOpen && <div role="group" aria-label={t('rail.newFolder')} className="space-y-3 rounded-xl border border-rule bg-ink/30 p-3">
          <label htmlFor="workspace-folder-name" className="block text-xs text-dim">{t('rail.folderName')}</label>
          <div className="flex items-center gap-2">
            <input ref={nameInput} id="workspace-folder-name" className="ui-control min-w-0 flex-1" value={folderName} maxLength={255} disabled={creating} aria-invalid={createError !== null} aria-describedby={createError ? 'workspace-folder-error workspace-folder-hint' : 'workspace-folder-hint'} onChange={event => { setFolderName(event.target.value); setCreateError(null); }} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); void createFolder(); } }} />
            <button type="button" disabled={creating || !folderName.trim()} onClick={() => void createFolder()} className="ui-button shrink-0 rounded-lg bg-paper px-3 py-2.5 text-xs font-medium text-ink disabled:opacity-40">{creating ? <BusyIndicator label={t('rail.folderCreating')} icon={false} /> : t('rail.folderCreate')}</button>
          </div>
          {createError && <p id="workspace-folder-error" role="alert" className="text-xs text-verdict">{createError}</p>}
          <p id="workspace-folder-hint" className="text-xs text-dim">{t('rail.folderHint')}</p>
        </div>}
        {browseLoading ? (
          <p className="text-xs text-dim px-1 py-1"><BusyIndicator label={t('rail.browseLoading')} /></p>
        ) : browseError !== null ? (
          <p role="alert" className="text-xs text-verdict px-1 py-1 break-words">
            {browseError}
          </p>
        ) : browse !== null && browse.entries.length === 0 ? (
          <p className="text-xs text-dim px-1 py-1">{t('rail.browseEmpty')}</p>
        ) : (
          <ul className="max-h-[50dvh] overflow-y-auto space-y-0.5">
            {browse?.entries.map((entry) => (
              <li key={entry.path}>
                <button
                  type="button"
                  disabled={creating || (!entry.expandable && !entry.selectable)}
                  onClick={() => {
                    if (entry.expandable) void loadBrowse(entry.path);
                    else if (entry.selectable) {
                      onSelect(entry.path);
                      onClose();
                    }
                  }}
                  className="ui-button w-full text-left text-xs text-paper/80 enabled:hover:text-paper enabled:hover:bg-raised rounded-md px-3 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={entry.path}
                >
                  <span className="block font-mono break-all">{entry.name}</span>
                  {entry.declared && <span className="block text-[11px] text-dim">{t(!entry.selectable && !entry.expandable ? 'rail.workspaceClaimedUnavailable' : 'rail.workspaceClaimed')}</span>}
                  {!entry.declared && !entry.selectable && !entry.expandable && <span className="block text-[11px] text-dim">{t('rail.workspaceUnavailable')}</span>}
                  {!entry.expandable && entry.selectable && <span className="block text-[11px] text-accent">{t('rail.workspaceSelect')}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
