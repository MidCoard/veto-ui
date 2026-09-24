import React, { useCallback, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useSessions } from '../../state/SessionContext';
import SessionAgents from '../SessionAgents';
import { FrontendPlugins, useFrontendInspectors } from '../plugins/FrontendPlugins';

const InspectorContents: React.FC<{ onSelectAgent?: (id: string | null) => void; selectedAgent?: string | null }> = ({ onSelectAgent, selectedAgent }) => {
  const { t } = useI18n();
  const { currentName } = useSessions();
  const [counts, setCounts] = useState<{ session: string | null; agents?: number | null; [key: string]: number | string | null | undefined }>({ session: null });
  const reportCount = useCallback((key: string, count: number | null) => {
    setCounts(previous => ({ ...(previous.session === currentName ? previous : { session: currentName }), [key]: count }));
  }, [currentName]);
  const countAgents = useCallback((count: number | null) => reportCount('agents', count), [reportCount]);
  const pluginPages = useFrontendInspectors();
  const currentCounts: Record<string, number | string | null | undefined> = counts.session === currentName ? counts : { agents: null };
  const [selected, setActive] = useState('agents');
  const active = ['agents', ...pluginPages.map(page => page.id)].includes(selected) ? selected : 'agents';
  const pages = [
    { id: 'agents', count: currentCounts.agents, label: t('inspector.agentsNav') },
    ...pluginPages.map(page => ({ id: page.id, count: currentCounts[page.id], label: page.label })),
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
        {pluginPages.map(page => <PluginInspector key={page.id} page={page} active={active === page.id} reportCount={reportCount} />)}
      </section>
    </div>
  );
};

function PluginInspector({ page, active, reportCount }: { page: ReturnType<typeof useFrontendInspectors>[number]; active: boolean; reportCount: (key: string, count: number | null) => void }) {
  const onCount = useCallback((count: number | null) => reportCount(page.id, count), [page.id, reportCount]);
  return <div className="h-full min-h-0" hidden={!active}>{page.render(onCount)}</div>;
}
const InspectorPanel: typeof InspectorContents = props => {
  const { currentName, sessions } = useSessions();
  const agent = sessions.find(session => session.name === currentName)?.primaryAgentId ?? undefined;
  return <FrontendPlugins session={currentName ?? undefined} agent={agent} onOpenAgent={props.onSelectAgent}><InspectorContents {...props} /></FrontendPlugins>;
};
export default InspectorPanel;
