import React, { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { deleteVaultNote, getVaultNote, listVaultNotes, putVaultNote } from '../../api/endpoints';
import { useI18n } from '../../i18n/I18nContext';
import type { Translate } from '../../i18n/I18nContext';

/**
 * CredentialsSection — vault note titles with create + two-step delete +
 * per-row value reveal (fetched on first toggle; hide returns to the mask).
 * Values are sensitive: they are never listed, only fetched on demand.
 */
function errorText(error: unknown, t: Translate): string {
  if (error instanceof ApiError) return error.message;
  return t('error.backendUnreachable');
}

const EyeIcon: React.FC<{ open: boolean }> = ({ open }) =>
  open ? (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );

const CredentialsSection: React.FC = () => {
  const { t } = useI18n();
  const [titles, setTitles] = useState<string[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Revealed values per title (fetched on demand); errors per title.
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealErrors, setRevealErrors] = useState<Record<string, string>>({});

  const load = useCallback(async (): Promise<void> => {
    try {
      setListError(null);
      setTitles(await listVaultNotes());
    } catch (error) {
      setListError(errorText(error, t));
      setTitles([]);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (trimmedTitle === '' || value === '' || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      await putVaultNote(trimmedTitle, value);
      setTitle('');
      setValue('');
      setShowValue(false);
      setFormOpen(false);
      await load();
    } catch (error) {
      setFormError(errorText(error, t));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteTitle: string): Promise<void> => {
    setDeleteError(null);
    try {
      await deleteVaultNote(noteTitle);
      setConfirmingDelete(null);
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[noteTitle];
        return next;
      });
      await load();
    } catch (error) {
      setDeleteError(errorText(error, t));
      setConfirmingDelete(null);
    }
  };

  /** Reveal a value (fetch once, then toggle locally) or hide it again. */
  const toggleReveal = async (noteTitle: string): Promise<void> => {
    if (revealed[noteTitle] !== undefined) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[noteTitle];
        return next;
      });
      return;
    }
    try {
      const note = await getVaultNote(noteTitle);
      setRevealed((prev) => ({ ...prev, [noteTitle]: note.value }));
      setRevealErrors((prev) => {
        const next = { ...prev };
        delete next[noteTitle];
        return next;
      });
    } catch (error) {
      setRevealErrors((prev) => ({ ...prev, [noteTitle]: errorText(error, t) }));
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-dim">{t('vault.hint')}</p>

      <button
        type="button"
        onClick={() => setFormOpen((open) => !open)}
        className="text-xs text-accent hover:bg-accent/10 border border-rule rounded-md px-2 py-1.5"
      >
        {formOpen ? t('vault.closeForm') : t('vault.new')}
      </button>

      {formOpen && (
        <form
          onSubmit={(event) => void handleSave(event)}
          className="space-y-2 bg-raised/40 border border-rule rounded-lg p-2.5"
        >
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('vault.titlePlaceholder')}
            aria-label={t('vault.titlePlaceholder')}
            className="w-full bg-raised border border-rule rounded-md px-2 py-1.5 text-sm font-mono text-paper placeholder-dim/60 focus:outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <input
              type={showValue ? 'text' : 'password'}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={t('vault.valuePlaceholder')}
              aria-label={t('vault.valuePlaceholder')}
              autoComplete="new-password"
              className="flex-1 min-w-0 bg-raised border border-rule rounded-md px-2 py-1.5 text-sm font-mono text-paper placeholder-dim/60 focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setShowValue((show) => !show)}
              className="text-xs text-dim hover:text-paper hover:bg-raised border border-rule rounded-md px-2 py-1.5 shrink-0"
            >
              {showValue ? t('vault.hide') : t('vault.show')}
            </button>
          </div>
          {formError !== null && (
            <p role="alert" className="text-xs text-verdict border border-verdict/40 rounded-md px-2 py-1.5 break-words">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={saving || title.trim() === '' || value === ''}
            className="bg-accent text-onaccent text-sm font-medium rounded-md px-3 py-1.5 hover:bg-accent/85 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t('vault.saving') : t('vault.save')}
          </button>
        </form>
      )}

      {listError !== null && (
        <p role="alert" className="text-xs text-verdict border border-verdict/40 rounded-md px-2 py-1.5 break-words">
          {listError}
        </p>
      )}
      {deleteError !== null && (
        <p role="alert" className="text-xs text-verdict border border-verdict/40 rounded-md px-2 py-1.5 break-words">
          {deleteError}
        </p>
      )}

      {titles === null ? (
        <p className="text-sm text-dim">{t('vault.loading')}</p>
      ) : titles.length === 0 && listError === null ? (
        <p className="text-sm text-dim">{t('vault.empty')}</p>
      ) : (
        <ul className="divide-y divide-rule/60 border border-rule rounded-lg">
          {titles.map((noteTitle) => (
            <li key={noteTitle} className="px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm text-paper truncate">{noteTitle}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label={
                      revealed[noteTitle] !== undefined ? t('vault.hide') : t('vault.show')
                    }
                    title={revealed[noteTitle] !== undefined ? t('vault.hide') : t('vault.show')}
                    onClick={() => void toggleReveal(noteTitle)}
                    className="text-dim/70 hover:text-paper p-0.5"
                  >
                    <EyeIcon open={revealed[noteTitle] !== undefined} />
                  </button>
                  <button
                    type="button"
                    aria-label={t('vault.deleteAria', { name: noteTitle })}
                    onClick={() => setConfirmingDelete(noteTitle)}
                    className="text-dim/70 hover:text-verdict p-0.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="mt-0.5 font-mono text-xs text-dim break-all select-all">
                {revealed[noteTitle] !== undefined ? revealed[noteTitle] : '••••••'}
              </div>
              {revealErrors[noteTitle] !== undefined && (
                <p role="alert" className="mt-1 text-xs text-verdict break-words">
                  {revealErrors[noteTitle]}
                </p>
              )}
              {confirmingDelete === noteTitle && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-dim flex-1">{t('vault.deleteConfirm')}</span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(noteTitle)}
                    className="text-xs text-verdict border border-verdict/50 rounded-md px-2 py-0.5 hover:bg-verdict/10"
                  >
                    {t('vault.delete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(null)}
                    className="text-xs text-dim hover:text-paper hover:bg-raised rounded-md px-2 py-0.5"
                  >
                    {t('vault.keep')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CredentialsSection;
