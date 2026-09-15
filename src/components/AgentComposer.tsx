import { useEffect, useId, useRef, useState } from 'react';
import { sendAgentPrompt } from '../api/endpoints';
import { useI18n } from '../i18n/I18nContext';
import { promptSubmissionError } from '../lib/promptSubmissionError';

/** Direct agent commands use the selected agent's endpoint, independently of the primary run. */
export default function AgentComposer({ sessionName, agentId, onSubmitted }: {
  sessionName: string; agentId: string; onSubmitted: () => void;
}) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);
  useEffect(() => { if (error && !sending) input.current?.focus(); }, [error, sending]);
  const submit = async () => {
    const prompt = text.trim();
    if (!prompt || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    setQueued(false);
    try {
      await sendAgentPrompt(sessionName, agentId, prompt);
      setText('');
      setQueued(true);
      onSubmitted();
    } catch (failure) {
      setError(promptSubmissionError(failure, t));
    } finally { inFlight.current = false; setSending(false); }
  };
  return <div className="shrink-0 border-t border-rule bg-panel px-4 py-3 md:px-6">
    <div className="flex items-end gap-2">
      <textarea ref={input} aria-invalid={error !== null} aria-describedby={error ? errorId : undefined} rows={2} value={text} disabled={sending} aria-label={t('conversation.messageAgent')}
        placeholder={t('conversation.messageAgent')} onChange={event => { setText(event.target.value); setQueued(false); setError(null); }}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); } }}
        className="ui-control flex-1 resize-none rounded-lg border border-rule bg-raised px-3 py-2 text-paper placeholder-dim/60" />
      <button type="button" aria-busy={sending} disabled={sending || !text.trim()} onClick={() => void submit()}
        className="ui-button rounded-md bg-accent px-4 py-2 text-sm text-onaccent disabled:opacity-50">{t('composer.send')}</button>
    </div>
    <p className="mt-2 text-xs text-dim" role="status">{t(queued ? 'conversation.agentQueued' : 'conversation.agentQueueNote')}</p>
    {error && <p id={errorId} role="alert" className="mt-2 text-xs text-verdict">{error}</p>}
  </div>;
}
