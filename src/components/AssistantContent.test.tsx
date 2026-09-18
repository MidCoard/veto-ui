import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AssistantContent from './AssistantContent';
import { I18nProvider } from '../i18n/I18nContext';

describe('AssistantContent', () => {
  it('renders explicit provider reasoning as text even when it resembles an envelope', () => {
    const raw = '{"checks":["verify the result"]}';
    render(<I18nProvider><AssistantContent raw={raw} plainText /></I18nProvider>);
    expect(screen.getByText(raw)).toBeInTheDocument();
    expect(screen.queryByText(/Structured response could not be interpreted/)).not.toBeInTheDocument();
  });
  it.each(['```json', JSON.stringify({ thought: '```json' })])('keeps a bare protocol fence in diagnostics: %s', (raw) => {
    render(<I18nProvider><AssistantContent raw={raw} /></I18nProvider>);
    expect(screen.getByText(raw).closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText(/Structured response could not be interpreted/)).toBeInTheDocument();
  });
  it('shows a GUIDE plan separately from thought and retains the original payload', () => {
    const raw = JSON.stringify({ thought: 'Read the source first', guide: { actions: [{ id: 'read', label: 'Read RFC', type: 'tool', tool: 'web_fetch' }, { id: 'done', type: 'STOP', result_binding: 'answer' }] } });
    render(<I18nProvider><AssistantContent raw={raw} /></I18nProvider>);
    expect(screen.getByText('Read the source first')).toBeInTheDocument();
    expect(screen.getByText('Read RFC')).toBeInTheDocument();
    expect(screen.getByText('STOP · answer')).toBeInTheDocument();
    expect(screen.getByText(raw).closest('details')).not.toHaveAttribute('open');
  });

  it('keeps malformed structured content in diagnostics without labelling it thought', () => {
    const raw = '{"guide":{"actions":';
    render(<I18nProvider><AssistantContent raw={raw} /></I18nProvider>);
    expect(screen.getByText(raw).closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText(/Structured response could not be interpreted/)).toBeInTheDocument();
  });

  it('renders ordinary thought without requiring an envelope', () => {
    render(<I18nProvider><AssistantContent raw="Check the selected file" /></I18nProvider>);
    expect(screen.getByText('Check the selected file')).toBeInTheDocument();
  });
});
