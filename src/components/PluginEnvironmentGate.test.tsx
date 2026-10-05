import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import type { SessionPluginEnvironment } from '../state/useSessionPluginEnvironment';
import PluginEnvironmentGate from './PluginEnvironmentGate';

const missing = [{
  id: 'calendar', version: '1.0.0', revision: 'old', available: false,
  availability: 'REVISION_MISMATCH' as const,
}];

function environment(overrides: Partial<SessionPluginEnvironment> = {}): SessionPluginEnvironment {
  return {
    missing,
    loading: false,
    failed: false,
    acknowledged: false,
    acknowledge: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  };
}

describe('PluginEnvironmentGate', () => {
  it('names the risk and requires a deliberate continuation without hiding history', () => {
    const acknowledge = vi.fn();
    render(<I18nProvider><PluginEnvironmentGate environment={environment({ acknowledge })} /></I18nProvider>);

    expect(screen.getByRole('heading')).toHaveTextContent('missing part of its plugin environment');
    expect(screen.getByText(/tool calls, providers, and plugin features to fail/i)).toBeVisible();
    expect(screen.getByText(/complete session history without continuing/i)).toBeVisible();
    expect(screen.getByText(/does not match this session/i)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with missing plugins' }));
    expect(acknowledge).toHaveBeenCalledOnce();
  });

  it('pauses new work when verification fails and offers a retry', () => {
    const retry = vi.fn();
    render(<I18nProvider><PluginEnvironmentGate environment={environment({ missing: [], failed: true, retry })} /></I18nProvider>);
    expect(screen.getByRole('alert')).toHaveTextContent('new work is paused');
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
