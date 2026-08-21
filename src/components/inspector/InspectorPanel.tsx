import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import BackgroundTasksSection from './BackgroundTasksSection';
import TasksTab from './TasksTab';

/**
 * InspectorPanel — the right-hand panel. Two sections:
 *   - Background tasks: the CURRENT session's run_task processes (running first,
 *     then stopped), live via TASK_STARTED/TASK_EXITED frames, with a stop action.
 *   - Tasks: the legacy DAG task list (backend-created; kept alongside).
 * (Patterns moved out — PatternsTab.tsx is kept for the Settings page. The veto
 * gateway is an internal mechanism — it deliberately has no panel here.)
 */
const InspectorPanel: React.FC = () => {
  const { t } = useI18n();

  const sectionHeader = (label: string) => (
    <div className="flex items-center px-3 h-9 border-y border-rule bg-panel/80 first:border-t-0">
      <span className="font-display text-[10px] uppercase tracking-[0.14em] text-dim">{label}</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-panel">
      <div className="flex-1 overflow-y-auto min-h-0">
        {sectionHeader(t('inspector.bgTasks'))}
        <BackgroundTasksSection />
        {sectionHeader(t('inspector.tasks'))}
        <TasksTab />
      </div>
    </div>
  );
};

export default InspectorPanel;
