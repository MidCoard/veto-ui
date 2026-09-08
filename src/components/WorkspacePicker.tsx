import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { getBackendPort } from '../config/backend';
import { browseFs } from '../api/endpoints';
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

  useEffect(() => { void loadBrowse(); }, []);

  return (
    <Modal title={t('rail.workspaceRoots')} closeLabel={t('rail.cancel')} onClose={onClose}>
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={browseLoading || browse === null || (browse.path == null && browse.parent == null)}
            onClick={() =>
              void loadBrowse(
                browse !== null && browse.path != null
                  ? (browse.parent ?? undefined)
                  : undefined,
              )
            }
            className="text-xs text-dim hover:text-paper hover:bg-panel border border-rule rounded-md px-2 py-0.5 disabled:opacity-40"
          >
            {t('rail.browseUp')}
          </button>
          <span className="min-w-0 flex-1 font-mono text-[11px] text-dim truncate" title={browse?.path ?? ''}>
            {browse === null || browse.path == null ? t('rail.browseDrives') : browse.path}
          </span>
          <button
            type="button"
            disabled={browseLoading || browseError !== null || browse === null || browse.path == null}
            onClick={() => {
              if (browse !== null && browse.path != null) onSelect(browse.path);
              onClose();
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
          <ul className="max-h-[50dvh] overflow-y-auto space-y-0.5">
            {browse?.entries.map((entry) => (
              <li key={entry.path}>
                <button
                  type="button"
                  onClick={() => void loadBrowse(entry.path)}
                  className="w-full text-left font-mono text-xs text-paper/80 hover:text-paper hover:bg-raised rounded-md px-3 py-2.5 truncate"
                  title={entry.path}
                >
                  {entry.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
