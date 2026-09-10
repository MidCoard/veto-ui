import { diagramFailure, type DiagramFailure } from './diagramPolicy';
import type { Theme } from './theme';
import { diagramErrorDetail } from './diagramErrorDetail';

export interface DiagramResult { image: string; title: string; description: string; width?: number }
export class DiagramError extends Error {
  constructor(public readonly reason: DiagramFailure, public readonly detail?: string) { super(detail ?? reason); }
}

let queue: Promise<unknown> = Promise.resolve();

/** One render at a time; each job gets its own DOM and finite lifetime. */
export function renderDiagram(code: string, theme: Theme, signal?: AbortSignal): Promise<DiagramResult> {
  const run = queue.then(() => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const failure = diagramFailure(code);
    if (failure) throw new DiagramError(failure);
    return new Promise<DiagramResult>((resolve, reject) => {
      const frame = document.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      frame.style.cssText = 'position:fixed;left:0;top:0;width:1200px;height:900px;opacity:0;pointer-events:none;border:0';
      const id = crypto.randomUUID();
      const nonce = crypto.randomUUID();
      const script = import.meta.env.DEV ? '/src/lib/diagramFrame.ts' : `${import.meta.env.BASE_URL}diagram-renderer.js`;
      const scriptUrl = new URL(script, location.href);
      const csp = `default-src 'none'; script-src 'nonce-${nonce}' ${scriptUrl.origin}; style-src 'unsafe-inline'; img-src data: blob:; font-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'`;
      frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"></head><body><script nonce="${nonce}" ${import.meta.env.DEV ? 'type="module"' : ''} src="${scriptUrl.href}"></script></body></html>`;
      const clean = () => {
        clearTimeout(timer);
        window.removeEventListener('message', receive);
        signal?.removeEventListener('abort', abort);
        frame.remove();
      };
      const fail = (error: Error) => { clean(); reject(error); };
      const abort = () => fail(new DOMException('Aborted', 'AbortError'));
      let sent = false;
      const receive = (event: MessageEvent) => {
        if (event.source !== frame.contentWindow || event.origin !== 'null') return;
        if (event.data?.kind === 'ready' && !sent) {
          sent = true;
          clearTimeout(timer);
          timer = setTimeout(() => fail(new DiagramError('timeout')), 5000);
          frame.contentWindow?.postMessage({ kind: 'render', id, code, theme }, '*');
          return;
        }
        const data = event.data;
        if (!sent || data?.kind !== 'result' || data.id !== id) return;
        if (data.failure) {
          const reason: DiagramFailure = ['unsupported', 'unsafe', 'size', 'timeout', 'error'].includes(data.failure) ? data.failure : 'error';
          fail(new DiagramError(reason, diagramErrorDetail(data.detail)));
          return;
        }
        if (typeof data.svg !== 'string') { fail(new DiagramError('error')); return; }
        if (data.svg.length > 2 * 1024 * 1024) { fail(new DiagramError('size')); return; }
        const svg = new DOMParser().parseFromString(data.svg, 'image/svg+xml');
        if (svg.documentElement.localName !== 'svg' || svg.querySelector('parsererror, script, foreignObject, image')) {
          fail(new DiagramError('error')); return;
        }
        // Never insert renderer output into the host document. SVG images are passive.
        const box = svg.documentElement.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
        const width = box?.[2];
        const height = box?.[3];
        if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height) || width > 32768 || height > 32768) {
          fail(new DiagramError('size')); return;
        }
        svg.documentElement.setAttribute('width', String(width));
        svg.documentElement.setAttribute('height', String(height));
        const normalized = new XMLSerializer().serializeToString(svg.documentElement);
        const result = {
          image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(normalized)}`,
          width,
          title: svg.querySelector('title')?.textContent ?? '',
          description: svg.querySelector('desc')?.textContent ?? '',
        };
        clean(); resolve(result);
      };
      let timer = setTimeout(() => fail(new DiagramError('timeout')), 20000);
      window.addEventListener('message', receive);
      signal?.addEventListener('abort', abort, { once: true });
      document.body.append(frame);
    });
  });
  queue = run.catch(() => undefined);
  return run;
}
