import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import RequestUsage from './RequestUsage';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

it('shows history-derived input and raw total in the tooltip', () => {
  render(<I18nProvider><RequestUsage measurements={[
    { inputTokens: 100, displayInputTokens: 20 },
  ]} /></I18nProvider>);
  expect(screen.getByRole('button', { name: 'Input tokens: 20' })).toBeVisible();
  fireEvent.focus(screen.getByRole('button'));
  expect(screen.getByRole('tooltip')).toHaveTextContent('Total input tokens: 100');
  expect(screen.getByRole('tooltip')).not.toHaveTextContent('-20');
});

it('keeps each retry separate and attributes cache only to its own full request', () => {
  render(<I18nProvider><RequestUsage measurements={[
    { inputTokens: 100, cacheReadInputTokens: 90 },
    { inputTokens: 140, cacheReadInputTokens: 0 },
  ]} /></I18nProvider>);
  fireEvent.focus(screen.getByRole('button', { name: 'Input tokens: 100' }));
  const tooltip = screen.getByRole('tooltip');
  expect(tooltip).toHaveTextContent('Total input tokens: 100');
  expect(tooltip).toHaveTextContent('Cached input tokens: 90');
  expect(tooltip).toHaveTextContent('Total input tokens: 140');
  expect(tooltip).toHaveTextContent('Cached input tokens: 0');
});

it('does not infer usage from positive differences or missing measurements', () => {
  const { container } = render(<I18nProvider><RequestUsage measurements={[
    { inputDeltaTokens: 32, inputDeltaSource: 'request_difference' },
  ]} /></I18nProvider>);
  expect(container).toBeEmptyDOMElement();
});

it('shows request input without requiring a comparable baseline', () => {
  render(<I18nProvider><RequestUsage measurements={[{ inputTokens: 1200, baselineReset: true }]} /></I18nProvider>);
  expect(screen.getByRole('button', { name: 'Input tokens: 1,200' })).toBeVisible();
});

it('keeps real zero input distinct from missing or invalid usage', () => {
  const view = render(<I18nProvider><RequestUsage measurements={[{ inputTokens: 0 }]} /></I18nProvider>);
  expect(screen.getByRole('button', { name: 'Input tokens: 0' })).toBeVisible();
  view.rerender(<I18nProvider><RequestUsage measurements={[{ inputTokens: -1 }, { inputTokens: Infinity }, null]} /></I18nProvider>);
  expect(view.container).toBeEmptyDOMElement();
});

it('excludes compaction calls from conversation usage', () => {
  render(<I18nProvider><RequestUsage measurements={[
    { inputTokens: 999, affectsContext: false, purpose: 'compaction' },
    { inputTokens: 80, contextDeltaTokens: -20 },
  ]} /></I18nProvider>);
  fireEvent.focus(screen.getByRole('button', { name: 'Input tokens: 80' }));
  expect(screen.getByRole('tooltip')).toHaveTextContent('Total input tokens: 80');
  expect(screen.getByRole('tooltip')).not.toHaveTextContent('999');
});
