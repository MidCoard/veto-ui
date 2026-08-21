import React from 'react';

/**
 * VerdictStamp — the signature element of the Audit Ledger.
 * A small uppercase Space Mono chip with a double keyline (border + outline
 * offset by 2px), rotated -2deg, like a rubber stamp landing on a page.
 *
 * Use sparingly: gateway results and exchange completion only.
 */
export type Verdict = 'PASS' | 'VETOED' | 'REDACTED' | 'PENDING';

interface VerdictStampProps {
  verdict: Verdict;
  className?: string;
}

const verdictStyles: Record<Verdict, string> = {
  PASS: 'border-pass text-pass outline-pass bg-pass/10',
  VETOED: 'border-verdict text-verdict outline-verdict bg-verdict/10',
  REDACTED: 'border-verdict text-verdict outline-verdict bg-verdict/10',
  PENDING: 'border-accent text-accent outline-accent bg-accent/10',
};

const VerdictStamp: React.FC<VerdictStampProps> = ({ verdict, className = '' }) => {
  return (
    <span
      className={[
        'inline-block select-none px-2 py-0.5 rounded-[3px]',
        'font-display text-[11px] font-bold uppercase tracking-widest',
        'border outline outline-1 outline-offset-2',
        '-rotate-2',
        verdictStyles[verdict],
        className,
      ].join(' ')}
    >
      {verdict}
    </span>
  );
};

export default VerdictStamp;
