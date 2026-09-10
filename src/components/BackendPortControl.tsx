import React from 'react';
import { useAuth } from '../state/AuthContext';
import { useI18n } from '../i18n/I18nContext';

const BackendPortControl: React.FC = () => {
  const { t } = useI18n();
  const { portInput, changePort, connection } = useAuth();
  return (
    <section aria-label={t('backend.connection')} className="space-y-3">
      <div className="flex items-center gap-3">
        <span title={t('backend.connection')} className="min-w-0 truncate text-xs font-medium text-dim">{t('backend.connection')}</span>
        <label className="ml-auto flex min-w-20 items-center gap-2">
          <span title={window.location.hostname} className="min-w-0 truncate text-sm font-mono text-paper">{window.location.hostname} :</span>
          <input type="text" inputMode="numeric" autoComplete="off" spellCheck={false}
            value={portInput} onChange={(event) => changePort(event.target.value)}
            aria-invalid={connection === 'invalid'} aria-describedby={connection === 'invalid' ? 'backend-port-help' : undefined}
            aria-label={t('backend.port')}
            className="ui-control w-20 shrink-0 font-mono tabular-nums" />
        </label>
        <span role="status" className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-dim">
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${connection === 'online' ? 'bg-emerald-400' : connection === 'checking' ? 'bg-accent animate-pulse motion-reduce:animate-none' : 'bg-dim/60'}`} />
          {t(`backend.${connection}`)}
        </span>
      </div>
      {connection === 'invalid' && (
        <p id="backend-port-help" className="text-xs leading-relaxed text-verdict">
          {t('backend.invalidPort')}
        </p>
      )}
    </section>
  );
};

export default BackendPortControl;
