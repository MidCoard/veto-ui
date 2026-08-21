/**
 * Theme switching — dark console (default) / light ledger.
 * Persisted in localStorage; applied as data-theme on <html> so the CSS
 * variables in index.css flip. Read index.html/main.tsx for init order.
 * Components subscribe via useTheme so every control (top bar, settings)
 * drives the same state.
 */

import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

const THEME_KEY = 'veto.theme';

const listeners = new Set<() => void>();

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  listeners.forEach((listener) => listener());
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/** Shared reactive theme state for every theme control in the app. */
export function useTheme(): Theme {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    getTheme,
  );
}

/**
 * Apply the persisted theme before first paint. Call as early as possible
 * (main.tsx, before render) to avoid a flash of the wrong theme.
 */
export function initTheme(): void {
  const stored = localStorage.getItem(THEME_KEY);
  document.documentElement.dataset.theme = stored === 'light' ? 'light' : 'dark';
}
