import React, { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { cancelTask, getTask, listTasks } from '../../api/endpoints';
import type { TaskDetail, TaskSummary } from '../../api/types';
import { useI18n } from '../../i18n/I18nContext';
import type { Translate } from '../../i18n/I18nContext';
import { formatFullTimestamp } from '../../lib/time';
import CodeHighlight from '../CodeHighlight';

/**
 * TasksTab — backend task list with a detail view and cancel.
 * The backend creates tasks as the agent works; the list is manual-refresh.
 */

function errorText(error: unknown, t: Translate): string {
  if (error instanceof ApiError) return error.message;
  return t('error.backendUnreachable');
}

const TasksTab: React.FC = () => {
  const { t } = useI18n();
  const [tasks, setTasks] = useState<TaskSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      setListError(null);
      const response = await listTasks();
      setTasks(response.tasks);
    } catch (error) {
      setListError(errorText(error, t));
      setTasks([]);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (id: string): Promise<void> => {
    setDetailError(null);
    setConfirmingCancel(false);
    try {
      setDetail(await getTask(id));
    } catch (error) {
      setDetailError(errorText(error, t));
    }
  };

  const handleCancel = async (): Promise<void> => {
    if (detail === null || cancelling) return;
    setCancelling(true);
    setDetailError(null);
    try {
      await cancelTask(detail.id);
      setConfirmingCancel(false);
      setDetail(null);
      await load();
    } catch (error) {
      setDetailError(errorText(error, t));
      setConfirmingCancel(false);
    } finally {
      setCancelling(false);
    }
  };

  if (detail !== null) {
    return (
      <div className="p-3 space-y-3">
        <button
          type="button"
          onClick={() => setDetail(null)}
          className="text-xs text-dim hover:text-paper hover:bg-raised rounded-md px-2 py-1"
        >
          {t('tasks.back')}
        </button>

        <div className="space-y-1">
          <div className="font-mono text-xs text-accent break-all">{detail.id}</div>
          <div className="text-sm text-paper">{detail.taskType}</div>
          <div className="font-mono text-[11px] text-dim uppercase tracking-wider">
            {detail.dagStatus}
          </div>
        </div>

        <dl className="space-y-1.5 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-dim">{t('tasks.source')}</dt>
            <dd className="font-mono text-paper/70 text-right break-all">{detail.sourceComponent ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-dim">{t('tasks.target')}</dt>
            <dd className="font-mono text-paper/70 text-right break-all">{detail.targetComponent ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-dim">{t('tasks.created')}</dt>
            <dd className="font-mono text-paper/70 text-right">{formatFullTimestamp(detail.createdAt)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-dim">{t('tasks.updated')}</dt>
            <dd className="font-mono text-paper/70 text-right">{formatFullTimestamp(detail.updatedAt)}</dd>
          </div>
        </dl>

        <div className="space-y-1">
          <span className="font-display text-[10px] uppercase tracking-[0.14em] text-dim">
            {t('tasks.parameters')}
          </span>
          <CodeHighlight
            code={JSON.stringify(detail.parameters, null, 2)}
            language="json"
            showLineNumbers={false}
          />
        </div>

        {detail.dependencies.length > 0 && (
          <div className="space-y-1">
            <span className="font-display text-[10px] uppercase tracking-[0.14em] text-dim">
              {t('tasks.dependencies')}
            </span>
            <CodeHighlight
              code={JSON.stringify(detail.dependencies, null, 2)}
              language="json"
              showLineNumbers={false}
            />
          </div>
        )}

        {detailError !== null && (
          <p role="alert" className="text-xs text-verdict border border-verdict/40 rounded-md px-2 py-1.5 break-words">
            {detailError}
          </p>
        )}

        {confirmingCancel ? (
          <div className="flex items-center gap-2 border border-verdict/40 rounded-md px-2 py-1.5">
            <span className="text-xs text-dim flex-1">{t('tasks.cancelConfirm')}</span>
            <button
              type="button"
              onClick={() => void handleCancel()}
              disabled={cancelling}
              className="text-xs text-verdict border border-verdict/50 rounded-md px-2 py-0.5 hover:bg-verdict/10 disabled:opacity-50"
            >
              {cancelling ? t('tasks.cancelling') : t('tasks.cancelTask')}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingCancel(false)}
              className="text-xs text-dim hover:text-paper hover:bg-raised rounded-md px-2 py-0.5"
            >
              {t('tasks.keep')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingCancel(true)}
            className="w-full text-xs text-verdict border border-verdict/50 rounded-md px-2 py-1.5 hover:bg-verdict/10"
          >
            {t('tasks.cancelTask')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <button
        type="button"
        onClick={() => void load()}
        className="w-full text-xs text-accent hover:bg-accent/10 border border-rule rounded-md px-2 py-1.5"
      >
        {t('tasks.refresh')}
      </button>

      {listError !== null && (
        <p role="alert" className="text-xs text-verdict border border-verdict/40 rounded-md px-2 py-1.5 break-words">
          {listError}
        </p>
      )}
      {detailError !== null && (
        <p role="alert" className="text-xs text-verdict border border-verdict/40 rounded-md px-2 py-1.5 break-words">
          {detailError}
        </p>
      )}

      {tasks === null ? (
        <p className="text-sm text-dim">{t('tasks.loading')}</p>
      ) : tasks.length === 0 && listError === null ? (
        <p className="text-sm text-dim">{t('tasks.empty')}</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-dim border-b border-rule">
              <th className="pb-1.5 font-medium">{t('tasks.colId')}</th>
              <th className="pb-1.5 font-medium">{t('tasks.colType')}</th>
              <th className="pb-1.5 font-medium">{t('tasks.colStatus')}</th>
              <th className="pb-1.5 font-medium">{t('tasks.colCreated')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule/60">
            {tasks.map((task) => (
              <tr
                key={task.id}
                onClick={() => void openDetail(task.id)}
                className="cursor-pointer hover:bg-raised/60"
              >
                <td className="py-1.5 pr-2 font-mono text-dim" title={task.id}>
                  {task.id.slice(0, 8)}…
                </td>
                <td className="py-1.5 pr-2 text-paper/80 break-all">{task.taskType}</td>
                <td className="py-1.5 pr-2 font-mono text-dim uppercase">{task.status}</td>
                <td className="py-1.5 font-mono text-dim/70">{formatFullTimestamp(task.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default TasksTab;
