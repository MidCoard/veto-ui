import React, { useState } from 'react';
import { ApiError } from '../../api/client';
import type { PendingVeto } from '../../api/types';
import { en } from '../../i18n/en';
import type { MessageKey } from '../../i18n/en';
import { useI18n } from '../../i18n/I18nContext';
import type { Translate } from '../../i18n/I18nContext';
import EntryIcon from './EntryIcon';
import BusyIndicator from '../BusyIndicator';
import { ToolCallCard } from './ToolCards';

/** Inline approval card; tool details and available decisions remain visible. */
interface VetoPromptCardProps {
  veto: PendingVeto;
  onResolve: (option: string) => Promise<void>;
}

function isRefusal(option: string): boolean {
  return (
    option.includes('DECLINE') || option.includes('BLOCK') || option.includes('ABORT')
  );
}

/** Normalize API/network errors the same way every other surface does. */
function errorText(error: unknown, t: Translate): string {
  if (error instanceof ApiError) return error.message;
  return t('error.backendUnreachable');
}

/** ACCEPT_AND_MASK_WRITE → "Accept and mask write" — fallback for unknown future options. */
function humanize(option: string): string {
  return option.replace(/_/g, ' ').toLowerCase();
}

/** Localized label for a backend VetoOption name; humanized enum when no key exists. */
function optionLabel(option: string, t: Translate): string {
  const key = `veto.option.${option}` as MessageKey;
  return en[key] === undefined ? humanize(option) : t(key);
}

const VetoPromptCard: React.FC<VetoPromptCardProps> = ({ veto, onResolve }) => {
  const { t } = useI18n();
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (option: string): Promise<void> => {
    if (resolving) return;
    setResolving(true);
    setError(null);
    try {
      await onResolve(option);
    } catch (err) {
      setError(errorText(err, t));
      setResolving(false);
    }
  };

  // Danger banner: screening flagged this call as DANGEROUS/CRITICAL — surface it prominently so
  // the user sees the risk before choosing, not just the tool name.
  const dangerBanner =
    veto.danger === 'CRITICAL' ? (
      <p
        role="alert"
        className="text-xs font-semibold text-verdict bg-verdict/10 border border-verdict/50 rounded-md px-2.5 py-1.5"
      >
        {t('veto.warnCritical')}
      </p>
    ) : veto.danger === 'DANGEROUS' ? (
      <p
        role="alert"
        className="text-xs font-semibold text-verdict bg-verdict/10 border border-verdict/40 rounded-md px-2.5 py-1.5"
      >
        {t('veto.warnDangerous')}
      </p>
    ) : null;

  const footer = (
    <div className="space-y-1.5">
      {dangerBanner}
      <p className="text-xs text-dim">{t('veto.hint')}</p>
      <div className="flex flex-wrap gap-2">
        {veto.options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={resolving}
            onClick={() => void choose(option)}
            title={option}
            className={
              isRefusal(option)
                ? 'text-xs text-verdict border border-verdict/50 rounded-md px-2.5 py-1 hover:bg-verdict/10 disabled:opacity-50'
                : 'text-xs text-paper/80 border border-rule rounded-md px-2.5 py-1 hover:text-paper hover:border-dim/60 disabled:opacity-50'
            }
          >
            {optionLabel(option, t)}
          </button>
        ))}
      </div>
      {resolving && <BusyIndicator label={t('veto.resolving')} />}
      {error !== null && (
        <p role="alert" className="text-xs text-verdict break-words">
          {error}
        </p>
      )}
    </div>
  );

  return (
    <section className="ledger-enter my-2 overflow-hidden rounded-xl border border-rule bg-panel" aria-label={t('veto.awaitingConfirmation')}>
      <header className="flex items-center gap-3 border-b border-rule/60 px-4 py-3">
        <EntryIcon kind="tool" />
        <span className="text-sm font-medium text-paper">{t('veto.awaitingConfirmation')}</span>
        <span aria-hidden="true" className="ml-auto h-2 w-2 rounded-full bg-amber-400" />
      </header>
      <div className="p-3"><ToolCallCard toolName={veto.toolName} args={veto.args} /></div>
      <div className="border-t border-rule/60 bg-raised/20 px-4 py-3">{footer}</div>
    </section>
  );
};

export default VetoPromptCard;
