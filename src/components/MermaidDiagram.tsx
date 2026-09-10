import { useEffect, useId, useState } from 'react';
import CodeHighlight from './CodeHighlight';
import Modal from './Modal';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../lib/theme';
import { diagramFailure, type DiagramFailure } from '../lib/diagramPolicy';
import { DiagramError, renderDiagram, type DiagramResult } from '../lib/diagramRenderer';
import { diagramErrorDetail } from '../lib/diagramErrorDetail';

export default function MermaidDiagram({ code, isStreaming, autoRender = true }: {
  code: string; isStreaming: boolean; autoRender?: boolean;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const descriptionId = useId();
  const [requested, setRequested] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; diagram?: DiagramResult; failure?: DiagramFailure; detail?: string }>();
  const [showSource, setShowSource] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const [zoom, setZoom] = useState(1);
  const key = `${theme}:${code}`;
  const blocked = diagramFailure(code);
  const enabled = autoRender || requested;

  useEffect(() => {
    if (isStreaming || blocked || !enabled) return;
    const controller = new AbortController();
    void renderDiagram(code, theme, controller.signal).then(
      (diagram) => { if (!controller.signal.aborted) setResult({ key, diagram }); },
      (error: unknown) => {
        if (!controller.signal.aborted) setResult({
          key,
          failure: error instanceof DiagramError ? error.reason : 'error',
          detail: diagramErrorDetail(error instanceof DiagramError ? error.detail : error),
        });
      },
    );
    return () => controller.abort();
  }, [code, theme, key, isStreaming, blocked, enabled, attempt]);

  const current = !isStreaming && result?.key === key ? result : undefined;
  const failure = !isStreaming ? blocked ?? current?.failure : undefined;
  const diagram = current?.diagram;
  const title = diagram?.title || t('diagram.alt');
  const surface = theme === 'dark' ? '#1f2020' : '#ffffff';
  const picture = (expanded: boolean) => diagram && (
    <div className="overflow-auto p-4" style={{ background: surface, maxHeight: expanded ? '72dvh' : '32rem' }}>
      <img src={diagram.image} alt={title} aria-describedby={diagram.description ? descriptionId : undefined}
        className="block mx-auto" style={{ width: expanded && zoom !== 1 ? (diagram.width ?? 600) * zoom : (diagram.width ?? 'auto'), maxWidth: expanded && zoom !== 1 ? 'none' : '100%' }} />
    </div>
  );
  return (
    <figure className="my-3 rounded border border-rule overflow-hidden bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-b border-rule">
        <span className="text-xs text-dim">{title}</span>
        <div className="flex gap-3">
          {diagram && <button type="button" className="ui-button text-xs text-accent" onClick={() => { setZoom(1); setEnlarged(true); }}>{t('diagram.enlarge')}</button>}
          <button type="button" className="ui-button text-xs text-accent" aria-pressed={showSource} onClick={() => setShowSource(!showSource)}>
            {t(showSource ? 'diagram.preview' : 'diagram.source')}
          </button>
        </div>
      </div>
      {!enabled && !isStreaming && !failure && <button type="button" className="ui-button m-3 text-sm text-accent" onClick={() => setRequested(true)}>{t('diagram.render')}</button>}
      {(isStreaming || (!current && !failure && enabled)) && <p role="status" className="px-3 py-2 text-sm text-dim">{t(isStreaming ? 'diagram.streaming' : 'diagram.loading')}</p>}
      {failure && <p role="status" className="px-3 py-2 text-sm text-dim">{t(`diagram.${failure}`)}</p>}
      {failure && current?.detail && <div className="px-3 pb-3 text-sm text-dim">
        <p className="mb-1 font-medium">{t('diagram.reason')}</p>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{current.detail}</pre>
      </div>}
      {failure === 'timeout' && <button type="button" className="ui-button m-3 text-sm text-accent" onClick={() => { setResult(undefined); setAttempt(attempt + 1); }}>{t('diagram.render')}</button>}
      {diagram && !showSource && picture(false)}
      {diagram?.description && <figcaption id={descriptionId} className="px-3 py-2 text-sm text-dim">{diagram.description}</figcaption>}
      {(showSource || failure || isStreaming || !enabled) && <CodeHighlight code={code} language="mermaid" />}
      {enlarged && diagram && <Modal wide title={title} closeLabel={t('diagram.close')} onClose={() => setEnlarged(false)}>
        <div className="flex gap-3 p-3">
          <button type="button" className="ui-button" disabled={zoom <= 0.5} onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}>{t('diagram.zoomOut')}</button>
          <button type="button" className="ui-button" onClick={() => setZoom(1)}>{t('diagram.fit')}</button>
          <button type="button" className="ui-button" disabled={zoom >= 3} onClick={() => setZoom(Math.min(3, zoom + 0.25))}>{t('diagram.zoomIn')}</button>
        </div>
        {picture(true)}
      </Modal>}
    </figure>
  );
}
