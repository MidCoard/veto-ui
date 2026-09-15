import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import RequestUsage from './RequestUsage';
import ResponseUsage from './ResponseUsage';

afterEach(cleanup);
beforeEach(() => localStorage.clear());
it('backfills the first full input including system and tools, without summing retries', () => {
  const view = render(<I18nProvider><RequestUsage initialInput /></I18nProvider>);
  expect(view.container).toBeEmptyDOMElement();
  view.rerender(<I18nProvider><RequestUsage initialInput measurements={[
    { inputTokens: 32429, cacheReadInputTokens: 128 },
    { inputTokens: 32500, inputDeltaTokens: 71, inputDeltaSource: 'request_difference' },
  ]} /></I18nProvider>);
  expect(screen.getByText('Input tokens: 32,429')).toBeVisible();
  fireEvent.focus(screen.getByRole('button'));
  expect(screen.getByRole('tooltip').textContent).toBe('Cached input tokens: 128');
});
it('does not attribute cached system or history tokens to the user message', () => {
  render(<I18nProvider><RequestUsage delta={12} deltaSource="measured" measurements={[
    { inputTokens: 1200, cacheReadInputTokens: 900 },
  ]} /></I18nProvider>);
  expect(screen.getByText('Input tokens: 12')).toBeVisible();
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByRole('tooltip')).toBeNull();
});
it('hides input without a comparable baseline even after usage arrives', () => {
  const { container } = render(<I18nProvider><RequestUsage measurements={[{ inputTokens: 37268, cacheReadInputTokens: 128 }]} /></I18nProvider>);
  expect(container).toBeEmptyDOMElement();
  expect(screen.queryByRole('button')).toBeNull();
});
it('backfills input only after the corresponding usage arrives', () => {
  const view = render(<I18nProvider><RequestUsage /></I18nProvider>);
  expect(view.container).toBeEmptyDOMElement();
  view.rerender(<I18nProvider><RequestUsage measurements={[
    { inputTokens: 32780, inputDeltaTokens: 32, inputDeltaSource: 'request_difference' },
  ]} /></I18nProvider>);
  expect(screen.getByText('Input tokens: 32')).toBeVisible();
  expect(screen.queryByText(/Output tokens/)).toBeNull();
});
it('does not display an input count before a tool result is submitted to a model', () => {
  const { container } = render(<I18nProvider><RequestUsage /></I18nProvider>);
  expect(container).toBeEmptyDOMElement();
});
it('shows a zero-cache tooltip only when supported by the corresponding request', () => {
  render(<I18nProvider><RequestUsage measurements={[{ inputTokens: 100, inputDeltaTokens: 10, inputDeltaSource: 'request_difference', cacheReadInputTokens: 0 }]} /></I18nProvider>);
  fireEvent.focus(screen.getByRole('button'));
  expect(screen.getByRole('tooltip').textContent).toBe('Cached input tokens: 0');
});
it('renders output as plain text with no cache tooltip', () => {
  render(<I18nProvider><ResponseUsage usage={{ modelCallId: 'a', inputTokens: 1000, outputTokens: 39, cacheReadInputTokens: 800 }} /></I18nProvider>);
  expect(screen.getByText('Output tokens: 39')).toBeVisible();
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByRole('tooltip')).toBeNull();
});

it('keeps the boundary difference through retries and preserves a negative difference', () => {
  render(<I18nProvider><RequestUsage measurements={[
    { inputTokens: 100, inputDeltaTokens: -1, inputDeltaSource: 'request_difference' },
    { inputTokens: 100, cacheReadInputTokens: 90 },
  ]} /></I18nProvider>);
  expect(screen.getByText('Input tokens: -1')).toBeVisible();
});

it('distinguishes runtime forwarded zero from unknown output', () => {
  const view = render(<I18nProvider><ResponseUsage runtimeOutputTokens={0} /></I18nProvider>);
  expect(screen.getByText('Output tokens: 0')).toBeVisible();
  view.rerender(<I18nProvider><ResponseUsage /></I18nProvider>);
  expect(screen.getByText('Output tokens: —')).toBeVisible();
});
