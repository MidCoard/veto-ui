import { useI18n } from '../i18n/I18nContext';
import type { SessionPluginEnvironment } from '../state/useSessionPluginEnvironment';
import type { MessageKey } from '../i18n/en';

const reasonKeys: Record<NonNullable<SessionPluginEnvironment['missing'][number]['availability']>, MessageKey> = {
  AVAILABLE: 'plugins.environmentReason.AVAILABLE',
  ABSENT: 'plugins.environmentReason.ABSENT',
  DISABLED: 'plugins.environmentReason.DISABLED',
  DECLINED: 'plugins.environmentReason.DECLINED',
  REVISION_MISMATCH: 'plugins.environmentReason.REVISION_MISMATCH',
  INACTIVE: 'plugins.environmentReason.INACTIVE',
};

export default function PluginEnvironmentGate({ environment }: { environment: SessionPluginEnvironment }) {
  const { t } = useI18n();
  if (environment.loading) return <p role="status" className="mb-3 text-xs text-dim">{t('plugins.environmentChecking')}</p>;
  if (environment.failed) return <div role="alert" className="mb-3 rounded-md border border-verdict/40 bg-verdict/5 px-3 py-2 text-xs text-paper">
    <p>{t('plugins.environmentFailed')}</p>
    <button type="button" onClick={environment.retry} className="ui-button mt-2 rounded-md border border-rule px-3 py-1.5 text-dim hover:bg-raised hover:text-paper">{t('plugins.environmentRetry')}</button>
  </div>;
  if (environment.missing.length === 0 || environment.acknowledged) return null;
  return <section aria-labelledby="plugin-environment-warning" className="mb-3 rounded-md border border-amber-400/50 bg-amber-400/5 px-3 py-3">
    <h2 id="plugin-environment-warning" className="text-sm font-medium text-paper">{t('plugins.environmentWarningTitle')}</h2>
    <p className="mt-1 text-xs leading-5 text-dim">{t('plugins.environmentWarning')}</p>
    <ul className="mt-2 space-y-1 text-xs text-paper">{environment.missing.map(plugin => <li key={`${plugin.id}-${plugin.revision}`}>
      <span className="font-mono">{plugin.id}</span>{plugin.availability && plugin.availability !== 'AVAILABLE' ? <span className="text-dim"> · {t(reasonKeys[plugin.availability])}</span> : null}
    </li>)}</ul>
    <p className="mt-1 text-xs leading-5 text-dim">{t('plugins.environmentHistory')}</p>
    <button type="button" onClick={environment.acknowledge} className="ui-button mt-3 rounded-md border border-amber-400/60 px-3 py-2 text-xs font-medium text-paper hover:bg-amber-400/10">
      {t('plugins.environmentContinue')}
    </button>
  </section>;
}
