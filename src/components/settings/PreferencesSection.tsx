import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { Lang } from '../../i18n/I18nContext';
import { setTheme, useTheme } from '../../lib/theme';
import type { Theme } from '../../lib/theme';
import BackendPortControl from '../BackendPortControl';

/**
 * PreferencesSection — the ONE canonical surface for the everyday UI
 * preferences (language, theme): segmented controls driving I18nContext and
 * lib/theme. (The StatusBar quick toggles were removed — Settings is the
 * single home for these.)
 */

interface SegmentProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

function Segment<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentProps<T>): React.ReactElement {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex border border-rule rounded-md overflow-hidden">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={[
            'px-3 py-1.5 text-sm',
            value === option.value
              ? 'bg-accent/15 text-accent'
              : 'text-dim hover:text-paper hover:bg-raised',
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const PreferencesSection: React.FC = () => {
  const { lang, setLang, t } = useI18n();
  const theme = useTheme();

  const languages: { value: Lang; label: string }[] = [
    { value: 'zh-CN', label: '中文' },
    { value: 'en', label: 'EN' },
  ];
  const themes: { value: Theme; label: string }[] = [
    { value: 'dark', label: t('prefs.theme.dark') },
    { value: 'light', label: t('prefs.theme.light') },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-panel border border-rule rounded-lg p-3 flex items-center justify-between gap-3">
        <span className="text-sm text-paper">{t('prefs.language')}</span>
        <Segment options={languages} value={lang} onChange={setLang} ariaLabel={t('prefs.language')} />
      </div>
      <div className="bg-panel border border-rule rounded-lg p-3 flex items-center justify-between gap-3">
        <span className="text-sm text-paper">{t('prefs.theme')}</span>
        <Segment options={themes} value={theme} onChange={setTheme} ariaLabel={t('prefs.theme')} />
      </div>
      <div className="bg-panel border border-rule rounded-lg p-3">
        <BackendPortControl />
      </div>
    </div>
  );
};

export default PreferencesSection;
