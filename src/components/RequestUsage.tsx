import TokenUsageTooltip from './TokenUsageTooltip';
import { tokenCount } from '../lib/cacheUsage';
import { useI18n } from '../i18n/I18nContext';

interface Props { measurements?: unknown; delta?: number | null; deltaSource?: string | null; initialInput?: boolean }

export default function RequestUsage({ measurements, delta, deltaSource, initialInput = false }: Props) {
  const { t, lang } = useI18n();

  const calls = (Array.isArray(measurements) ? measurements : []).filter(value => value && typeof value === 'object' && tokenCount(value.inputTokens) !== null);
  const difference = calls.find(value => value.inputDeltaSource === 'request_difference' && Number.isSafeInteger(value.inputDeltaTokens));
  const ownTokens = initialInput ? tokenCount(calls[0]?.inputTokens) : difference?.inputDeltaTokens ?? (deltaSource === 'measured' ? tokenCount(delta) : null);
  const latest = initialInput ? calls[0] : difference ?? calls[calls.length - 1];
  const label = `${t('usage.input')}: ${ownTokens === null ? '—' : ownTokens.toLocaleString(lang)}`;
  if (ownTokens === null) return null;
  // A zero request cache proves zero cache for its input portions. A nonzero total
  // does not identify which message was cached.
  const cacheKnownZero = ownTokens !== null && ownTokens >= 0 && latest?.cacheReadInputTokens === 0;
  const cacheRead = initialInput ? tokenCount(latest?.cacheReadInputTokens) : cacheKnownZero ? 0 : null;
  if (cacheRead === null || cacheRead > ownTokens) return <span className="shrink-0 whitespace-nowrap font-mono text-[10px] leading-4 tabular-nums text-dim">{label}</span>;
  return <TokenUsageTooltip label={label}>{t('usage.cacheRead')}: {cacheRead.toLocaleString(lang)}</TokenUsageTooltip>;
}
