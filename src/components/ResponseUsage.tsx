import type { ModelCallUsage } from '../lib/modelCallUsage';
import { useI18n } from '../i18n/I18nContext';

export default function ResponseUsage({ usage, runtimeOutputTokens }: { usage?: ModelCallUsage; runtimeOutputTokens?: number }) {
  const { t, lang } = useI18n();
  const output = usage?.outputTokens ?? runtimeOutputTokens;
  return <span className="shrink-0 whitespace-nowrap font-mono text-[10px] leading-4 tabular-nums text-dim">{t('usage.output')}: {output == null ? '—' : output.toLocaleString(lang)}</span>;
}
