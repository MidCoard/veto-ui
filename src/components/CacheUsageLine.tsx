import type { CacheUsage } from '../lib/cacheUsage';
import { useI18n } from '../i18n/I18nContext';

export default function CacheUsageLine({ usage, total = false }: { usage: CacheUsage; total?: boolean }) {
  const { t, lang } = useI18n();
  const format = (value: number) => value.toLocaleString(lang);
  const ratio = usage.read === null || usage.input === 0 ? '—'
    : (usage.read / usage.input).toLocaleString(lang, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return <span className="inline-flex flex-wrap gap-x-3 gap-y-1" title={t('usage.cacheHelp')}>
    <span>{t(total ? 'usage.cacheTotal' : 'usage.cacheRead')}: {usage.read === null ? t('usage.unavailable') : format(usage.read)}</span>
    <span>{t('usage.cacheRatio')}: {ratio}</span>
    {total && usage.reportedCalls < usage.totalCalls && <span>{t('usage.cacheCoverage', { reported: format(usage.reportedCalls), total: format(usage.totalCalls) })}</span>}
  </span>;
}
