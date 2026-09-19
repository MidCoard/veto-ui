import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import PluginContextLine from './PluginContextLine';

it('counts packages separately from tools and exposes their provenance', () => {
  const { container } = render(<I18nProvider><PluginContextLine context={{ lastRequest: true, plugins: [
    { id: 'text', version: '0.1.0', tools: ['plugin_text__length', 'plugin_text__trim'] },
  ] }} loading={false} failed={false} stale={false} /></I18nProvider>);
  expect(screen.getByText('Plugins 1')).toBeInTheDocument();
  expect(screen.getByText('· Tools 2')).toBeInTheDocument();
  expect(screen.getByText('· Latest model request')).toBeInTheDocument();
  fireEvent.click(container.querySelector('summary')!);
  expect(container.querySelector('details')).toHaveAttribute('open');
  expect(screen.getByText('plugin_text__length')).toBeVisible();
  expect(screen.getByText('v0.1.0')).toBeVisible();
});

it('distinguishes zero plugins from missing context and a failed load', () => {
  const view = render(<I18nProvider><PluginContextLine context={{ lastRequest: false, plugins: [] }} loading={false} failed={false} stale={false} /></I18nProvider>);
  expect(screen.getByText('Plugins 0')).toBeInTheDocument();
  expect(screen.getByText('· Available to this agent')).toBeInTheDocument();
  view.rerender(<I18nProvider><PluginContextLine loading={false} failed={true} stale={true} /></I18nProvider>);
  expect(screen.queryByText('Plugins 0')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Plugin context could not be loaded');
});

it('marks cached context as stale without implying a fresh snapshot', () => {
  render(<I18nProvider><PluginContextLine context={{ lastRequest: true, plugins: [] }} loading={false} failed={false} stale /></I18nProvider>);
  expect(screen.getByText('· Awaiting update')).toBeInTheDocument();
});

it('shows loading without a misleading count', () => {
  render(<I18nProvider><PluginContextLine loading failed={false} stale /></I18nProvider>);
  expect(screen.getByRole('status')).toHaveTextContent('Loading plugin context');
  expect(screen.queryByText('Plugins 0')).not.toBeInTheDocument();
});
