import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import StreamingMarkdown from './StreamingMarkdown';
import { DiagramError } from '../lib/diagramRenderer';

const { renderDiagram } = vi.hoisted(() => ({ renderDiagram: vi.fn() }));
vi.mock('../lib/diagramRenderer', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/diagramRenderer')>(), renderDiagram,
}));

function message(code: string, streaming = false) {
  return <I18nProvider><StreamingMarkdown content={'```mermaid\n' + code + '\n```'} isStreaming={streaming} /></I18nProvider>;
}

describe('Mermaid markdown', () => {
  it('lets readers retry a timed-out diagram', async () => {
    renderDiagram.mockRejectedValueOnce(new DiagramError('timeout'));
    render(message('flowchart LR\nA --> B'));
    fireEvent.click(await screen.findByRole('button', { name: 'Render diagram' }));
    expect(await screen.findByRole('img')).toBeInTheDocument();
    expect(renderDiagram).toHaveBeenCalledTimes(2);
  });

  beforeEach(() => {
    renderDiagram.mockReset();
    renderDiagram.mockResolvedValue({ image: 'data:image/svg+xml,test', title: '', description: '' });
  });

  it('renders an isolated diagram image and lets readers view its source', async () => {
    const { container } = render(message('flowchart LR\nA --> B'));
    expect(await screen.findByRole('img', { name: 'Mermaid diagram' })).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'));
    expect(container.querySelector('svg text')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('waits for streaming to finish and falls back to source on invalid syntax', async () => {
    renderDiagram.mockRejectedValue(new Error('Parse error'));
    const { rerender } = render(message('flowchart LR\nA -->', true));
    expect(renderDiagram).not.toHaveBeenCalled();
    rerender(message('flowchart LR\nA -->'));
    expect(await screen.findByText('Unable to render this diagram. Its source is shown below.')).toBeInTheDocument();
    expect(screen.getByText('Parse error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('ignores an old render completing after the content changes', async () => {
    let finishOld!: (result: { image: string; title: string; description: string }) => void;
    renderDiagram.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    const { rerender } = render(message('flowchart LR\nOld --> A'));
    await act(async () => {});
    rerender(message('flowchart LR\nNew --> B'));
    const image = await screen.findByRole('img');
    const newSource = image.getAttribute('src');
    await act(async () => { finishOld({ image: 'old', title: 'Old', description: '' }); });
    expect(screen.getByRole('img')).toHaveAttribute('src', newSource);
  });

  it('shows diagnostics as plain text only in the failed diagram and clears them after correction', async () => {
    const detail = 'Parse error on line 2:\n<img src=x onerror=alert(1)>\n^';
    renderDiagram.mockRejectedValueOnce(new DiagramError('error', detail));
    const content = '```mermaid\nflowchart LR\nA -->\n```\n\n```mermaid\nflowchart LR\nA --> B\n```';
    const { container, rerender } = render(<I18nProvider><StreamingMarkdown content={content} /></I18nProvider>);
    await screen.findByText('Failure reason');
    const figures = container.querySelectorAll('figure');
    expect(figures[0].querySelector('pre')?.textContent).toBe(detail);
    expect(figures[0].querySelector('img')).toBeNull();
    expect(figures[1].textContent).not.toContain('Failure reason');
    expect(await screen.findByRole('img')).toBeInTheDocument();
    rerender(message('flowchart LR\nFixed --> B'));
    await screen.findByRole('img');
    expect(screen.queryByText('Failure reason')).toBeNull();
  });

  it('renders only three diagrams automatically and exposes accessible descriptions', async () => {
    renderDiagram.mockResolvedValue({ image: 'data:image/svg+xml,test', title: 'Approval', description: 'Approval gates execution.' });
    const content = Array.from({ length: 4 }, (_, i) => '```mermaid\nflowchart LR\nA --> B' + i + '\n```').join('\n\n');
    render(<I18nProvider><StreamingMarkdown content={content} /></I18nProvider>);
    expect(await screen.findAllByRole('img', { name: 'Approval' })).toHaveLength(3);
    expect(renderDiagram).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole('button', { name: 'Render diagram' }));
    await waitFor(() => expect(screen.getAllByText('Approval gates execution.')).toHaveLength(4));
    expect(renderDiagram).toHaveBeenCalledTimes(4);
  });

  it('leaves unsupported and configured diagrams as source without invoking the renderer', () => {
    render(message('---\nconfig:\n  securityLevel: loose\n---\nflowchart LR\nA --> B'));
    expect(screen.getByText(/unsupported styling/)).toBeInTheDocument();
    expect(renderDiagram).not.toHaveBeenCalled();
  });
});
