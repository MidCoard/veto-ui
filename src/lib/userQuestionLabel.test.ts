import { expect, it } from 'vitest';
import { translate } from '../i18n/I18nContext';
import { userQuestionLabel } from './userQuestionLabel';
it('adds a localized recommendation once without changing the source label', () => {
  const english = translate.bind(null, 'en');
  const chinese = translate.bind(null, 'zh-CN');
  expect(userQuestionLabel('Swift', 0, english)).toBe('Swift (Recommended)');
  expect(userQuestionLabel('Swift (Recommended)', 0, english)).toBe('Swift (Recommended)');
  expect(userQuestionLabel('Swift', 0, chinese)).toBe('Swift （推荐）');
  expect(userQuestionLabel('Objective-C', 4, english)).toBe('Objective-C');
});
