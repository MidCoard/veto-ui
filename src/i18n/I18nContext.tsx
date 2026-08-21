import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { setHttpErrorLocalizer } from '../api/client';
import { en } from './en';
import type { MessageKey } from './en';
import { currentLang, LANG_KEY } from './lang';
import type { Lang } from './lang';
import { zhCN } from './zhCN';

/**
 * I18nContext — hand-rolled English / 中文 (Simplified) dictionaries.
 * Persisted in localStorage ('veto.lang'); the default follows
 * navigator.language (zh* → zh-CN, everything else → en).
 * t() interpolates {placeholder} params and falls back to English for
 * any key missing from the active dictionary.
 */

export type { Lang } from './lang';

const dictionaries: Record<Lang, Record<MessageKey, string>> = {
  en,
  'zh-CN': zhCN,
};

export type TranslateParams = Record<string, string | number>;

/** Pure translation lookup, exported for tests and non-hook callers. */
export function translate(lang: Lang, key: MessageKey, params?: TranslateParams): string {
  let message = dictionaries[lang][key] ?? en[key];
  if (params !== undefined) {
    for (const [name, value] of Object.entries(params)) {
      message = message.split(`{${name}}`).join(String(value));
    }
  }
  return message;
}

export type Translate = (key: MessageKey, params?: TranslateParams) => string;

// The transport layer's empty-body fallback follows the UI language too:
// registered here (client.ts stays React-free); currentLang() reads
// localStorage at call time, so it tracks language switches immediately.
setHttpErrorLocalizer((status) => translate(currentLang(), 'error.requestFailed', { status }));

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translate;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(currentLang);

  const setLang = useCallback((next: Lang): void => {
    localStorage.setItem(LANG_KEY, next);
    setLangState(next);
  }, []);

  const t = useCallback<Translate>(
    (key, params) => translate(lang, key, params),
    [lang],
  );

  const value = useMemo<I18nContextValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (context === null) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
