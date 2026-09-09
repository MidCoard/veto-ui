import EntryTimestamp from '../EntryTimestamp';
import EntryIcon from './EntryIcon';
import ToolConversationDetails, { toolHeaderField } from './ToolConversationDetails';
import ActivityMark from '../VetoMark';
import React, { useId, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { LedgerEntry as LedgerEntryModel } from '../../state/ledger';
import StreamingMarkdown from '../StreamingMarkdown';
interface LedgerEntryProps { entry: LedgerEntryModel; toolRunning?: boolean }

/** Small conversation previews; full tool payloads remain in Records. */
function ContentPreview({ label, content, removed = false }: { label: string; content: string; removed?: boolean }) {
  const excerpt = content.split('\n').slice(0, 8).join('\n').slice(0, 1000);
  return <div className="min-w-0">
    <p className="mb-1 text-[10px] text-dim">{label}</p>
    <pre className={`whitespace-pre-wrap break-words rounded-md border-l-2 bg-ink/60 px-3 py-2 font-mono text-xs text-paper ${removed ? 'border-verdict/50' : 'border-pass/50'}`}>{excerpt}{excerpt.length < content.length ? '\n…' : ''}</pre>
  </div>;
}

const Chevron: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    aria-hidden="true"
    className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const LedgerEntry: React.FC<LedgerEntryProps> = ({ entry, toolRunning = entry.live === true }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const thoughtId = useId();

  if (entry.kind === 'user') {
    return (
      <div className="ledger-enter flex justify-end py-4" aria-label={t('entry.tagYou')}>
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm border border-rule bg-raised px-4 py-3 text-paper">{entry.text}</p>
      </div>
    );
  }

  if (entry.kind === 'thought') {
    const preview = entry.text.replace(/\s+/g, ' ').trim();
    return (
      <div className="ledger-enter py-2">
        <section className="overflow-hidden rounded-xl border border-rule/70 bg-panel/50">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={thoughtId}
            aria-label={t('entry.thought')}
            className="ui-button flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-dim transition-colors hover:bg-raised/50 hover:text-paper focus-visible:outline-dim"
          >
            <EntryIcon kind="thought" live={entry.live} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-xs font-medium text-paper/80">
                {t(entry.live ? 'tool.thinking' : 'entry.thought')}
                {entry.live && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-dim motion-safe:animate-pulse" />}
              </span>
              {!open && preview !== '' && <span className="mt-1 block truncate text-xs text-dim">{preview.slice(0, 180)}{preview.length > 180 ? '…' : ''}</span>}
            </span>
            <Chevron open={open} />
          </button>
          <div id={thoughtId} hidden={!open}>
            {open && <div className="border-t border-rule/60 px-4 py-3">
              <div className="border-l-2 border-dim/30 pl-4 text-sm leading-relaxed">
                <StreamingMarkdown content={entry.text} isStreaming={entry.live === true} />
              </div>
            </div>}
          </div>
        </section>
      </div>
    );
  }

  if (entry.kind === 'tool_call' || entry.kind === 'tool_result') {
    const result = entry.resultEntry ?? (entry.kind === 'tool_result' ? entry : undefined);
    if (entry.kind === 'tool_result' && entry.toolName === 'think' && entry.success !== false && entry.text === '') return null;
    const args = entry.args ?? {};
    const targetKey = toolHeaderField(entry.toolName ?? '', args);
    const target = targetKey === undefined ? undefined : args[targetKey];
    const objective = ['web_fetch', 'web_read'].includes(entry.toolName ?? '') && typeof args.objective === 'string' ? args.objective : null;
    const writeContent = entry.toolName === 'write_to_file' && typeof args.codeContent === 'string' ? args.codeContent : null;
    const before = entry.toolName === 'replace_file_content' && typeof args.targetContent === 'string' ? args.targetContent : null;
    const after = entry.toolName === 'replace_file_content' && typeof args.replacementContent === 'string' ? args.replacementContent : null;
    const state = result === undefined ? (toolRunning ? 'running' : 'waiting') : result.success === false ? 'failed' : result.success === true ? 'success' : 'completed';
    const status = t(`tool.execution.${state}`);
    return (
      <div className="ledger-enter py-1.5">
        <div className={`overflow-hidden rounded-lg border text-xs ${result === undefined ? 'border-amber-400/30 bg-amber-400/5' : result.success === false ? 'border-verdict/40 bg-verdict/5' : 'border-rule/70 bg-panel/60'}`}><div className="flex items-center gap-2.5 px-3 py-2.5">
          <EntryIcon kind="tool" live={state === 'running'} />
          <span className="shrink-0 font-mono text-paper">{entry.toolName ?? t('tool.activityCall')}</span>
          <span className="min-w-0 flex-1 truncate text-dim" title={typeof target === 'string' ? target : undefined}>{typeof target === 'string' ? target : ''}</span>
          <span role="img" aria-label={status} title={status} className="tool-execution-status shrink-0 p-1" data-state={state}>
            <span aria-hidden="true" className="tool-execution-led" />
          </span>
          </div>
          {entry.kind === 'tool_call' && <ToolConversationDetails toolName={entry.toolName ?? ''} args={entry.args} headerField={targetKey} />}
          {(objective !== null || writeContent !== null || before !== null || after !== null) && <div className="space-y-2 border-t border-rule/60 px-3 py-3">
            {objective !== null && <p className="whitespace-pre-wrap break-words text-paper/85">{objective}</p>}
            {writeContent !== null && <ContentPreview label={t('tool.contentPreview')} content={writeContent} />}
            {before !== null && <ContentPreview label={t('tool.replaceBefore')} content={before} removed />}
            {after !== null && <ContentPreview label={t('tool.replaceAfter')} content={after} />}
          </div>}
        </div>
      </div>
    );
  }

  if (entry.kind === 'error') {
    return (
      <div className="ledger-enter flex gap-3 py-3">
        <span aria-hidden="true" className="text-verdict">!</span>
        <p className="text-sm text-verdict border border-verdict/40 rounded-md px-3 py-2 min-w-0 break-words">
          {entry.text}
        </p>
      </div>
    );
  }

  // message
  return (
    <div className="ledger-enter flex gap-3 py-3">
      <ActivityMark live={entry.live} />
      <div className="min-w-0 flex-1">
        <StreamingMarkdown content={entry.text} isStreaming={entry.live === true} />
        {entry.success === false && (
          <p className="mt-2 text-xs text-verdict">{t('entry.runFailed')}</p>
        )}
      </div>
    </div>
  );
};

export default function TimestampedLedgerEntry(props: LedgerEntryProps) {
  return <div className="min-w-0">
    <LedgerEntry {...props} />
    <div className={`mb-3 flex items-center gap-2 ${props.entry.kind === 'user' ? 'justify-end' : 'pl-8'}`}>
      <EntryTimestamp value={props.entry.timestamp} />
      {props.entry.resultEntry?.timestamp && <><span aria-hidden="true" className="text-[10px] text-dim">→</span><EntryTimestamp value={props.entry.resultEntry.timestamp} /></>}
    </div>
  </div>;
}
