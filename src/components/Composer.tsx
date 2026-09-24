import { useSessionResource } from '../state/useSessionResource';
import { agentWait } from '../lib/agentWait';
import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useSessions } from '../state/SessionContext';
import { connectionLabelKeys } from '../lib/connectionStatus';
import TokenUsageLine from './TokenUsageLine';
import { promptSubmissionError } from '../lib/promptSubmissionError';

/**
 * Composer — bottom input. Enter sends, Shift+Enter adds a newline.
 * While a prompt is in flight the composer shows the elapsed seconds (mono)
 * and a Cancel button — cancel declines any veto the agent is parked on
 * (backend, fail-safe) and aborts the local wait.
 */
function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const Composer: React.FC = () => {
  const { currentName, pending, elapsedSeconds, sendPrompt, cancelPrompt, busStatus, vetoes, sessions, tokenUsage } = useSessions();
  const { t } = useI18n();
  const session = sessions?.find(item => item.name === currentName);
  const agents = useSessionResource(currentName, 'agents', session?.id);
  const executionWait = agentWait(agents.data?.find(agent => agent.id === session?.primaryAgentId));
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (error && !sending) textareaRef.current?.focus(); }, [error, sending]);
  const disabled = currentName === null;
  const offline = busStatus !== 'connected';
  const waiting = (vetoes?.length ?? 0) > 0 || executionWait !== null;
  const status = disabled ? 'noSession' : busStatus !== 'connected' ? 'offline' : waiting ? 'waiting' : sending ? 'sending' : pending ? 'running' : 'ready';

  const autoGrow = (): void => {
    const textarea = textareaRef.current;
    if (textarea === null) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  const submit = async (): Promise<void> => {
    const trimmed = text.trim();
    if (trimmed === '' || disabled || offline || pending || submitting.current) return;
    submitting.current = true;
    setSending(true);
    setError(null);
    try {
      await sendPrompt(trimmed);
      setText('');
      if (textareaRef.current !== null) textareaRef.current.style.height = 'auto';
    } catch (failure) {
      setError(promptSubmissionError(failure, t));
    } finally {
      submitting.current = false;
      setSending(false);

    }
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div className="shrink-0 border-t border-rule bg-panel px-4 md:px-6 py-3">
      <div className="w-full min-w-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            aria-label={t('composer.placeholder')}
            aria-invalid={error !== null}
            aria-describedby={error ? 'composer-submit-error' : undefined}
            value={text}
            disabled={disabled || sending}
            onChange={(event) => {
              setText(event.target.value);
              setError(null);
              autoGrow();
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled ? t('composer.placeholderDisabled') : t('composer.placeholder')
            }
            className="ui-control flex-1 resize-none bg-raised border border-rule rounded-lg px-3 py-2 text-paper placeholder-dim/60 focus:outline-none focus:border-dim disabled:opacity-50"
          />
          {pending ? (
            <>
              <button
                type="button"
                onClick={cancelPrompt}
                disabled={offline}
                className="ui-button text-sm text-verdict border border-verdict/50 rounded-md px-4 py-2 hover:bg-verdict/10"
              >
                {t('composer.cancel')}
              </button>
            </>
          ) : (
            <button
              type="button"
              aria-busy={sending}
              onClick={() => void submit()}
              disabled={disabled || offline || sending || text.trim() === ''}
              className="ui-button bg-accent text-onaccent text-sm font-medium rounded-md px-4 py-2 hover:bg-accent/85 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('composer.send')}
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-[11px] text-dim">
          <span role="status" className="inline-flex shrink-0 items-center gap-2 py-1">
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${status === 'ready' ? 'bg-pass' : status === 'running' ? 'bg-accent animate-pulse motion-reduce:animate-none' : status === 'waiting' || status === 'offline' ? 'bg-amber-400' : 'bg-dim'}`} />
            {status === 'offline' ? t(connectionLabelKeys[busStatus]) : t(`composer.status.${status}`)}
          </span>
          {pending && !offline && <span className="font-mono tabular-nums">{formatElapsed(elapsedSeconds)}</span>}
          {currentName !== null && <TokenUsageLine usage={tokenUsage} />}
        </div>
        {error && <p id="composer-submit-error" role="alert" className="mt-2 text-xs text-verdict">{error}</p>}
      </div>
    </div>
  );
};

export default Composer;
