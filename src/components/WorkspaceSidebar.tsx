import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n/I18nContext';

const MIN_WIDTH = 220;
const MAX_WIDTH = 420;
const MIN_CENTER_WIDTH = 320;

/** Keep the conversation usable while resizing the workspace rail. */
export default function WorkspaceSidebar({ open, inspectorVisible, children }: {
  open: boolean;
  inspectorVisible: boolean;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const asideRef = useRef<HTMLElement>(null);
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(null);
  const [preferredWidth, setPreferredWidth] = useState(280);
  const [maxWidth, setMaxWidth] = useState(MAX_WIDTH);
  const width = Math.min(preferredWidth, maxWidth);
  const clamp = (value: number) => Math.max(MIN_WIDTH, Math.min(maxWidth, value));

  useLayoutEffect(() => {
    const parent = asideRef.current?.parentElement;
    if (!parent) return;
    const measure = () => {
      const available = parent.getBoundingClientRect().width;
      const inspectorWidth = inspectorVisible && window.innerWidth >= 1024 ? 320 : 0;
      setMaxWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, available - inspectorWidth - MIN_CENTER_WIDTH - 6)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [inspectorVisible]);

  return (
    <>
      <aside
        ref={asideRef}
        id="workspace-sidebar"
        style={{ width: `min(${width}px, 85vw)` }}
        className={`shrink-0 bg-panel z-30 fixed top-12 bottom-0 left-0 md:static ${open ? 'block' : 'hidden md:block'}`}
      >
        {children}
      </aside>
      <div
        role="separator"
        aria-label={t('rail.resizeWorkspace')}
        aria-orientation="vertical"
        aria-controls="workspace-sidebar"
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={maxWidth}
        aria-valuenow={width}
        tabIndex={0}
        title={t('rail.resizeWorkspace')}
        className="relative z-30 hidden w-1.5 shrink-0 cursor-col-resize touch-none select-none bg-rule/50 hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none md:block"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pointerId: event.pointerId, x: event.clientX, width };
        }}
        onPointerMove={(event) => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          setPreferredWidth(clamp(drag.current.width + event.clientX - drag.current.x));
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          drag.current = null;
        }}
        onPointerCancel={() => { drag.current = null; }}
        onLostPointerCapture={() => { drag.current = null; }}
        onDoubleClick={() => setPreferredWidth(clamp(280))}
        onKeyDown={(event) => {
          const next = event.key === 'ArrowLeft' ? width - 16
            : event.key === 'ArrowRight' ? width + 16
              : event.key === 'Home' ? MIN_WIDTH
                : event.key === 'End' ? maxWidth : null;
          if (next === null) return;
          event.preventDefault();
          setPreferredWidth(clamp(next));
        }}
      />
    </>
  );
}
