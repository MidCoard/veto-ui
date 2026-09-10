import { RecordNavigation } from '../state/RecordNavigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiRequest } from '../api/client';
import { useI18n } from '../i18n/I18nContext';

export type QuoteOrigin = { session: string; agent: string; turn: number };
type Match = { turn: number; kind: string; field: string; url: string; method: string; excerpt: string; highlightStart: number; highlightEnd: number; sourceStart: number; sourceEnd: number };
type Check = { id: string; references?: { messageIndex: number; status: string }[]; status: 'matched' | 'not_found' | 'ambiguous' | 'unavailable'; matches: Match[] };
const QuoteContext = createContext<{ checks: Check[] | null; failed: boolean; enabled: boolean; origin?: QuoteOrigin }>({ checks: null, failed: false, enabled: false });

export function QuoteChecks({ origin, body, streaming, children }: { origin?: QuoteOrigin; body: string; streaming: boolean; children: ReactNode }) {
  const key = origin ? `${origin.session}/${origin.agent}/${origin.turn}/${body}` : '';
  const [result, setResult] = useState<{ key: string; checks: Check[] | null; failed: boolean } | null>(null);
  useEffect(() => {
    if (!origin || streaming || !/\]\(cite:[A-Za-z0-9_-]{1,64}\)/.test(body)) return;
    const controller = new AbortController();
    const { session, agent, turn } = origin;
    void apiRequest<Check[]>(`/api/sessions/${encodeURIComponent(session)}/agents/${encodeURIComponent(agent)}/records/${turn}/quote-check`, { method: 'POST', body: { body }, signal: controller.signal, timeoutMs: 12_000 })
      .then(checks => { if (!controller.signal.aborted) setResult({ key, checks, failed: false }); })
      .catch(() => { if (!controller.signal.aborted) setResult({ key, checks: null, failed: true }); });
    return () => controller.abort();
  }, [key, streaming]);
  const current = result?.key === key ? result : null;
  return <QuoteContext.Provider value={{ checks: current?.checks ?? null, failed: current?.failed ?? false, enabled: origin !== undefined && !streaming, origin }}>{children}</QuoteContext.Provider>;
}

export function ActiveCitation({ id, children }: { id: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { checks, failed, enabled, origin } = useContext(QuoteContext);
  const { t } = useI18n();
  const navigate = useContext(RecordNavigation);
  const check = checks?.find(item => item.id === id);
  const status = !enabled || failed ? 'unavailable' : checks === null ? 'pending' : check?.status ?? 'unavailable';
  return <span className="relative">
    <button type="button" className="text-accent underline underline-offset-2" aria-expanded={open} onClick={() => setOpen(!open)}>{children}</button>
    {open && <span className="block rounded border border-rule bg-panel p-3 not-italic text-xs" aria-live="polite">
      {check?.matches.length && check.references?.some(ref => ref.status !== 'matched') ? <span className="block mb-2">{t('quote.partial')}</span> : null}
      {!check?.matches.length ? <span>{t(`quote.${status}`)}</span> : <span>
        <span className="text-accent">{t(check.status === 'ambiguous' ? 'quote.ambiguous' : check.matches[0].kind === 'web' ? 'quote.web' : 'quote.conversation')}</span>
        {check.matches.map((match, index) => <span key={index} className="block my-2 rounded border border-rule p-2">
          {navigate && origin && <button type="button" className="ui-button mb-2 text-accent underline underline-offset-2" onClick={() => navigate({ session: origin.session, agent: origin.agent, turn: match.turn, field: match.field, start: match.sourceStart, end: match.sourceEnd, text: match.excerpt.slice(match.highlightStart, match.highlightEnd) })}>{t(match.kind === 'web' ? 'quote.openWebSource' : 'quote.openMessage')}</button>}
          <span className="block whitespace-pre-wrap break-words text-paper">{match.excerpt.slice(0, match.highlightStart)}<mark className="quotation-highlight">{match.excerpt.slice(match.highlightStart, match.highlightEnd)}</mark>{match.excerpt.slice(match.highlightEnd)}</span>
          {/^https?:\/\//i.test(match.url) && <a className="mt-2 block break-all text-accent underline" href={match.url} target="_blank" rel="noopener noreferrer">{match.url}</a>}
        </span>)}
      </span>}
    </span>}
  </span>;
}
