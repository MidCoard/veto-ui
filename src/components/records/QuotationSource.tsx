import { useEffect, useRef } from 'react';
import type { SessionRecord } from '../../api/types';
import type { RecordLocation } from '../../state/RecordNavigation';
import { useI18n } from '../../i18n/I18nContext';

export function quotationSource(record: SessionRecord, location: RecordLocation): string | null {
  if (record.agentId !== location.agent || record.turnNumber !== location.turn) return null;
  let text: unknown;
  if (location.field.startsWith('json:')) {
    try {
      const path: unknown = JSON.parse(location.field.slice(5));
      if (!Array.isArray(path) || !path.length || path.length > 25 || !path.every(key => typeof key === 'string')
        || !['content', 'feedback', 'response', 'args'].includes(path[0])) return null;
      let value: unknown = record.payload;
      for (const key of path) {
        if (typeof value === 'string') value = JSON.parse(value);
        if (value === null || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, key)) return null;
        value = (value as Record<string, unknown>)[key];
      }
      text = typeof value === 'string' ? value : JSON.stringify(value);
    } catch { return null; }
  }
  else if (['content', 'feedback', 'response'].includes(location.field)) text = record.payload[location.field];
  else {
    const field = /^evidence\[(\d+)\]\.quote$/.exec(location.field);
    if (!field || record.type !== 'TOOL_RESPONSE' || typeof record.payload.content !== 'string') return null;
    try {
      let value = JSON.parse(record.payload.content);
      if (value && typeof value.content === 'string' && value.format) value = JSON.parse(value.content);
      text = value?.evidence?.[Number(field[1])]?.quote;
    } catch { return null; }
  }
  if (typeof text !== 'string' || !Number.isInteger(location.start) || !Number.isInteger(location.end)
    || location.start < 0 || location.end <= location.start || location.end > text.length
    || text.slice(location.start, location.end) !== location.text) return null;
  return text;
}

export default function QuotationSource({ record, location }: { record: SessionRecord; location: RecordLocation }) {
  const { t } = useI18n();
  const mark = useRef<HTMLElement>(null);
  const text = quotationSource(record, location);
  useEffect(() => { if (text !== null) { mark.current?.scrollIntoView?.({ block: 'center' }); mark.current?.focus({ preventScroll: true }); } }, [location, text]);
  return <section aria-label={t('quote.sourceText')} className="quotation-source rounded-md p-4">
    <h2 className="mb-3 flex items-center gap-2 border-b border-rule pb-3 text-sm font-medium text-paper"><span aria-hidden="true" className="font-serif text-2xl leading-none text-dim">“</span>{t('quote.sourceText')}</h2>
    {text === null ? <p role="alert" className="text-sm text-dim">{t('quote.sourceChanged')}</p> :
      <p className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-paper">{text.slice(0, location.start)}<mark ref={mark} tabIndex={-1} className="quotation-highlight">{text.slice(location.start, location.end)}</mark>{text.slice(location.end)}</p>}
  </section>;
}
