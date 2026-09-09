import { formatFullTimestamp, toDate } from '../lib/time';

export default function EntryTimestamp({ value }: { value?: string }) {
  const date = toDate(value);
  return <time dateTime={date?.toISOString()} title={formatFullTimestamp(value)} className="font-mono text-[10px] tabular-nums text-dim">
    {date ? date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
  </time>;
}
