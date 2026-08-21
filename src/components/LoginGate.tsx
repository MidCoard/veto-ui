import React, { useState } from 'react';
import { useAuth } from '../state/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import VerdictStamp from './VerdictStamp';
import BackendPortControl from './BackendPortControl';

/**
 * LoginGate — full-screen gate for the 'setup' and 'signedOut' states.
 * Centered card on ink, Space Mono wordmark with a stamp motif,
 * IBM Plex Sans form. Errors render inline and say what to do.
 */
const LoginGate: React.FC = () => {
  const { status, authError, signIn, firstRunSetup } = useAuth();
  const { t } = useI18n();
  const isSetup = status === 'setup';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (isSetup) {
        await firstRunSetup(username.trim(), password);
      } else {
        await signIn(username.trim(), password);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-end justify-between mb-8">
          <h1 className="font-display text-4xl font-bold tracking-widest text-paper">VETO</h1>
          <VerdictStamp verdict="PENDING" className="mb-1" />
        </div>

        <div className="bg-panel border border-rule rounded-xl p-4 mb-3 shadow-xl">
          <BackendPortControl />
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="bg-panel border border-rule rounded-xl p-6 space-y-4 shadow-2xl"
        >
          <p className="text-sm text-dim">
            {isSetup ? t('login.subtitleSetup') : t('login.subtitleSignIn')}
          </p>

          <div className="space-y-1">
            <label htmlFor="veto-username" className="block text-xs font-medium text-dim uppercase tracking-wider">
              {t('login.username')}
            </label>
            <input
              id="veto-username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full bg-raised border border-rule rounded-md px-3 py-2 text-paper placeholder-dim/60 focus:outline-none focus:border-accent"
              placeholder={t('login.usernamePlaceholder')}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="veto-password" className="block text-xs font-medium text-dim uppercase tracking-wider">
              {t('login.password')}
            </label>
            <input
              id="veto-password"
              type="password"
              autoComplete={isSetup ? 'new-password' : 'current-password'}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full bg-raised border border-rule rounded-md px-3 py-2 text-paper placeholder-dim/60 focus:outline-none focus:border-accent"
              placeholder={isSetup ? t('login.passwordPlaceholderSetup') : '••••••••'}
            />
            {isSetup && (
              <p className="text-xs text-dim">{t('login.passwordHint')}</p>
            )}
          </div>

          {authError !== null && (
            <p role="alert" className="text-sm text-verdict border border-verdict/40 rounded-md px-3 py-2">
              {authError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-accent text-onaccent font-medium rounded-md px-4 py-2 hover:bg-accent/85 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? t('login.working') : isSetup ? t('login.submitSetup') : t('login.submitSignIn')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginGate;
