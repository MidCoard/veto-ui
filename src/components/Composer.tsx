import React, { useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useSessions } from '../state/SessionContext';

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
  const { currentName, pending, elapsedSeconds, sendPrompt, cancelPrompt } = useSessions();
  const { t } = useI18n();
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const disabled = currentName === null;

  const autoGrow = (): void => {
    const textarea = textareaRef.current;
    if (textarea === null) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  const submit = (): void => {
    const trimmed = text.trim();
    if (trimmed === '' || disabled || pending) return;
    setText('');
    if (textareaRef.current !== null) textareaRef.current.style.height = 'auto';
    void sendPrompt(trimmed);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="shrink-0 border-t border-rule bg-panel px-4 md:px-8 py-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            disabled={disabled}
            onChange={(event) => {
              setText(event.target.value);
              autoGrow();
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled ? t('composer.placeholderDisabled') : t('composer.placeholder')
            }
            className="flex-1 resize-none bg-raised border border-rule rounded-lg px-3 py-2 text-paper placeholder-dim/60 focus:outline-none focus:border-accent disabled:opacity-50"
          />
          {pending ? (
            <>
              <span className="font-mono text-sm text-accent tabular-nums pb-2">
                {formatElapsed(elapsedSeconds)}
              </span>
              <button
                type="button"
                onClick={cancelPrompt}
                className="text-sm text-verdict border border-verdict/50 rounded-md px-4 py-2 hover:bg-verdict/10"
              >
                {t('composer.cancel')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={disabled || text.trim() === ''}
              className="bg-accent text-onaccent text-sm font-medium rounded-md px-4 py-2 hover:bg-accent/85 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('composer.send')}
            </button>
          )}
        </div>
        {pending && (
          <p className="mt-1.5 text-xs text-dim">{t('composer.cancelNote')}</p>
        )}
      </div>
    </div>
  );
};

export default Composer;
