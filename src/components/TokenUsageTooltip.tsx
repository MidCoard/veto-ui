import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Shared call details, reachable by pointer, keyboard and touch. */
export default function TokenUsageTooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const cancelHide = () => clearTimeout(hideTimer.current);
  const hideSoon = () => { cancelHide(); hideTimer.current = setTimeout(() => setOpen(false), 150); };
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, bottom: 0, maxHeight: 300 });
  const show = () => {
    cancelHide();
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 200)), bottom: window.innerHeight - rect.top + 6, maxHeight: Math.max(80, rect.top - 14) });
    setOpen(true);
  };
  useLayoutEffect(() => {
    if (!open) return;
    const rect = trigger.current?.getBoundingClientRect();
    if (rect && rect.top < 100) setPosition(value => ({ ...value, bottom: Math.max(8, window.innerHeight - rect.bottom - Math.min(300, window.innerHeight - rect.bottom - 8)), maxHeight: Math.max(80, window.innerHeight - rect.bottom - 16) }));
  }, [open]);
  useEffect(() => () => cancelHide(), []);
  useEffect(() => {
    if (!open) return;
    const dismiss = () => setOpen(false);
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !trigger.current?.contains(event.target) && !popup.current?.contains(event.target)) dismiss();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
    window.addEventListener('resize', dismiss);
    const scroll = (event: Event) => { if (!(event.target instanceof Node) || !popup.current?.contains(event.target)) dismiss(); };
    document.addEventListener('scroll', scroll, true);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { window.removeEventListener('resize', dismiss); document.removeEventListener('scroll', scroll, true); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <span className="inline-flex shrink-0 items-center leading-4" onMouseLeave={() => { if (document.activeElement !== trigger.current) hideSoon(); }}>
    <button ref={trigger} type="button" aria-describedby={open ? id : undefined}
      onMouseEnter={show} onFocus={show} onBlur={() => setOpen(false)} onClick={show}
      className="font-mono text-[10px] leading-4 whitespace-nowrap text-dim tabular-nums rounded cursor-help hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">{label}</button>
    {open && createPortal(<div ref={popup} id={id} role="tooltip" style={position} onMouseEnter={cancelHide} onMouseLeave={hideSoon}
      className="fixed z-[100] w-max max-w-[calc(100vw-16px)] overflow-y-auto rounded border border-rule bg-raised px-2 py-1 font-mono text-[11px] leading-4 text-paper shadow-sm">{children}</div>, document.body)}
  </span>;
}
