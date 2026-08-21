import React, { useState } from 'react';
import { ApiError } from '../../api/client';
import type { PendingVeto } from '../../api/types';
import { en } from '../../i18n/en';
import type { MessageKey } from '../../i18n/en';
import { useI18n } from '../../i18n/I18nContext';
import type { Translate } from '../../i18n/I18nContext';
import VerdictStamp from '../VerdictStamp';
import { ToolCallRow } from './ToolCards';

/**
 * VetoPromptCard — the HITL surface. The agent parked a tool call on the
 * backend and waits for a human decision. The card renders inline in the
 * ledger stream (the VerdictStamp column marks it in place of a T tag — a
 * pending veto has no persisted turnNumber yet) and renders via the SAME
 * ToolCallRow a confirmed tool_call uses, so the tool card is identical before
 * and after resolution; the decision UI (hint + option buttons) is an additive
 * footer below the card. Option buttons are localized (veto.option.*); the raw enum
 * name stays on the button's title attribute. Refusal options render in
 * verdict red, approvals neutral. When the decision lands, the card is
 * replaced by the tool_call / tool_result turns its resolution persisted.
 */
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
                : 'text-xs text-paper/80 border border-rule rounded-md px-2.5 py-1 hover:text-paper hover:border-accent/50 disabled:opacity-50'
            }
          >
            {optionLabel(option, t)}
          </button>
        ))}
      </div>
      {resolving && <p className="text-xs text-dim">{t('veto.resolving')}</p>}
      {error !== null && (
        <p role="alert" className="text-xs text-verdict break-words">
          {error}
        </p>
      )}
    </div>
  );

  // Same bare ToolCallRow the confirmed tool_call uses; only the verdict-stamp tag + decision
  // footer differ, so the tool card renders identically before and after HITL resolution.
  return (
    <ToolCallRow
      tag={
        <span className="w-12 shrink-0 pt-0.5 select-none self-start flex justify-end">
          <VerdictStamp verdict="PENDING" />
        </span>
      }
      toolName={veto.toolName}
      args={veto.args}
      footer={footer}
    />
  );
};

export default VetoPromptCard;
