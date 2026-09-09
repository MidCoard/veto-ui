import type { TokenUsage } from '../lib/tokenUsage';
import { useI18n } from '../i18n/I18nContext';

export default function TokenUsageLine({ usage }: { usage?: TokenUsage }) {
  const { t } = useI18n();
  const format = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString();
  return <span role="status" aria-label={t('status.tokens')} className="inline-flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums text-dim">
    <span>{t('status.tokensUsed')}: {format(usage?.total)}</span>
    <span>{t('status.contextTokens')}: {format(usage?.context)} / {format(usage?.max)}</span>
  </span>;
}
