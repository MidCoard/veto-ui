import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import RequestUsage from './RequestUsage';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

it('shows the input growth as the headline and the request total plus cache on hover', () => {
  render(<I18nProvider><RequestUsage measurements={[
    { inputTokens: 150, inputDeltaTokens: 50, baselineReset: false, cacheReadInputTokens: 90 },
  ]} /></I18nProvider>);
  expect(screen.getByRole('button', { name: 'Input tokens: 50' })).toBeVisible();
  fireEvent.focus(screen.getByRole('button'));
  const tooltip = screen.getByRole('tooltip');
  expect(tooltip).toHaveTextContent('Total input tokens: 150');
  expect(tooltip).toHaveTextContent('Cached input tokens: 90');
});

it('shows full input on a new baseline and an em dash when cache is unknown', () => {
  render(<I18nProvider><RequestUsage measurements={[
    { inputTokens: 1200, inputDeltaTokens: 1200, baselineReset: true },
  ]} /></I18nProvider>);
  expect(screen.getByRole('button', { name: 'Input tokens: 1,200' })).toBeVisible();
  fireEvent.focus(screen.getByRole('button'));
  const tooltip = screen.getByRole('tooltip');
  expect(tooltip).toHaveTextContent('Total input tokens: 1,200');
  expect(tooltip).toHaveTextContent('Cached input tokens: —');
});

it('falls back to the full input when no derived growth is present', () => {
  render(<I18nProvider><RequestUsage measurements={[{ inputTokens: 100, cacheReadInputTokens: 0 }]} /></I18nProvider>);
  expect(screen.getByRole('button', { name: 'Input tokens: 100' })).toBeVisible();
  fireEvent.focus(screen.getByRole('button'));
  expect(screen.getByRole('tooltip')).toHaveTextContent('Cached input tokens: 0');
});

it('keeps real zero growth distinct from missing or invalid input', () => {
  const view = render(<I18nProvider><RequestUsage measurements={[{ inputTokens: 100, inputDeltaTokens: 0, baselineReset: false }]} /></I18nProvider>);
  expect(screen.getByRole('button', { name: 'Input tokens: 0' })).toBeVisible();
  view.rerender(<I18nProvider><RequestUsage measurements={[{ inputTokens: -1 }, { inputTokens: Infinity }, null]} /></I18nProvider>);
  expect(view.container).toBeEmptyDOMElement();
});

it('renders nothing for compaction or non-context measurements', () => {
  const { container } = render(<I18nProvider><RequestUsage measurements={[
    { inputTokens: 999, affectsContext: false },
    { inputTokens: 80, purpose: 'compaction' },
  ]} /></I18nProvider>);
  expect(container).toBeEmptyDOMElement();
});
