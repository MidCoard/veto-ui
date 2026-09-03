import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../api/client';
import { getSessionRecords } from '../../api/endpoints';
import type { SessionRecord, SessionRecordsView as RecordsResponse } from '../../api/types';
import { useI18n } from '../../i18n/I18nContext';
import { formatTimestamp } from '../../lib/time';
import { useSessions } from '../../state/SessionContext';
import StreamingMarkdown from '../StreamingMarkdown';

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function shortAgent(agentId: string): string {
  return agentId === 'legacy' ? agentId : agentId.slice(0, 8);
}

interface RecordTone {
  card: string;
  dot: string;
  label: string;
}

function typeTone(type: string, success: unknown, active: boolean): RecordTone {
  if (!active) {
    return {
      card: 'border-slate-500/35 bg-slate-500/5',
      dot: 'bg-slate-500',
      label: 'text-slate-400',
    };
  }
  if (type === 'AGENT_INIT') {
    return { card: 'border-violet-500/45 bg-violet-500/10', dot: 'bg-violet-400', label: 'text-violet-300' };
  }
  if (type === 'USER_PROMPT') {
    return { card: 'border-sky-500/45 bg-sky-500/10', dot: 'bg-sky-400', label: 'text-sky-300' };
  }
  if (type === 'USER_INTERRUPT') {
    return { card: 'border-pink-500/45 bg-pink-500/10', dot: 'bg-pink-400', label: 'text-pink-300' };
  }
  if (type === 'ASSISTANT_THOUGHT') {
    return { card: 'border-indigo-500/45 bg-indigo-500/10', dot: 'bg-indigo-400', label: 'text-indigo-300' };
  }
  if (type === 'ASSISTANT_RESPONSE') {
    return { card: 'border-paper/40 bg-paper/5', dot: 'bg-paper', label: 'text-paper' };
  }
  if (type === 'TOOL_CALL') {
    return { card: 'border-fuchsia-500/45 bg-fuchsia-500/10', dot: 'bg-fuchsia-400', label: 'text-fuchsia-300' };
  }
  if (type === 'TOOL_RESPONSE' && success === true) {
    return { card: 'border-pass/45 bg-pass/10', dot: 'bg-pass', label: 'text-pass' };
  }
  if (type === 'TOOL_RESPONSE' && success === false) {
    return { card: 'border-verdict/45 bg-verdict/10', dot: 'bg-verdict', label: 'text-verdict' };
  }
  if (type === 'TOOL_RESPONSE') {
    return { card: 'border-amber-400/45 bg-amber-400/10', dot: 'bg-amber-400', label: 'text-amber-300' };
  }
  if (type === 'REWIND') {
    return { card: 'border-dashed border-slate-400/45 bg-slate-500/10', dot: 'bg-slate-400', label: 'text-slate-300' };
  }
  if (type === 'COMPACTION_SUMMARY') {
    return { card: 'border-blue-400/45 bg-blue-500/10', dot: 'bg-blue-400', label: 'text-blue-300' };
  }
  return { card: 'border-rule bg-panel', dot: 'bg-dim', label: 'text-paper' };
}

const ExactPayload: React.FC<{ label: string; value: string; open?: boolean }> = ({
  label,
  value,
  open = false,
}) => (
  <details open={open} className="group mt-3">
    <summary className="cursor-pointer select-none font-mono text-[11px] uppercase tracking-[0.12em] text-dim hover:text-paper">
      {label}
    </summary>
    <pre className="mt-2 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-md border border-rule bg-codebg p-4 font-mono text-xs leading-5 text-[#DDE3EA]">
      {value}
    </pre>
  </details>
);

const SystemPromptPayload: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const { t } = useI18n();
  const [mode, setMode] = useState<'markdown' | 'raw'>('markdown');
  return (
    <details className="group mt-3">
      <summary className="cursor-pointer select-none font-mono text-[11px] uppercase tracking-[0.12em] text-dim hover:text-paper">
        {label}
      </summary>
      <div className="mt-2 overflow-hidden rounded-md border border-rule bg-codebg">
        <div className="flex justify-end border-b border-rule bg-raised/40 px-3 py-2">
          <div
            role="group"
            aria-label={t('records.systemPromptDisplay')}
            className="inline-flex rounded-md border border-rule bg-ink p-0.5 font-mono text-[11px]"
          >
            {(['markdown', 'raw'] as const).map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-pressed={mode === candidate}
                onClick={() => setMode(candidate)}
                className={`rounded px-2.5 py-1 transition-colors ${
                  mode === candidate
                    ? 'bg-paper text-ink'
                    : 'text-dim hover:bg-raised hover:text-paper'
                }`}
              >
                {candidate === 'markdown' ? t('records.markdownView') : t('records.rawView')}
              </button>
            ))}
          </div>
        </div>
        {mode === 'markdown' ? (
          <div className="max-h-[40rem] overflow-auto px-5 py-4 text-sm">
            <StreamingMarkdown content={value} />
          </div>
        ) : (
          <pre className="max-h-[40rem] overflow-auto whitespace-pre-wrap break-words px-5 py-4 font-mono text-xs leading-5 text-[#DDE3EA]">
            {value}
          </pre>
        )}
      </div>
    </details>
  );
};

type ToolResultPresentation = RecordsResponse['toolResultPresentation'];

const RecordBody: React.FC<{ record: SessionRecord; toolResultPresentation: ToolResultPresentation }> = ({
  record,
  toolResultPresentation,
}) => {
  const { t } = useI18n();
  const payload = record.payload;
  switch (record.type) {
    case 'AGENT_INIT':
      {
        const role = stringValue(payload.role);
        const showRole = role !== '' && role.toLowerCase() !== 'legacy';
      return (
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-dim">
            {showRole && (
              <>
                <span className="rounded-full border border-violet-400/35 bg-violet-400/10 px-2 py-0.5 font-mono uppercase tracking-wider text-violet-200">
                  {role}
                </span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span>{t('records.provider')}: {stringValue(payload.provider) || '—'}</span>
            <span aria-hidden="true">·</span>
            <span>{t('records.model')}: {stringValue(payload.model) || '—'}</span>
          </div>
          <SystemPromptPayload label={t('records.openSystemPrompt')} value={stringValue(payload.system_prompt)} />
        </div>
      );
      }
    case 'USER_PROMPT':
      return <p className="whitespace-pre-wrap text-sm leading-6">{stringValue(payload.content)}</p>;
    case 'USER_INTERRUPT':
      return <p className="whitespace-pre-wrap text-sm leading-6">{stringValue(payload.feedback)}</p>;
    case 'ASSISTANT_THOUGHT': {
      const raw = stringValue(payload.response);
      let thought = raw;
      try {
        const parsed = JSON.parse(raw) as { thought?: unknown };
        if (typeof parsed.thought === 'string') thought = parsed.thought;
      } catch {
        // The raw provider thought is still the authoritative value.
      }
      return (
        <div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-dim">{thought}</p>
          {thought !== raw && <ExactPayload label={t('records.rawPayload')} value={raw} />}
        </div>
      );
    }
    case 'ASSISTANT_RESPONSE':
      return <p className="whitespace-pre-wrap text-sm leading-6">{stringValue(payload.content)}</p>;
    case 'TOOL_CALL':
      return (
        <div>
          <p className="font-mono text-sm text-fuchsia-300">{stringValue(payload.tool_name)}</p>
          <ExactPayload label={t('records.arguments')} value={json(payload.args ?? {})} open />
        </div>
      );
    case 'TOOL_RESPONSE': {
      const metadataMode = toolResultPresentation === 'DETAILED';
      return (
        <div>
          <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-dim">
            {payload.success === true
              ? t('records.success')
              : payload.success === false
                ? t('records.failed')
                : t('records.unknownToolStatus')}
          </div>
          {metadataMode && (
            <dl className="mb-3 grid gap-2 font-mono text-[11px] sm:grid-cols-3">
              <div className="rounded-md border border-rule bg-ink/45 px-3 py-2">
                <dt className="uppercase tracking-wider text-dim">{t('records.status')}</dt>
                <dd className="mt-1 text-paper">{stringValue(payload.status) || 'unknown'}</dd>
              </div>
              <div className="rounded-md border border-rule bg-ink/45 px-3 py-2">
                <dt className="uppercase tracking-wider text-dim">{t('records.format')}</dt>
                <dd className="mt-1 text-paper">{stringValue(payload.format) || 'unknown'}</dd>
              </div>
              <div className="rounded-md border border-rule bg-ink/45 px-3 py-2">
                <dt className="uppercase tracking-wider text-dim">{t('records.errorCode')}</dt>
                <dd className="mt-1 text-paper">{stringValue(payload.errorCode) || '—'}</dd>
              </div>
            </dl>
          )}
          <div className={metadataMode ? 'rounded-md border border-rule bg-codebg p-3' : ''}>
            {metadataMode && (
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
                {t('records.content')}
              </div>
            )}
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-paper/90">
              {stringValue(payload.content)}
            </pre>
          </div>
        </div>
      );
    }
    case 'REWIND':
      return (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>{t('records.rewindFrom', { index: Number(payload.from_index ?? 0) })}</span>
          <span className="rounded-full border border-rule bg-raised px-2 py-0.5 font-mono text-xs text-dim">
            {t('records.removed', { count: record.rewoundRecords })}
          </span>
          {stringValue(payload.content) !== '' && (
            <ExactPayload label={t('records.reinjectedContent')} value={stringValue(payload.content)} />
          )}
        </div>
      );
    case 'COMPACTION_SUMMARY':
      return <ExactPayload label={t('records.compactionSummary')} value={stringValue(payload.content)} open />;
    default:
      return <ExactPayload label={t('records.rawPayload')} value={json(payload)} open />;
  }
};

const RecordCard: React.FC<{ record: SessionRecord; toolResultPresentation: ToolResultPresentation }> = ({
  record,
  toolResultPresentation,
}) => {
  const { t } = useI18n();
  const tone = typeTone(record.type, record.payload.success, record.active);
  return (
    <li className={`relative pl-10 ${record.active ? '' : 'opacity-60'}`}>
      <span className={`absolute left-[0.42rem] top-5 h-2.5 w-2.5 rounded-full border-2 border-ink ${tone.dot}`} />
      <article
        data-record-state={record.active ? 'active' : 'rewound'}
        className={`relative overflow-hidden rounded-lg border p-4 ${tone.card}`}
      >
        {!record.active && (
          <div className="mb-3 flex justify-end">
            <span className="rounded-full border border-slate-500/50 bg-ink px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 no-underline">
              {record.rewoundByTurnNumber > 0
                ? t('records.rewoundBy', {
                    turn: String(record.rewoundByTurnNumber).padStart(2, '0'),
                  })
                : t('records.superseded')}
            </span>
          </div>
        )}
        <div className={record.active ? '' : 'line-through decoration-slate-400/70 decoration-2'}>
          <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={`font-display text-[11px] font-bold uppercase tracking-[0.14em] ${tone.label}`}>
              {record.type}
            </span>
            <span className="font-mono text-[11px] text-dim">T-{String(record.turnNumber).padStart(2, '0')}</span>
            <span className="font-mono text-[11px] text-dim" title={record.agentId}>
              {t('records.agent')} {shortAgent(record.agentId)}
            </span>
            <time className="ml-auto font-mono text-[11px] text-dim" dateTime={record.timestamp}>
              {formatTimestamp(record.timestamp)}
            </time>
          </header>
          <RecordBody record={record} toolResultPresentation={toolResultPresentation} />
        </div>
      </article>
    </li>
  );
};

const EmptyRecords: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-dim">{text}</div>
);

const SessionRecordsPage: React.FC = () => {
  const { currentName, pending } = useSessions();
  const { t } = useI18n();
  const [data, setData] = useState<RecordsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (quiet = false): Promise<void> => {
    if (currentName === null) return;
    if (!quiet) setLoading(true);
    setError(null);
    try {
      setData(await getSessionRecords(currentName));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t('records.loadFailed'));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [currentName, t]);

  useEffect(() => {
    setData(null);
    if (currentName === null) return;
    void load();
  }, [currentName, load]);

  useEffect(() => {
    if (!pending || currentName === null) return;
    const interval = window.setInterval(() => void load(true), 2000);
    return () => window.clearInterval(interval);
  }, [currentName, load, pending]);

  const agents = useMemo(
    () => new Set(data?.records.map((record) => record.agentId) ?? []).size,
    [data],
  );

  if (currentName === null) return <EmptyRecords text={t('records.noSession')} />;

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-ink">
      <header className="shrink-0 border-b border-rule bg-panel px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-display text-[11px] uppercase tracking-[0.16em] text-accent">{t('records.eyebrow')}</p>
            <h1 className="mt-1 truncate font-display text-xl font-bold text-paper">{currentName}</h1>
            <p className="mt-1 text-sm text-dim">{t('records.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-md border border-rule bg-raised px-3 py-1.5 text-sm text-dim hover:text-paper disabled:opacity-50"
          >
            {loading ? t('records.loading') : t('records.refresh')}
          </button>
        </div>
        {data !== null && (
          <div className="mx-auto mt-4 flex max-w-5xl flex-wrap gap-2 font-mono text-[11px] text-dim">
            <span className="rounded-full border border-rule px-2.5 py-1">{t('records.visible', { count: data.visibleRecordCount })}</span>
            <span className="rounded-full border border-rule px-2.5 py-1">{t('records.raw', { count: data.rawRecordCount })}</span>
            <span className="rounded-full border border-rule px-2.5 py-1">{t('records.rewound', { count: data.rewoundRecordCount })}</span>
            <span className="rounded-full border border-rule px-2.5 py-1">{t('records.agents', { count: agents })}</span>
            {data.toolResultPresentation === 'DETAILED' && (
              <span className="rounded-full border border-blue-400/35 bg-blue-400/10 px-2.5 py-1 text-blue-200">
                {t('records.toolResultFeature')}: {t('records.contentWithMetadata')}
              </span>
            )}
          </div>
        )}
      </header>

      {error !== null && <div className="border-b border-verdict/30 bg-verdict/10 px-8 py-2 text-sm text-verdict">{error}</div>}
      {loading && data === null ? (
        <EmptyRecords text={t('records.loading')} />
      ) : data === null || data.records.length === 0 ? (
        <EmptyRecords text={t('records.empty')} />
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <ol className="relative mx-auto max-w-5xl space-y-4 before:absolute before:bottom-5 before:left-[0.7rem] before:top-5 before:w-px before:bg-rule">
            {data.records.map((record) => (
              <RecordCard
                key={`${record.agentId}-${record.turnNumber}`}
                record={record}
                toolResultPresentation={data.toolResultPresentation}
              />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
};

export default SessionRecordsPage;
