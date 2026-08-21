import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { MessageKey } from '../../i18n/en';
import PatternsTab from '../inspector/PatternsTab';
import CredentialsSection from './CredentialsSection';
import ModelTiersSection from './ModelTiersSection';
import PreferencesSection from './PreferencesSection';

/**
 * SettingsView — full-page settings, swapped in at the App root (no router).
 * Left: section nav; right: section content. Preferences first (everyday
 * controls); Patterns reuses the inspector's PatternsTab unchanged.
 */
type SettingsSection = 'preferences' | 'patterns' | 'modelTiers' | 'credentials';

const sections: { id: SettingsSection; labelKey: MessageKey }[] = [
  { id: 'preferences', labelKey: 'settings.section.preferences' },
  { id: 'patterns', labelKey: 'inspector.patterns' },
  { id: 'modelTiers', labelKey: 'settings.section.modelTiers' },
  { id: 'credentials', labelKey: 'settings.section.credentials' },
];

const SettingsView: React.FC = () => {
  const { t } = useI18n();
  const [active, setActive] = useState<SettingsSection>('preferences');

  return (
    <div className="flex-1 flex min-h-0">
      {/* Section nav */}
      <aside className="w-48 md:w-56 shrink-0 border-r border-rule bg-panel py-3">
        <div className="px-3 pb-2 font-display text-[11px] uppercase tracking-[0.14em] text-dim">
          {t('settings.title')}
        </div>
        <nav>
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActive(section.id)}
              aria-current={active === section.id}
              className={[
                'w-full text-left px-3 py-2 text-sm border-l-2',
                active === section.id
                  ? 'text-accent border-accent bg-raised'
                  : 'text-dim hover:text-paper hover:bg-raised/60 border-transparent',
              ].join(' ')}
            >
              {t(section.labelKey)}
            </button>
          ))}
        </nav>
      </aside>

      {/* Section content */}
      <main className="flex-1 overflow-y-auto min-w-0 min-h-0">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-5">
          <h1 className="font-display text-[11px] uppercase tracking-[0.14em] text-dim mb-4">
            {t(sections.find((section) => section.id === active)?.labelKey ?? 'settings.title')}
          </h1>
          {active === 'preferences' && <PreferencesSection />}
          {active === 'patterns' && <PatternsTab />}
          {active === 'modelTiers' && <ModelTiersSection />}
          {active === 'credentials' && <CredentialsSection />}
        </div>
      </main>
    </div>
  );
};

export default SettingsView;
