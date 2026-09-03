import React, { useState } from 'react';
import { AuthProvider, useAuth } from './state/AuthContext';
import { SessionProvider } from './state/SessionContext';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import LoginGate from './components/LoginGate';
import StatusBar from './components/StatusBar';
import SessionRail from './components/SessionRail';
import LedgerStream from './components/ledger/LedgerStream';
import Composer from './components/Composer';
import InspectorPanel from './components/inspector/InspectorPanel';
import SettingsView from './components/settings/SettingsView';
import SessionRecordsPage from './components/records/SessionRecordsView';

/**
 * App — three-column ops console:
 *   SessionRail (left, fixed w-64, overlay toggle below md)
 *   LedgerStream + Composer (center)
 *   Inspector (right, collapsible, hidden below lg)
 * Setup / signed-out / loading states replace the shell entirely; the
 * full-page SettingsView swaps with the three-column layout via a simple
 * view state (no router).
 */

const LoadingScreen: React.FC = () => {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-ink flex items-center justify-center">
      <div className="text-center space-y-3">
        <span className="font-display text-2xl font-bold tracking-widest text-paper">VETO</span>
        <p className="text-sm text-dim">{t('app.loading')}</p>
      </div>
    </div>
  );
};

const Shell: React.FC = () => {
  const { status } = useAuth();
  const [railOpen, setRailOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [view, setView] = useState<'sessions' | 'records' | 'settings'>('sessions');

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'setup' || status === 'signedOut') return <LoginGate />;

  const inSettings = view === 'settings';
  const inRecords = view === 'records';

  return (
    <div className="h-screen flex flex-col bg-ink text-paper">
      <StatusBar
        onToggleRail={inSettings ? undefined : () => setRailOpen((open) => !open)}
        onToggleInspector={view === 'sessions' ? () => setInspectorOpen((open) => !open) : undefined}
        recordsOpen={inRecords}
        onToggleRecords={inSettings ? undefined : () => setView((current) => (current === 'records' ? 'sessions' : 'records'))}
        settingsOpen={inSettings}
        onToggleSettings={() => setView((current) => (current === 'settings' ? 'sessions' : 'settings'))}
      />

      {inSettings ? (
        <SettingsView />
      ) : (
      <div className="flex-1 flex min-h-0 relative">
        {/* Rail: fixed column on md+, slide-over below md */}
        {railOpen && (
          <div
            className="fixed inset-0 bg-ink/70 z-20 md:hidden"
            onClick={() => setRailOpen(false)}
          />
        )}
        <aside
          className={[
            'w-64 shrink-0 border-r border-rule bg-panel z-30',
            'fixed top-12 bottom-0 left-0 md:static',
            railOpen ? 'block' : 'hidden md:block',
          ].join(' ')}
        >
          <SessionRail />
        </aside>

        {/* Center: interactive ledger or the server-authoritative records page */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          {inRecords ? (
            <SessionRecordsPage />
          ) : (
            <>
              <LedgerStream />
              <Composer />
            </>
          )}
        </main>

        {/* Right: inspector — collapsible, hidden below lg */}
        {!inRecords && inspectorOpen && (
          <aside
            id="inspector"
            className="hidden lg:block w-80 shrink-0 border-l border-rule bg-panel"
          >
            <InspectorPanel />
          </aside>
        )}
      </div>
      )}
    </div>
  );
};

const App: React.FC = () => (
  <I18nProvider>
    <AuthProvider>
      <SessionProvider>
        <Shell />
      </SessionProvider>
    </AuthProvider>
  </I18nProvider>
);

export default App;
