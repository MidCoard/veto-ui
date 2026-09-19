import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import RequestUsage from './RequestUsage';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

it('uses reported input even when the derived difference is negative', () => {
  render(<I18nProvider><RequestUsage measurements={[
    { inputTokens: 100, inputDeltaTokens: -20, inputDeltaSource: 'request_difference', contextDeltaTokens: 0 },
  ]} /></I18nProvider>);
  expect(screen.getByRole('button', { name: 'Request input tokens: 100' })).toBeVisible();
  fireEvent.focus(screen.getByRole('button'));
  expect(screen.getByRole('tooltip')).toHaveTextContent('whole request');
  expect(screen.getByRole('tooltip')).toHaveTextContent('Context change (diagnostic): 0');
  expect(screen.getByRole('tooltip')).not.toHaveTextContent('-20');
});

it('keeps each retry separate and attributes cache only to its own full request', () => {
  render(<I18nProvider><RequestUsage measurements={[
    { inputTokens: 100, cacheReadInputTokens: 90 },
    { inputTokens: 140, cacheReadInputTokens: 0 },
  ]} /></I18nProvider>);
  fireEvent.focus(screen.getByRole('button', { name: 'Request input tokens: 100' }));
  const tooltip = screen.getByRole('tooltip');
  expect(tooltip).toHaveTextContent('Request 1 input: 100');
  expect(tooltip).toHaveTextContent('Cached input tokens: 90');
  expect(tooltip).toHaveTextContent('Request 2 input: 140');
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
  expect(screen.getByRole('button', { name: 'Request input tokens: 1,200' })).toBeVisible();
});

it('keeps real zero input distinct from missing or invalid usage', () => {
  const view = render(<I18nProvider><RequestUsage measurements={[{ inputTokens: 0 }]} /></I18nProvider>);
  expect(screen.getByRole('button', { name: 'Request input tokens: 0' })).toBeVisible();
  view.rerender(<I18nProvider><RequestUsage measurements={[{ inputTokens: -1 }, { inputTokens: Infinity }, null]} /></I18nProvider>);
  expect(view.container).toBeEmptyDOMElement();
});

it('excludes compaction calls and labels genuine context shrinkage as a diagnostic', () => {
  render(<I18nProvider><RequestUsage measurements={[
    { inputTokens: 999, affectsContext: false, purpose: 'compaction' },
    { inputTokens: 80, contextDeltaTokens: -20 },
  ]} /></I18nProvider>);
  fireEvent.focus(screen.getByRole('button', { name: 'Request input tokens: 80' }));
  expect(screen.getByRole('tooltip')).toHaveTextContent('Context change (diagnostic): -20');
  expect(screen.getByRole('tooltip')).not.toHaveTextContent('999');
});
