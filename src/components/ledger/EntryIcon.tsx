/** Semantic marks for actions and thoughts; assistant messages retain the Veto mark. */
export default function EntryIcon({ kind, live = false }: { kind: 'tool' | 'thought'; live?: boolean }) {
  return <svg aria-hidden="true" data-entry-icon={kind} className={`h-5 w-5 shrink-0 text-dim ${live ? 'motion-safe:animate-pulse' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {kind === 'tool'
      ? <path d="M14.5 6.5l3 3 3-3a6 6 0 01-7.8 7.8l-6.9 6.9a2.1 2.1 0 01-3-3l6.9-6.9A6 6 0 0117.5 3.5z" />
      : <><path d="M20 10c0 4-3.6 7-8 7-1 0-2-.2-3-.5L5 19l.7-4C4 13.7 3 12 3 10c0-4 3.7-7 8.5-7S20 6 20 10z" /><circle cx="3" cy="21" r="1" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></>}
  </svg>;
}
