import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import TokenUsageLine from './TokenUsageLine';
beforeEach(() => localStorage.clear());
it('keeps the summary short and exposes exact values on expansion', () => {
  render(<I18nProvider><TokenUsageLine usage={{ total: 1098574, context: 36875, max: 1000000 }} /></I18nProvider>);
  const details = screen.getByLabelText('Token usage');
  const summary = details.querySelector('summary')!;
  expect(summary).toHaveTextContent('1.1M');
  expect(summary).toHaveTextContent('3.7%');
  expect(details).not.toHaveAttribute('open');
  fireEvent.click(summary);
  expect(details).toHaveAttribute('open');
  expect(details).toHaveTextContent('1,098,574');
  expect(details).toHaveTextContent('36,875 / 1,000,000');
});
it('does not invent a percentage when the context limit is unavailable', () => {
  render(<I18nProvider><TokenUsageLine usage={{ total: 0, context: 0, max: null }} /></I18nProvider>);
  expect(screen.getByLabelText('Token usage').querySelector('summary')).toHaveTextContent('Tokens0Context—');
});
it('localizes compact counts for Chinese', () => {
  localStorage.setItem('veto.lang', 'zh-CN');
  render(<I18nProvider><TokenUsageLine usage={{ total: 1098574, context: 36875, max: 1000000 }} /></I18nProvider>);
  expect(screen.getByLabelText('Token 用量').querySelector('summary')).toHaveTextContent('109.9万');
});
