import React, { useEffect, useState } from 'react';
import { stopOrRemoveBgTask } from '../../api/endpoints';
import type { BgTask } from '../../api/types';
import { useI18n } from '../../i18n/I18nContext';
import type { Translate } from '../../i18n/I18nContext';
import { useSessions } from '../../state/SessionContext';

/**
 * BackgroundTasksSection — the current session's run_task background tasks,
 * running first then stopped (exit codes stay visible). Kept live by
 * TASK_STARTED/TASK_EXITED frames (SessionContext refreshes the list); while a
 * task runs, a 3s poll refreshes the output tail so the panel shows what the
 * process is printing right now. Running tasks get Stop; stopped tasks get
 * Remove (both hit the same DELETE — the backend stops alive tasks and removes
 * stopped ones).
 */

/** Compact elapsed-time label: "12s", "3m 4s", "1h 2m". */
function formatUptime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function statusLabel(task: BgTask, t: Translate): string {
  return task.alive ? t('tool.taskAlive') : t('tool.taskExit', { code: task.exitCode ?? '?' });
}

const BackgroundTasksSection: React.FC = () => {
  const { t } = useI18n();
  const { bgTasks, refreshBgTasks, currentName } = useSessions();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const anyRunning = bgTasks.some((task) => task.alive);

  // Live output: while any task runs, refresh the list every 3s so the output
  // tail tracks the process. Lifecycle events also refresh (SessionContext);
  // this poll only fills the gap between events.
  useEffect(() => {
    if (!anyRunning) return;
    const timer = setInterval(() => void refreshBgTasks(), 3000);
    return () => clearInterval(timer);
  }, [anyRunning, refreshBgTasks]);

  const handleAction = async (task: BgTask): Promise<void> => {
    if (currentName === null || busyId !== null) return;
    setBusyId(task.taskId);
    setError(null);
    try {
      await stopOrRemoveBgTask(currentName, task.taskId);
      await refreshBgTasks();
    } catch {
      setError(t('error.backendUnreachable'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-3 space-y-2">
      {error !== null && (
        <p role="alert" className="text-xs text-verdict border border-verdict/40 rounded-md px-2 py-1.5 break-words">
          {error}
        </p>
      )}

      {bgTasks.length === 0 ? (
        <p className="text-xs text-dim">{t('bgtasks.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {bgTasks.map((task) => (
            <li key={task.taskId} className="border border-rule rounded-md p-2 space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={
                    task.alive
                      ? 'text-[10px] font-mono uppercase tracking-wider text-pass border border-pass/40 rounded px-1.5 py-0.5'
                      : 'text-[10px] font-mono uppercase tracking-wider text-dim border border-rule rounded px-1.5 py-0.5'
                  }
                >
                  {statusLabel(task, t)}
                </span>
                <span className="font-mono text-[11px] text-dim">{task.taskId}</span>
                <span className="ml-auto font-mono text-[11px] text-dim" title={t('tool.task')}>
                  {formatUptime(task.uptimeSeconds)}
                </span>
              </div>

              <div className="font-mono text-xs text-paper break-all">{task.command}</div>
              <div className="font-mono text-[11px] text-dim break-all">{task.cwd}</div>

              {(task.recentOutput ?? '') !== '' && (
                <pre className="font-mono text-[11px] leading-relaxed text-paper/80 bg-codebg border border-rule rounded-md px-2 py-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap break-all">
                  {task.recentOutput}
                </pre>
              )}

              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-dim">pid {task.pid}</span>
                <button
                  type="button"
                  onClick={() => void handleAction(task)}
                  disabled={busyId !== null}
                  className={
                    task.alive
                      ? 'text-xs text-verdict border border-verdict/50 rounded-md px-2 py-0.5 hover:bg-verdict/10 disabled:opacity-50'
                      : 'text-xs text-dim border border-rule rounded-md px-2 py-0.5 hover:bg-raised disabled:opacity-50'
                  }
                >
                  {busyId === task.taskId
                    ? task.alive
                      ? t('bgtasks.stopping')
                      : t('bgtasks.removing')
                    : task.alive
                      ? t('bgtasks.stop')
                      : t('bgtasks.remove')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default BackgroundTasksSection;
