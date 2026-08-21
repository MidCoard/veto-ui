import React, { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { createPattern, deletePattern, listPatterns } from '../../api/endpoints';
import type { AgentPatternEntity, ModelTier } from '../../api/types';
import { useI18n } from '../../i18n/I18nContext';
import type { Translate } from '../../i18n/I18nContext';

/**
 * PatternsTab — agent pattern list with inline create and two-step delete.
 * API errors render plainly (the backend's duplicate-pattern bug can 500 —
 * the message renders, the tab keeps working).
 */

const TIERS: ModelTier[] = ['TOP', 'MID', 'LOW', 'LOCAL'];

function errorText(error: unknown, t: Translate): string {
  if (error instanceof ApiError) return error.message;
  return t('error.backendUnreachable');
}

const tierBadge: Record<ModelTier, string> = {
  TOP: 'text-accent border-accent/40',
  MID: 'text-paper/80 border-rule',
  LOW: 'text-dim border-rule',
  LOCAL: 'text-dim/70 border-rule',
};

const PatternsTab: React.FC = () => {
  const { t } = useI18n();
  const [patterns, setPatterns] = useState<AgentPatternEntity[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [tier, setTier] = useState<ModelTier>('MID');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setListError(null);
      setPatterns(await listPatterns());
    } catch (error) {
      setListError(errorText(error, t));
      setPatterns([]);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === '' || submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await createPattern(trimmed, tier);
      setName('');
      setFormOpen(false);
      await load();
    } catch (error) {
      setFormError(errorText(error, t));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (patternName: string): Promise<void> => {
    setDeleteError(null);
    try {
      await deletePattern(patternName);
      setConfirmingDelete(null);
      await load();
    } catch (error) {
      setDeleteError(errorText(error, t));
      setConfirmingDelete(null);
    }
  };

  return (
    <div className="p-3 space-y-3">
      <button
        type="button"
        onClick={() => setFormOpen((open) => !open)}
        className="w-full text-xs text-accent hover:bg-accent/10 border border-rule rounded-md px-2 py-1.5"
      >
        {formOpen ? t('patterns.closeForm') : t('patterns.new')}
      </button>

      {formOpen && (
        <form
          onSubmit={(event) => void handleCreate(event)}
          className="space-y-2 bg-raised/40 border border-rule rounded-lg p-2.5"
        >
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('patterns.namePlaceholder')}
            aria-label={t('patterns.namePlaceholder')}
            className="w-full bg-raised border border-rule rounded-md px-2 py-1.5 text-sm text-paper placeholder-dim/60 focus:outline-none focus:border-accent"
          />
          <select
            value={tier}
            onChange={(event) => setTier(event.target.value as ModelTier)}
            aria-label={t('patterns.tierAria')}
            className="w-full bg-raised border border-rule rounded-md px-2 py-1.5 text-sm text-paper focus:outline-none focus:border-accent"
          >
            {TIERS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
          {formError !== null && (
            <p role="alert" className="text-xs text-verdict border border-verdict/40 rounded-md px-2 py-1.5 break-words">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || name.trim() === ''}
            className="w-full bg-accent text-onaccent text-sm font-medium rounded-md px-3 py-1.5 hover:bg-accent/85 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? t('patterns.creating') : t('patterns.create')}
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

      {patterns === null ? (
        <p className="text-sm text-dim">{t('patterns.loading')}</p>
      ) : patterns.length === 0 && listError === null ? (
        <p className="text-sm text-dim">{t('patterns.empty')}</p>
      ) : (
        <ul className="divide-y divide-rule/60 border border-rule rounded-lg">
          {patterns.map((pattern) => {
            // The backend allows duplicate names (known Issue B) — disambiguate by id.
            const duplicated =
              patterns.filter((candidate) => candidate.name === pattern.name).length > 1;
            return (
            <li key={pattern.id} className="px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-paper truncate">
                  {pattern.name}
                  {duplicated && (
                    <span className="font-mono text-[10px] text-dim/70"> #{pattern.id.slice(0, 8)}</span>
                  )}
                </span>
                <span className={`font-mono text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5 ${tierBadge[pattern.tier] ?? 'text-dim border-rule'}`}>
                  {pattern.tier}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-dim truncate">
                  {pattern.provider}/{pattern.model}
                </span>
                <button
                  type="button"
                  aria-label={t('patterns.deleteAria', { name: pattern.name })}
                  onClick={() => setConfirmingDelete(pattern.name)}
                  className="text-dim/70 hover:text-verdict p-0.5 shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              {confirmingDelete === pattern.name && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-dim flex-1">{t('patterns.deleteConfirm')}</span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(pattern.name)}
                    className="text-xs text-verdict border border-verdict/50 rounded-md px-2 py-0.5 hover:bg-verdict/10"
                  >
                    {t('patterns.delete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(null)}
                    className="text-xs text-dim hover:text-paper hover:bg-raised rounded-md px-2 py-0.5"
                  >
                    {t('patterns.keep')}
                  </button>
                </div>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default PatternsTab;
