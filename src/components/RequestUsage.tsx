import TokenUsageTooltip from './TokenUsageTooltip';
import { tokenCount } from '../lib/cacheUsage';
import { useI18n } from '../i18n/I18nContext';

/** Comparable requests show net context growth; resets show the full input. */
export default function RequestUsage({ measurements }: { measurements?: unknown }) {
  const { t, lang } = useI18n();
  const calls = (Array.isArray(measurements) ? measurements : []).filter(value =>
    value && typeof value === 'object' && value.purpose !== 'compaction' && tokenCount(value.inputTokens) !== null);
  if (calls.length === 0) return null;
  const format = (value: number) => value.toLocaleString(lang);
  const first = calls[0];
  const comparable = Number.isSafeInteger(first.displayInputTokens);
  const label = `${t('usage.requestInput')}: ${format(comparable ? first.displayInputTokens : first.inputTokens)}`;
  return <TokenUsageTooltip label={label}>
    <div className="max-w-72 whitespace-normal">
      <ul className="mt-1 space-y-1">
        {calls.map((call, index) => {
          const cache = tokenCount(call.cacheReadInputTokens);
          return <li key={index}>
            <p>{t('usage.totalInput')}: {format(call.inputTokens)}</p>
            {cache !== null && cache <= call.inputTokens && <p>{t('usage.cacheRead')}: {format(cache)}</p>}
          </li>;
        })}
      </ul>
    </div>
  </TokenUsageTooltip>;
}
