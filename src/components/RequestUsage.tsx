import TokenUsageTooltip from './TokenUsageTooltip';
import { tokenCount } from '../lib/cacheUsage';
import { useI18n } from '../i18n/I18nContext';

/** Headline is the input growth over the previous comparable request; hover shows the request total and cache read. */
export default function RequestUsage({ measurements }: { measurements?: unknown }) {
  const { t, lang } = useI18n();
  const calls = (Array.isArray(measurements) ? measurements : []).filter(value =>
    value && typeof value === 'object' && value.affectsContext !== false
    && value.purpose !== 'compaction' && tokenCount(value.inputTokens) !== null);
  if (calls.length === 0) return null;
  const format = (value: number) => value.toLocaleString(lang);
  const first = calls[0];
  const total = tokenCount(first.inputTokens) ?? 0;
  const headline = first.baselineReset === false && Number.isSafeInteger(first.inputDeltaTokens) ? first.inputDeltaTokens : total;
  const cache = tokenCount(first.cacheReadInputTokens);
  const label = `${t('usage.input')}: ${format(headline)}`;
  return <TokenUsageTooltip label={label}>
    <div className="whitespace-nowrap">
      <p>{t('usage.totalInput')}: {format(total)}</p>
      <p>{t('usage.cacheRead')}: {cache === null ? '—' : format(cache)}</p>
    </div>
  </TokenUsageTooltip>;
}
