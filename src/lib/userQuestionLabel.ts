import type { Translate } from '../i18n/I18nContext';

/** Recommendation is presentation, not part of the stored option/answer identity. */
export function userQuestionLabel(label: string, index: number, t: Translate): string {
  const plain = label.replace(/\s*\(Recommended\)\s*$/i, '').trim();
  return index === 0 ? `${plain} ${t('question.recommended')}` : plain;
}
