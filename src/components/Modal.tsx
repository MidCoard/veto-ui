import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Native modal dialogs live in the browser top layer, above all app stacking contexts. */
export default function Modal({ title, closeLabel, onClose, children, wide = false }: {
  wide?: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current!;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
      className={`m-auto max-h-[90dvh] w-[calc(100%-2rem)] ${wide ? 'max-w-6xl' : 'max-w-xl'} overflow-y-auto rounded-xl border border-rule bg-panel p-0 text-paper shadow-2xl backdrop:bg-black/60`}
    >
      <div className="flex items-center justify-between gap-4 border-b border-rule px-4 py-3">
        <h2 id={titleId} className="font-display text-sm">{title}</h2>
        <button type="button" onClick={onClose} className="ui-button rounded-md px-2 py-1 text-xs text-dim hover:bg-raised hover:text-paper">
          {closeLabel}
        </button>
      </div>
      {children}
    </dialog>,
    document.body,
  );
}
