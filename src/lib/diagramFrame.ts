import mermaid from 'mermaid';
import { diagramFailure } from './diagramPolicy';

// Runs only in an opaque-origin sandbox. No application state is imported here.
let busy = false;
window.addEventListener('message', async (event: MessageEvent) => {
  if (event.source !== parent || busy) return;
  const data = event.data;
  if (data?.kind !== 'render' || typeof data.id !== 'string' || typeof data.code !== 'string') return;
  const failure = diagramFailure(data.code);
  if (failure) { parent.postMessage({ kind: 'result', id: data.id, failure }, '*'); return; }
  busy = true;
  try {
    mermaid.initialize({
      startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true,
      theme: data.theme === 'dark' ? 'dark' : 'default',
      fontFamily: 'Arial, sans-serif', htmlLabels: false,
      flowchart: { htmlLabels: false }, maxTextSize: 16384, maxEdges: 200,
      secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'maxEdges',
        'suppressErrorRendering', 'htmlLabels', 'flowchart', 'theme', 'themeCSS',
        'themeVariables', 'fontFamily', 'altFontFamily'],
    });
    const { svg } = await mermaid.render('diagram', data.code);
    if (svg.length > 2 * 1024 * 1024) throw new Error('size');
    parent.postMessage({ kind: 'result', id: data.id, svg }, '*');
  } catch {
    parent.postMessage({ kind: 'result', id: data.id, failure: 'error' }, '*');
  } finally {
    document.body.replaceChildren();
    busy = false;
  }
});
parent.postMessage({ kind: 'ready' }, '*');
