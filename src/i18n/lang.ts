/**
 * UI language state, free of React so non-component modules (e.g. the API
 * client) can read it without pulling in the i18n context.
 *
 * The source of truth is localStorage ('veto.lang'); the default follows
 * navigator.language (zh* → zh-CN, everything else → en).
 */

export type Lang = 'en' | 'zh-CN';

export const LANG_KEY = 'veto.lang';

/** The UI's current language: the stored choice, else the browser default. */
export function currentLang(): Lang {
  const stored = localStorage.getItem(LANG_KEY);
  if (stored === 'en' || stored === 'zh-CN') return stored;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}
