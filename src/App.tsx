import { RecordNavigation, type RecordLocation } from './state/RecordNavigation';
import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './state/AuthContext';
import { SessionProvider, useSessions } from './state/SessionContext';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import LoginGate from './components/LoginGate';
import StatusBar from './components/StatusBar';
import SessionRail from './components/SessionRail';
import NewSessionPage from './components/NewSessionPage';
import WorkspaceSidebar from './components/WorkspaceSidebar';
import ConversationPane from './components/ConversationPane';
import InspectorPanel from './components/inspector/InspectorPanel';
import SettingsView from './components/settings/SettingsView';
import SessionRecordsPage from './components/records/SessionRecordsView';

/**
 * App — three-column ops console:
 *   SessionRail (left, bounded resizable width, overlay toggle below md)
 *   LedgerStream + Composer (center)
 *   Inspector (right, collapsible, hidden below lg)
 * Setup / signed-out / loading states replace the shell entirely; the
 * full-page SettingsView swaps with the three-column layout via a simple
 * view state (no router).
 */

const Shell: React.FC = () => {
  const { status } = useAuth();
  const { t } = useI18n();
  const { currentName } = useSessions();
  const [agentSelection, setAgentSelection] = useState<{ session: string | null; id: string | null } | null>(null);
  const selectedAgent = agentSelection?.session === currentName ? agentSelection.id : null;
  const selectAgent = (id: string | null) => setAgentSelection({ session: currentName, id });
  const [railOpen, setRailOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    const resize = () => { setNarrow(window.innerWidth < 1024); setMobileInspectorOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setRailOpen(false); setMobileInspectorOpen(false); } };
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('resize', resize); window.removeEventListener('keydown', escape); };
  }, []);
  const [recordLocation, setRecordLocation] = useState<RecordLocation | null>(null);
  const [view, setView] = useState<'sessions' | 'records' | 'settings' | 'new-session'>('sessions');

  useEffect(() => { setMobileInspectorOpen(false); }, [view]);

  if (status !== 'signedIn') return <LoginGate />;

  const inSettings = view === 'settings';
  const inNewSession = view === 'new-session';
  const inRecords = view === 'records';

  return (
    <RecordNavigation.Provider value={location => { if (location.session === currentName) { setRecordLocation(location); setView('records'); } }}><div className="h-screen flex flex-col bg-ink text-paper">
      <StatusBar
        onToggleRail={inSettings ? undefined : () => { setRailOpen((open) => !open); setMobileInspectorOpen(false); }}
        railOpen={railOpen}
        recordsOpen={inRecords}
        onToggleRecords={inSettings ? undefined : () => { setRecordLocation(null); setView((current) => (current === 'records' ? 'sessions' : 'records')); }}
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
        <WorkspaceSidebar open={railOpen} inspectorVisible={!inRecords && inspectorOpen}>
          <SessionRail
            creating={inNewSession}
            onNewSession={() => { setView('new-session'); setRailOpen(false); }}
            onSelectSession={() => { setView((current) => current === 'records' ? 'records' : 'sessions'); setRailOpen(false); }}
          />
        </WorkspaceSidebar>

        {/* Center: interactive ledger or the server-authoritative records page */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          {inNewSession ? (
            <NewSessionPage onCreated={() => setView('sessions')} onCancel={() => setView('sessions')} />
          ) : inRecords ? (
            <SessionRecordsPage location={recordLocation?.session === currentName ? recordLocation : undefined} />
          ) : (
            <ConversationPane selectedAgent={selectedAgent} inspectorOpen={narrow ? mobileInspectorOpen : inspectorOpen} onToggleInspector={() => { if (narrow) { setMobileInspectorOpen(open => !open); setRailOpen(false); } else setInspectorOpen(open => !open); }} />
          )}
        </main>

        {/* Right: inspector — collapsible, hidden below lg */}
        {!inRecords && (inspectorOpen || mobileInspectorOpen) && (<>
          {mobileInspectorOpen && <button type="button" aria-label={t('status.closeInspector')} className="absolute inset-0 z-20 bg-ink/70 lg:hidden" onClick={() => setMobileInspectorOpen(false)} />}
          <aside
            id="inspector"
            className={`absolute inset-y-0 right-0 z-30 w-80 max-w-[90vw] shrink-0 border-l border-rule bg-panel shadow-xl lg:static lg:max-w-none lg:shadow-none ${mobileInspectorOpen ? 'block' : 'hidden'} ${inspectorOpen ? 'lg:block' : 'lg:hidden'}`}
          >
            <InspectorPanel onSelectAgent={(id) => { selectAgent(id); setMobileInspectorOpen(false); }} selectedAgent={selectedAgent} />
          </aside>
        </>)}
      </div>
      )}
    </div></RecordNavigation.Provider>
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
