import { formatFullTimestamp, toDate } from '../lib/time';
import { useI18n } from '../i18n/I18nContext';

export default function EntryTimestamp({ value }: { value?: string }) {
  const { lang } = useI18n();
  const date = toDate(value);
  return <time dateTime={date?.toISOString()} title={formatFullTimestamp(value, lang)} className="min-w-0 truncate font-mono text-[10px] leading-4 tabular-nums text-dim">
    {date ? date.toLocaleString(lang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
  </time>;
}
