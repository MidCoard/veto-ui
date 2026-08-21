import { describe, expect, it, vi } from 'vitest';
import { en } from './en';
import type { MessageKey } from './en';
import { translate } from './I18nContext';
import { zhCN } from './zhCN';

describe('i18n dictionaries', () => {
  it('zh-CN covers every English key', () => {
    const enKeys = Object.keys(en).sort();
    const zhKeys = Object.keys(zhCN).sort();
    expect(zhKeys).toEqual(enKeys);
  });
});

describe('translate', () => {
  it('returns the message for the active language', () => {
    expect(translate('en', 'composer.send')).toBe('Send');
    expect(translate('zh-CN', 'composer.send')).toBe('发送');
  });

  it('interpolates {placeholder} params', () => {
    expect(translate('en', 'rail.deleteAria', { name: 'ops' })).toBe('Delete session ops');
    expect(translate('zh-CN', 'rail.deleteAria', { name: 'ops' })).toBe('删除会话 ops');
    expect(translate('en', 'error.passwordTooShort', { min: 8 })).toBe(
      'Password needs at least 8 characters.',
    );
  });

  it('leaves unknown placeholders untouched and never throws on missing params', () => {
    const key: MessageKey = 'error.passwordTooShort';
    expect(translate('en', key)).toBe('Password needs at least {min} characters.');
  });
});

describe('HTTP error localizer registration', () => {
  it('localizes the transport fallback via the module-side registration', async () => {
    // Importing I18nContext (done above) registers the localizer with the API
    // client; currentLang() reads localStorage at call time.
    const { apiRequest, ApiError } = await import('../api/client');
    localStorage.setItem('veto.lang', 'zh-CN');
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response('', { status: 500 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const failure = await apiRequest('/api/tasks').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as InstanceType<typeof ApiError>).message).toBe('请求失败（HTTP 500）');

    vi.unstubAllGlobals();
    localStorage.clear();
  });
});
