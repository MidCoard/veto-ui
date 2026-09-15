import { ApiError } from '../api/client';
import type { Translate } from '../i18n/I18nContext';

export function promptSubmissionError(error: unknown, t: Translate): string {
  if (error instanceof ApiError && error.code === 'PROTECTED_INPUT_UNAVAILABLE') {
    return t('error.protectedInput');
  }
  if (error instanceof ApiError) return error.message;
  return t('error.promptUnconfirmed');
}