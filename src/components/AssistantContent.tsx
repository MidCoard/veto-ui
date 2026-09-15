import { assistantContent } from '../lib/assistantContent';
import { useI18n } from '../i18n/I18nContext';
import StreamingMarkdown from './StreamingMarkdown';

function stringValue(value: unknown): string { return typeof value === 'string' ? value : ''; }

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

/** Shared reading view for replay envelopes in conversation and Records. */
export default function AssistantContent({ raw }: { raw: string }) {
  const { t } = useI18n();
  const content = assistantContent(raw);
  return <div className="min-w-0 space-y-2">
    {content.thought && <StreamingMarkdown content={content.thought} />}
    {content.actions && <section className="rounded-md border border-accent/30 bg-accent/5 p-3">
      <h3 className="text-sm text-accent">{t('records.guidedProgram')}</h3>
      <p className="mt-1 text-xs text-dim">{t('records.guidedProgramHint')}</p>
      <ol className="mt-3 space-y-2">{content.actions.map((action, index) => <li key={index} className="rounded border border-rule bg-panel px-3 py-2 text-xs">
        <p className="break-words text-paper">{String(action.label ?? action.id ?? index)}</p>
        <p className="mt-0.5 break-words font-mono text-accent">{actionSummary(action, index)}</p>
        {action.inputs !== undefined && <details className="mt-2">
          <summary className="cursor-pointer rounded text-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">{t('records.arguments')}</summary>
          <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words text-paper">{JSON.stringify(action.inputs, null, 2)}</pre>
        </details>}
      </li>)}</ol>
    </section>}
    {content.diagnostic && <p className="text-sm text-dim">{t('records.unparsedResponse')}</p>}
    {(raw !== content.thought || content.diagnostic) && <details>
      <summary className="cursor-pointer rounded text-xs text-dim hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">{t('records.rawPayload')}</summary>
      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs text-paper">{raw}</pre>
    </details>}
  </div>;
}
