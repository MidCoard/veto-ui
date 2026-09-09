import { describe, expect, it, vi } from 'vitest';
import { renderDiagram } from './diagramRenderer';

async function ready() {
  await vi.waitFor(() => expect(document.querySelector('iframe')).not.toBeNull());
  const frame = document.querySelector('iframe')!;
  const send = vi.spyOn(frame.contentWindow!, 'postMessage');
  window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow!, origin: 'null', data: { kind: 'ready' } }));
  return { frame, id: send.mock.calls[0][0].id as string };
}

describe('isolated diagram renderer', () => {
  it('checks message sender and job id, then returns an image and removes the frame', async () => {
    const pending = renderDiagram('flowchart LR\nA --> B', 'dark');
    const { frame, id } = await ready();
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.srcdoc).toContain("connect-src 'none'");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><title>Flow</title><desc>A leads to B</desc></svg>';
    window.dispatchEvent(new MessageEvent('message', { source: window, origin: 'null', data: { kind: 'result', id, svg } }));
    expect(document.querySelector('iframe')).toBe(frame);
    window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow!, origin: 'null', data: { kind: 'result', id: 'wrong', svg } }));
    expect(document.querySelector('iframe')).toBe(frame);
    window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow!, origin: 'null', data: { kind: 'result', id, svg } }));
    expect(await pending).toMatchObject({ title: 'Flow', description: 'A leads to B', width: 200 });
    expect(document.querySelector('iframe, svg')).toBeNull();
  });

  it('releases an in-flight frame when the message changes', async () => {
    const controller = new AbortController();
    const pending = renderDiagram('flowchart LR\nA --> B', 'light', controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await ready();
    controller.abort();
    await rejected;
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('rejects active SVG output without mounting it', async () => {
    const pending = renderDiagram('flowchart LR\nA --> B', 'light');
    const rejected = expect(pending).rejects.toMatchObject({ reason: 'error' });
    const { frame, id } = await ready();
    window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow!, origin: 'null', data: {
      kind: 'result', id, svg: '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject>Bad</foreignObject></svg>',
    } }));
    await rejected;
    expect(document.querySelector('iframe, svg')).toBeNull();
  });
});
