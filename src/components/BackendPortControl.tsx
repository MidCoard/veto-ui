import React, { useState } from 'react';
import { getBackendPort, isValidBackendPort, setBackendPort } from '../config/backend';
import { useI18n } from '../i18n/I18nContext';

interface BackendPortControlProps {
  /** Test/integration seam; the browser default reloads all connection state. */
  onApplied?: () => void;
}

const BackendPortControl: React.FC<BackendPortControlProps> = ({ onApplied }) => {
  const { t } = useI18n();
  const [value, setValue] = useState(String(getBackendPort()));
  const [error, setError] = useState<string | null>(null);

  const apply = (event: React.FormEvent): void => {
    event.preventDefault();
    const port = Number(value);
    if (!/^\d+$/.test(value) || !isValidBackendPort(port)) {
      setError(t('backend.invalidPort'));
      return;
    }

    setBackendPort(port);
    setError(null);
    if (onApplied !== undefined) {
      onApplied();
    } else {
      window.location.reload();
    }
  };

  return (
    <form onSubmit={apply} noValidate aria-label={t('backend.connection')} className="space-y-1.5">
      <div className="flex items-end gap-2">
        <label className="flex-1 space-y-1">
          <span className="block text-xs font-medium text-dim uppercase tracking-wider">
            {t('backend.port')}
          </span>
          <input
            type="number"
            min={1}
            max={65535}
            step={1}
            inputMode="numeric"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-label={t('backend.port')}
            className="w-full bg-raised border border-rule rounded-md px-3 py-2 font-mono text-sm text-paper focus:outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          className="shrink-0 border border-accent/60 text-accent rounded-md px-3 py-2 text-sm hover:bg-accent/10"
        >
          {t('backend.apply')}
        </button>
      </div>
      <p className="text-xs text-dim">{t('backend.portHint')}</p>
      {error !== null && <p role="alert" className="text-xs text-verdict">{error}</p>}
    </form>
  );
};

export default BackendPortControl;
