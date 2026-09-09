import AgentCard from '../AgentCard';
import { tokenUsageFromHistory } from '../../lib/tokenUsage';
import BusyIndicator from '../BusyIndicator';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import { getSessionRecords, listSessionAgents } from '../../api/endpoints';
import type {
  SessionRecord,
  SessionAgent,
  SessionRecordsView as RecordsResponse,
} from '../../api/types';
import { useI18n } from '../../i18n/I18nContext';
import EntryTimestamp from '../EntryTimestamp';
import { useSessions } from '../../state/SessionContext';
import StreamingMarkdown from '../StreamingMarkdown';
import { ToolCallCard, ToolResultBody } from '../ledger/ToolCards';

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function actionSummary(action: Record<string, unknown>, index: number): string {
  const type = stringValue(action.type);
  const target = (value: unknown): string => typeof value === 'number' ? String(value) : '—';
  switch (type) {
    case 'tool': return `tool · ${stringValue(action.tool)}`;
    case 'goto': return `goto → ${target(action.index)}`;
    case 'conditional_goto': return `conditional_goto · true → ${target(action.true_goto)} · false → ${target(action.false_goto ?? index + 1)}`;
    case 'STOP': return `STOP${typeof action.result_binding === 'string' ? ` · ${action.result_binding}` : ''}`;
    default: return type;
  }
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
  if (type === 'MONITOR_EVENT') return { card: 'border-teal-400/40 bg-teal-400/5', dot: 'bg-teal-400', label: 'text-teal-300' };
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
  const [expanded, setExpanded] = useState(false);
  return (
    <details className="group mt-3" onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary className="cursor-pointer select-none font-mono text-[11px] uppercase tracking-[0.12em] text-dim hover:text-paper">
        {label}
      </summary>
      {expanded && <div className="mt-2 overflow-hidden rounded-md border border-rule bg-codebg">
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
                className={`ui-button rounded px-2.5 py-1 transition-colors ${
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
      </div>}
    </details>
  );
};

type ToolResultPresentation = RecordsResponse['toolResultPresentation'];

interface DetailedToolResult {
  status: string;
  format: string;
  content: string;
  errorCode: string;
  exactModelContent: string | null;
}

function detailedToolResult(payload: Record<string, unknown>): DetailedToolResult {
  const storedContent = stringValue(payload.content);
  try {
    const parsed = JSON.parse(storedContent) as Record<string, unknown>;
    if (
      parsed !== null
      && typeof parsed === 'object'
      && typeof parsed.status === 'string'
      && typeof parsed.format === 'string'
      && typeof parsed.content === 'string'
      && ('errorCode' in parsed)
    ) {
      return {
        status: parsed.status,
        format: parsed.format,
        content: parsed.content,
        errorCode: stringValue(parsed.errorCode),
        exactModelContent: storedContent,
      };
    }
  } catch {}
  return {
    status: stringValue(payload.status) || 'unknown',
    format: stringValue(payload.format) || 'unknown',
    content: storedContent,
    errorCode: stringValue(payload.errorCode),
    exactModelContent: null,
  };
}

const RecordBody: React.FC<{ record: SessionRecord; toolResultPresentation: ToolResultPresentation; toolName?: string }> = ({
  record,
  toolResultPresentation,
  toolName,
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
      let guide: Record<string, unknown> | null = null;
      try {
        const parsed = JSON.parse(raw) as { thought?: unknown; guide?: unknown };
        if (parsed.guide !== null && typeof parsed.guide === 'object' && !Array.isArray(parsed.guide)) {
          guide = parsed.guide as Record<string, unknown>;
          thought = '';
        }
        if (typeof parsed.thought === 'string') thought = parsed.thought;
      } catch {
        // The raw provider thought is still the authoritative value.
      }
      return (
        <div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-dim">{thought}</p>
          {guide !== null && (
            <section className="mt-2 rounded-md border border-accent/30 bg-accent/5 p-3">
              <h3 className="text-sm text-accent">{t('records.guidedProgram')}</h3>
              <p className="mt-1 text-xs text-dim">{t('records.guidedProgramHint')}</p>
              {Array.isArray(guide.actions) && (
                <ol className="mt-3 space-y-2">
                  {guide.actions.map((value: unknown, index: number) => {
                    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
                    const action = value as Record<string, unknown>;
                    return (
                      <li key={index} className="flex gap-3 rounded border border-rule bg-ink/30 px-3 py-2 text-xs">
                        <span className="font-mono text-dim">{index}</span>
                        <div className="min-w-0">
                          <p className="break-words text-paper">{stringValue(action.label) || stringValue(action.id)}</p>
                          <p className="mt-0.5 break-words font-mono text-accent">{actionSummary(action, index)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              <ExactPayload label={t('records.arguments')} value={json(guide.actions ?? [])} />
            </section>
          )}
          {thought !== raw && <ExactPayload label={t('records.rawPayload')} value={raw} />}
        </div>
      );
    }
    case 'ASSISTANT_RESPONSE':
      return <p className="whitespace-pre-wrap text-sm leading-6">{stringValue(payload.content)}</p>;
    case 'TOOL_CALL':
      return <ToolCallCard toolName={stringValue(payload.tool_name)} args={payload.args !== null && typeof payload.args === 'object' && !Array.isArray(payload.args) ? payload.args as Record<string, unknown> : undefined} />;
    case 'TOOL_RESPONSE': {
      if (toolName === 'web_fetch' || toolName === 'web_search') return <ToolResultBody toolName={toolName} text={stringValue(payload.content)} success={typeof payload.success === 'boolean' ? payload.success : undefined} />;
      const detailedMode = toolResultPresentation === 'DETAILED';
      const result = detailedToolResult(payload);
      return (
        <div>
          <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-dim">
            {payload.success === true
              ? t('records.success')
              : payload.success === false
                ? t('records.failed')
                : t('records.unknownToolStatus')}
          </div>
          {detailedMode && (
            <dl className="mb-3 grid gap-2 font-mono text-[11px] sm:grid-cols-3">
              <div className="rounded-md border border-rule bg-ink/45 px-3 py-2">
                <dt className="uppercase tracking-wider text-dim">{t('records.status')}</dt>
                <dd className="mt-1 text-paper">{result.status}</dd>
              </div>
              <div className="rounded-md border border-rule bg-ink/45 px-3 py-2">
                <dt className="uppercase tracking-wider text-dim">{t('records.format')}</dt>
                <dd className="mt-1 text-paper">{result.format}</dd>
              </div>
              <div className="rounded-md border border-rule bg-ink/45 px-3 py-2">
                <dt className="uppercase tracking-wider text-dim">{t('records.errorCode')}</dt>
                <dd className="mt-1 text-paper">{result.errorCode || '—'}</dd>
              </div>
            </dl>
          )}
          <div className={detailedMode ? 'rounded-md border border-rule bg-codebg p-3' : ''}>
            {detailedMode && (
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
                {t('records.content')}
              </div>
            )}
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-paper/90">
              {detailedMode ? result.content : stringValue(payload.content)}
            </pre>
          </div>
          {payload.approval != null && <ExactPayload label={t('records.approvalReceipt')} value={JSON.stringify(payload.approval, null, 2)} />}
          {detailedMode && result.exactModelContent !== null && (
            <ExactPayload label={t('records.rawPayload')} value={result.exactModelContent} />
          )}
        </div>
      );
    }
    case 'REWIND':
      return (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>{t(payload.record_index === undefined ? 'records.rewindFrom' : 'records.rewindRecordFrom', { index: Number(payload.record_index ?? payload.from_index ?? 0) })}</span>
          <span className="rounded-full border border-rule bg-raised px-2 py-0.5 font-mono text-xs text-dim">
            {t('records.removed', { count: record.rewoundRecords })}
          </span>
          {stringValue(payload.content) !== '' && (
            <ExactPayload label={t('records.reinjectedContent')} value={stringValue(payload.content)} />
          )}
        </div>
      );
    case 'MONITOR_EVENT':
    case 'COMPACTION_SUMMARY':
      return <ExactPayload label={t('records.compactionSummary')} value={stringValue(payload.content)} open />;
    default:
      return <ExactPayload label={t('records.rawPayload')} value={json(payload)} open />;
  }
};

const RecordCard = React.memo(({
  record,
  toolResultPresentation,
  toolName,
}: { record: SessionRecord; toolResultPresentation: ToolResultPresentation; toolName?: string }) => {
  const { t } = useI18n();
  const [raw, setRaw] = useState(false);
  const isTool = record.type === 'TOOL_CALL' || record.type === 'TOOL_RESPONSE';
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
          {typeof record.payload.restored_from_turn === 'number' && <p className="mb-2 text-xs text-dim">{t('records.restoredFrom', { index: record.payload.restored_from_turn })}</p>}
          <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={`font-display text-[11px] font-bold uppercase tracking-[0.14em] ${tone.label}`}>
              {record.type}
            </span>
            <span className="font-mono text-[11px] text-dim">T-{String(record.turnNumber).padStart(2, '0')}</span>
            <span className="font-mono text-[11px] text-dim" title={record.agentId}>
              {t('records.agent')} {shortAgent(record.agentId)}
            </span>
            {!['REWIND', 'TOKEN_USAGE'].includes(record.type) && (
              <span className="font-mono text-[11px] text-dim" title={t('records.blockTokensHelp')}>
                {t('records.blockTokens')}: {record.tokenCountSource === 'estimated' || (record.usedTokens ?? record.tokenCount) == null ? '—' : (record.usedTokens ?? record.tokenCount)?.toLocaleString()}
              </span>
            )}
            <span className="ml-auto"><EntryTimestamp value={record.timestamp} /></span>
          </header>
          {isTool && <div role="group" aria-label={t('records.toolDisplay')} className="mb-3 flex gap-1">
            <button type="button" aria-pressed={!raw} aria-label={`${t('records.renderedView')} ${record.type}`} onClick={() => setRaw(false)} className="ui-button rounded border border-rule px-2 py-1 text-xs text-dim aria-pressed:bg-raised aria-pressed:text-paper">{t('records.renderedView')}</button>
            <button type="button" aria-pressed={raw} aria-label={`${t('records.rawView')} ${record.type}`} onClick={() => setRaw(true)} className="ui-button rounded border border-rule px-2 py-1 text-xs text-dim aria-pressed:bg-raised aria-pressed:text-paper">{t('records.rawView')}</button>
          </div>}
          {isTool && raw ? <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md border border-rule bg-codebg p-4 font-mono text-xs text-paper">{json(record.payload)}</pre> : <RecordBody record={record} toolResultPresentation={toolResultPresentation} toolName={toolName} />}
        </div>
      </article>
    </li>
  );
});

const EmptyRecords: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-dim">{text}</div>
);

const RecordTimeline = React.memo(({ records, presentation }: { records: SessionRecord[]; presentation: ToolResultPresentation }) => {
  const [limit, setLimit] = useState(40);
  const { t } = useI18n();
  const toolNames = useMemo(() => {
    const calls = new Map<string, string>();
    const names = new Map<SessionRecord, string>();
    for (const record of records) {
      const id = stringValue(record.payload.call_id);
      if (record.type === 'TOOL_CALL' && id) calls.set(id, stringValue(record.payload.tool_name));
      if (record.type === 'TOOL_RESPONSE') names.set(record, calls.get(id) ?? stringValue(record.payload.tool_name));
    }
    return names;
  }, [records]);
  return (
    <div className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <ol className="relative mx-auto max-w-5xl space-y-4 before:absolute before:bottom-5 before:left-[0.7rem] before:top-5 before:w-px before:bg-rule">
        {records.slice(0, limit).map((record) => <RecordCard key={`${record.agentId}-${record.turnNumber}`} record={record} toolResultPresentation={presentation} toolName={toolNames.get(record)} />)}
      </ol>
      {records.length > limit && <button type="button" onClick={() => setLimit((current) => current + 40)} className="ui-button mx-auto mt-5 block rounded-md border border-rule bg-panel px-4 py-2 text-sm text-paper">{t('records.loadMore', { count: records.length - limit })}</button>}
    </div>
  );
});

const SessionRecordsPage: React.FC = () => {
  const { currentName, pending, sessions, recordsRevision, busStatus } = useSessions();
  const { t } = useI18n();
  const [data, setData] = useState<RecordsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roster, setRoster] = useState<SessionAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const requestVersion = useRef(0);
  const request = useRef<AbortController | null>(null);
  const refreshQueued = useRef(false);
  const previousSignal = useRef({ recordsRevision, busStatus, pending });

  const load = useCallback(async (quiet = false): Promise<void> => {
    if (currentName === null) return;
    if (quiet && request.current !== null) { refreshQueued.current = true; return; }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const version = ++requestVersion.current;
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const [records, agents] = await Promise.all([getSessionRecords(currentName, controller.signal), listSessionAgents(currentName, controller.signal)]);
      if (version !== requestVersion.current) return;
      setData(records);
      setRoster(agents);
    } catch (cause) {
      if (version === requestVersion.current) setError(cause instanceof ApiError ? cause.message : t('records.loadFailed'));
    } finally {
      if (request.current === controller) request.current = null;
      if (!quiet && version === requestVersion.current) setLoading(false);
      if (version === requestVersion.current && refreshQueued.current) {
        refreshQueued.current = false;
        void load(true);
      }
    }
  }, [currentName, t]);

  useEffect(() => {
    setData(null);
    setRoster([]);
    setSelectedAgent('');
    if (currentName === null) return;
    void load();
    return () => { refreshQueued.current = false; requestVersion.current += 1; request.current?.abort(); request.current = null; };
  }, [currentName, load]);

  useEffect(() => {
    if (currentName === null) return;
    const onFocus = () => { if (document.visibilityState === 'visible') void load(true); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [currentName, load]);

  useEffect(() => {
    const previous = previousSignal.current;
    if (previous.recordsRevision === recordsRevision && previous.busStatus === busStatus && previous.pending === pending) return;
    const timer = window.setTimeout(() => {
      previousSignal.current = { recordsRevision, busStatus, pending };
      void load(true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [recordsRevision, busStatus, pending, load]);

  const agents = useMemo(
    () => {
      const entries = new Map(roster.map((agent) => [agent.id, agent.name]));
      for (const record of data?.records ?? []) {
        if (!entries.has(record.agentId)) entries.set(record.agentId, shortAgent(record.agentId));
      }
      return [...entries].map(([id, name]) => ({ id, name }));
    },
    [data, roster],
  );
  const primaryAgentId = sessions.find((session) => session.name === currentName)?.primaryAgentId;
  const activeAgentId = agents.some((agent) => agent.id === selectedAgent) ? selectedAgent
    : agents.some((agent) => agent.id === primaryAgentId) ? primaryAgentId : agents[0]?.id;
  const recordsByAgent = useMemo(() => {
    const groups = new Map<string, SessionRecord[]>();
    for (const record of data?.records ?? []) {
      const group = groups.get(record.agentId) ?? [];
      group.push(record);
      groups.set(record.agentId, group);
    }
    return groups;
  }, [data]);
  const rosterById = useMemo(() => new Map(roster.map((agent) => [agent.id, agent])), [roster]);
  const visibleRecords = recordsByAgent.get(activeAgentId ?? '') ?? [];

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

        </div>
        {data !== null && (
          <>
            <div className="mx-auto mt-4 flex max-w-5xl flex-wrap gap-2 font-mono text-[11px] text-dim">
              <span className="rounded-full border border-rule px-2.5 py-1">{t('records.visible', { count: visibleRecords.filter((record) => record.active).length })}</span>
              <span className="rounded-full border border-rule px-2.5 py-1">{t('records.raw', { count: visibleRecords.length })}</span>
              <span className="rounded-full border border-rule px-2.5 py-1">{t('records.agents', { count: agents.length })}</span>
              <span className="rounded-full border border-rule px-2.5 py-1">
                {t(data.guidedEnabled ? 'records.guidedOn' : 'records.guidedOff')}
              </span>
              {data.toolResultPresentation === 'DETAILED' && (
                <span className="rounded-full border border-blue-400/35 bg-blue-400/10 px-2.5 py-1 text-blue-200">
                  {t('records.toolResultFeature')}
                </span>
              )}
            </div>
          </>
        )}
      </header>

      {error !== null && <div className="border-b border-verdict/30 bg-verdict/10 px-8 py-2 text-sm text-verdict">{error}</div>}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav aria-label={t('records.selectAgent')} className="shrink-0 border-b border-rule bg-panel p-3 md:order-last md:w-80 md:overflow-y-auto md:border-b-0 md:border-l">
          <h2 className="mb-3 text-[10px] font-semibold tracking-widest text-dim">{t('agents.title')}</h2>
          <ul className="flex gap-2.5 overflow-x-auto [&>li]:min-w-64 md:flex-col md:overflow-x-visible md:[&>li]:min-w-0">
            {agents.map((agent) => {
              const metadata = rosterById.get(agent.id);
              const identity = agent.id === primaryAgentId ? 'primary'
                : metadata?.parentAgentId != null && metadata.parentCallId != null ? 'tool'
                  : metadata?.role === 'MATE' ? 'mate' : 'other';
              const cardAgent: SessionAgent = metadata ?? { ...agent, role: null, state: null, parentAgentId: null, parentCallId: null, live: false, createdAt: null, startedAt: null, endedAt: null };
              return <AgentCard key={agent.id} agent={cardAgent} primaryAgentId={primaryAgentId}
                parent={rosterById.get(cardAgent.parentAgentId ?? '')}
                selected={activeAgentId === agent.id} onSelect={() => setSelectedAgent(agent.id)}
                ariaLabel={`${agent.name} ${t(`agents.identity.${identity}`)}`}
                usedTokens={tokenUsageFromHistory([...(recordsByAgent.get(agent.id) ?? [])].sort((a, b) => a.turnNumber - b.turnNumber)).total} />;
            })}
          </ul>
        </nav>
      {loading && data === null ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-dim"><BusyIndicator label={t('records.loading')} /></div>
      ) : data === null || visibleRecords.length === 0 ? (
        <EmptyRecords text={t(activeAgentId === undefined ? 'records.empty' : 'records.agentEmpty')} />
      ) : (
        <RecordTimeline key={`${currentName}-${activeAgentId}`} records={visibleRecords} presentation={data.toolResultPresentation} />
      )}
      </div>
    </section>
  );
};

export default function SessionRecordsView() {
  const { currentName } = useSessions();
  return <SessionRecordsPage key={currentName ?? ''} />;
}
