import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { I18nProvider, useI18n } from '../i18n/I18nContext';
import { formatTimestamp, formatFullTimestamp } from '../lib/time';
import EntryTimestamp from './EntryTimestamp';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

function LanguageSwitch() {
  const { setLang } = useI18n();
  return <button onClick={() => setLang('en')}>English</button>;
}

it('updates a mounted timestamp from Chinese to English without changing its instant', () => {
  localStorage.setItem('veto.lang', 'zh-CN');
  const { container } = render(<I18nProvider><LanguageSwitch /><EntryTimestamp value="2020-01-15T12:30:00Z" /></I18nProvider>);
  const time = container.querySelector('time')!;
  expect(time.textContent).toContain('月');
  const instant = time.dateTime;
  const previousTitle = time.title;
  fireEvent.click(screen.getByRole('button', { name: 'English' }));
  expect(time.textContent).toContain('Jan');
  expect(time.textContent).not.toContain('月');
  expect(time.title).not.toBe(previousTitle);
  expect(time.dateTime).toBe(instant);
});

it('uses the selected language for list and detail dates while preserving missing values', () => {
  localStorage.setItem('veto.lang', 'zh-CN');
  expect(formatTimestamp('2020-01-15T12:30:00Z')).toContain('月');
  const chineseDetail = formatFullTimestamp('2020-01-15T12:30:00Z');
  localStorage.setItem('veto.lang', 'en');
  expect(formatTimestamp('2020-01-15T12:30:00Z')).toContain('Jan');
  expect(formatFullTimestamp('2020-01-15T12:30:00Z')).not.toBe(chineseDetail);
  expect(formatFullTimestamp(null)).toBe('—');
  expect(formatTimestamp('unknown')).toBe('unknown');
});
