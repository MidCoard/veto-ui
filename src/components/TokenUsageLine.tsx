import type { TokenUsage } from '../lib/tokenUsage';
import { useI18n } from '../i18n/I18nContext';

/** One compact summary, with exact values available by keyboard or pointer. */
export default function TokenUsageLine({ usage }: { usage?: TokenUsage }) {
  const { t, lang } = useI18n();
  const format = (value: number | null | undefined, compact = false) => value == null ? '—'
    : value.toLocaleString(lang, compact ? { notation: 'compact', maximumFractionDigits: 1 } : undefined);
  const contextRatio = usage?.context != null && usage.max != null && usage.max > 0
    ? (usage.context / usage.max).toLocaleString(lang, { style: 'percent', maximumFractionDigits: 1 }) : '—';
  const cache = usage?.cache;
  const cacheRatio = cache?.read != null && cache.input > 0
    ? (cache.read / cache.input).toLocaleString(lang, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—';
  return <details aria-label={t('status.tokens')} className="group min-w-0 flex-1 text-[11px] text-dim">
    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-end gap-x-3 gap-y-1 rounded py-1 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <span>{t('usage.totalShort')}</span><span className="font-mono tabular-nums text-paper/85">{format(usage?.total, true)}</span>
      </span>
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <span>{t('status.contextTokens')}</span><span className="font-mono tabular-nums text-paper/85">{contextRatio}</span>
      </span>
      <svg aria-hidden="true" className="h-3 w-3 shrink-0 group-open:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="m3 4.5 3 3 3-3" /></svg>
      <span className="sr-only">{t('usage.expandDetails')}</span>
    </summary>
    <dl className="mt-1 border-t border-rule pt-1 leading-5">
      <div className="flex flex-wrap gap-x-1.5"><dt>{t('status.tokensUsed')}:</dt><dd className="min-w-0 break-words font-mono tabular-nums">{format(usage?.total)}</dd></div>
      <div className="flex flex-wrap gap-x-1.5"><dt>{t('status.contextTokens')}:</dt><dd className="min-w-0 break-words font-mono tabular-nums">{format(usage?.context)} / {format(usage?.max)}</dd></div>
      <div className="flex flex-wrap gap-x-1.5" title={t('usage.cacheHelp')}><dt>{t('usage.cacheRatio')}:</dt><dd className="font-mono tabular-nums">{cacheRatio}</dd></div>
    </dl>
  </details>;
}
