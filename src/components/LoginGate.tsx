import BusyIndicator from './BusyIndicator';
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../state/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import BackendPortControl from './BackendPortControl';

/**
 * LoginGate — full-screen gate for the 'setup' and 'signedOut' states.
 * Centered card on ink, Veto icon and Space Mono wordmark,
 * IBM Plex Sans form. Errors render inline and say what to do.
 */
const LoginGate: React.FC = () => {
  const { status, connection, portInput, authError, signIn, firstRunSetup } = useAuth();
  const { t } = useI18n();
  const isSetup = status === 'setup';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submission = useRef(0);
  useEffect(() => {
    submission.current += 1;
    setPassword('');
    setSubmitting(false);
  }, [portInput]);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (submitting || connection !== 'online') return;
    const current = ++submission.current;
    setSubmitting(true);
    try {
      if (isSetup) {
        await firstRunSetup(username.trim(), password);
      } else {
        await signIn(username.trim(), password);
      }
    } finally {
      if (current === submission.current) setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border border-rule bg-panel p-7 shadow-xl sm:p-8">
        <div className="mb-6 space-y-3">
          <h1 className="flex items-center gap-3 font-display text-3xl font-bold tracking-widest text-paper">
            <img src="/veto-icon.svg" alt="" width={36} height={36} className="shrink-0" />
            VETO
          </h1>
          <p className="text-sm leading-relaxed text-dim">{t('login.entranceHint')}</p>
        </div>

        <div className="mb-6 border-b border-rule pb-5">
          <BackendPortControl />
        </div>

        {connection === 'online' ? <form
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-5"
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
              className="ui-control w-full bg-raised border border-rule rounded-md px-3 py-2 text-paper placeholder-dim/60 focus:outline-none focus:border-dim"
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
              className="ui-control w-full bg-raised border border-rule rounded-md px-3 py-2 text-paper placeholder-dim/60 focus:outline-none focus:border-dim"
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
            className="ui-button w-full bg-accent text-onaccent font-medium rounded-md px-4 py-2 hover:bg-accent/85 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <BusyIndicator label={t('login.working')} icon={false} /> : isSetup ? t('login.submitSetup') : t('login.submitSignIn')}
          </button>
        </form> : (
          <div className="py-4">
            <p className="text-sm font-medium text-paper">{t('login.waitingTitle')}</p>
            <p className="mt-2 text-xs leading-relaxed text-dim">{t('login.waitingHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginGate;
