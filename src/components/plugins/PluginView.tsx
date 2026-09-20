import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import type { PluginAction, PluginLabel, PluginNode, PluginView } from '../../api/pluginViews';
import { useI18n } from '../../i18n/I18nContext';

/** Generic UI interpreter: plugin data owns content, actions, and transient-view policy. */
export default function PluginViewRenderer({ initialView, invoke }: { initialView: PluginView; invoke: (action: string, signal: AbortSignal) => Promise<PluginView> }) {
  const { t, lang } = useI18n();
  const [result, setResult] = useState<PluginView>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'unavailable' | 'failed'>();
  const request = useRef<AbortController>();
  const view = result ?? initialView;
  function reset() { request.current?.abort(); setResult(undefined); setBusy(false); setError(undefined); }
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!view.resetOnHidden) return;
    const hidden = () => { if (document.visibilityState === 'hidden') reset(); };
    hidden();
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, [view]);
  useEffect(() => {
    if (view.resetAfterMillis <= 0) return;
    const timer = window.setTimeout(reset, view.resetAfterMillis);
    return () => clearTimeout(timer);
  }, [view]);
  async function dispatch(action: PluginAction) {
    if (action.target === 'RESET') { reset(); return; }
    if (busy || action.target !== 'SERVER') return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(undefined);
    try {
      const next = await invoke(action.id, controller.signal);
      if (!controller.signal.aborted) setResult(next);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof ApiError && failure.status === 410 ? 'unavailable' : 'failed');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const label = (value: PluginLabel) => value.translations[lang] ?? value.fallback;
  function render(node: PluginNode, key: string): React.ReactNode {
    switch (node.type) {
      case 'text': return <span key={key} className="whitespace-pre-wrap break-all select-text">{label(node.text)}</span>;
      case 'button': return <button key={key} type="button" className="ui-button rounded px-1 text-accent hover:bg-raised disabled:cursor-default disabled:text-dim" disabled={busy} onClick={() => dispatch(node.action)}>{label(node.label)}</button>;
      case 'group': return <span key={key} className={`inline-flex max-w-full gap-1 ${node.direction === 'COLUMN' ? 'flex-col' : 'flex-wrap items-center'}`}>{node.children.map((child, index) => render(child, `${key}-${index}`))}</span>;
      default: return null;
    }
  }
  return <span aria-busy={busy} className="inline-flex max-w-full flex-wrap items-center gap-1 rounded border border-rule bg-panel px-1.5 py-0.5 align-baseline text-sm" onKeyDown={event => { if (event.key === 'Escape') reset(); }}>
    {view.content.map((node, index) => render(node, String(index)))}
    {busy && <span role="status" className="sr-only">{t('pluginReference.loading')}</span>}
    {error && <span role="alert" className="text-verdict">{t(error === 'unavailable' ? 'pluginReference.unavailable' : 'pluginReference.failed')}</span>}
  </span>;
}
