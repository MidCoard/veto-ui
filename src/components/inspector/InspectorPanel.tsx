import React, { useCallback, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useSessions } from '../../state/SessionContext';
import BackgroundTasksSection from './BackgroundTasksSection';
import SessionGroups from './SessionGroups';
import SessionAgents from '../SessionAgents';
import SessionMonitors from './SessionMonitors';

const InspectorPanel: React.FC<{ onSelectAgent?: (id: string | null) => void; selectedAgent?: string | null }> = ({ onSelectAgent, selectedAgent }) => {
  const { t } = useI18n();
  const { currentName, bgTasks, bgTasksStatus } = useSessions();
  const [counts, setCounts] = useState<{ session: string | null; agents?: number | null; groups?: number | null; monitors?: number | null }>({ session: null });
  const reportCount = useCallback((key: 'agents' | 'groups' | 'monitors', count: number | null) => {
    setCounts(previous => ({ ...(previous.session === currentName ? previous : { session: currentName }), [key]: count }));
  }, [currentName]);
  const countAgents = useCallback((count: number | null) => reportCount('agents', count), [reportCount]);
  const countGroups = useCallback((count: number | null) => reportCount('groups', count), [reportCount]);
  const countMonitors = useCallback((count: number | null) => reportCount('monitors', count), [reportCount]);
  const currentCounts = counts.session === currentName ? counts : { agents: null, groups: null, monitors: null };
  const [active, setActive] = useState('agents');
  const pages = [
    { id: 'agents', count: currentCounts.agents, label: t('inspector.agentsNav') },
    { id: 'groups', count: currentCounts.groups, label: t('groups.title') },
    { id: 'background', count: currentName === null ? 0 : bgTasksStatus === 'ready' ? bgTasks.length : null, label: t('inspector.bgTasks') },
    { id: 'monitors', count: currentCounts.monitors, label: t('monitors.title') },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 bg-panel">
      <nav aria-label={t('inspector.navigation')} className="shrink-0 grid grid-cols-2 gap-1 border-b border-rule p-2">
        {pages.map(page => (
          <button key={page.id} type="button" aria-pressed={active === page.id} aria-controls="inspector-content"
            onClick={() => setActive(page.id)}
            className={`ui-button rounded-md px-2 py-2 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-paper ${active === page.id ? 'bg-paper/10 text-paper font-semibold' : 'text-dim hover:bg-paper/5 hover:text-paper'}`}>
            {page.label} <span className="tabular-nums text-dim">({currentName === null ? 0 : page.count ?? '—'})</span>
          </button>
        ))}
      </nav>
      <section id="inspector-content" aria-label={pages.find(page => page.id === active)?.label} className="flex-1 overflow-y-auto min-h-0">
        <div className="h-full min-h-0" hidden={active !== 'agents'}><SessionAgents onSelectAgent={onSelectAgent} selectedAgent={selectedAgent} onCount={countAgents} /></div>
        <div className="h-full min-h-0" hidden={active !== 'groups'}><SessionGroups onSelectAgent={onSelectAgent} onCount={countGroups} /></div>
        {active === 'background' && <BackgroundTasksSection />}
        <div className="h-full min-h-0" hidden={active !== 'monitors'}><SessionMonitors onCount={countMonitors} /></div>
      </section>
    </div>
  );
};

export default InspectorPanel;
