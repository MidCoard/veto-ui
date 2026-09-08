import React, { useMemo, useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import type { PendingUserQuestions } from '../../api/types';

interface Props {
  batch: PendingUserQuestions;
  onAnswer: (answers: Record<string, string>) => Promise<void>;
  onCancel: () => Promise<void>;
}

const OTHER = Symbol('other');
const MAX_ANSWER_LENGTH = 500;

const UserQuestionCard: React.FC<Props> = ({ batch, onAnswer, onCancel }) => {
  const [choices, setChoices] = useState<Record<string, string | typeof OTHER>>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const pending = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answers = useMemo(() => {
    const result: Record<string, string> = {};
    for (const question of batch.questions) {
      const choice = choices[question.id];
      if (choice === OTHER) result[question.id] = (other[question.id] ?? '').trim();
      else if (choice !== undefined) result[question.id] = choice;
    }
    return result;
  }, [batch.questions, choices, other]);
  const complete = batch.questions.every((question) => {
    const answer = answers[question.id] ?? '';
    return answer !== '' && Array.from(answer).length <= MAX_ANSWER_LENGTH;
  });

  const run = async (action: () => Promise<void>): Promise<void> => {
    if (pending.current) return;
    pending.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to reach the backend.');
      pending.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="ledger-enter flex gap-3 py-2">
      <span className="w-12 shrink-0 pt-1 text-right font-mono text-[10px] uppercase tracking-wider text-accent">
        ask
      </span>
      <section className="min-w-0 flex-1 overflow-hidden rounded-xl border border-accent/35 bg-panel shadow-[0_0_28px_rgba(94,234,212,0.05)]">
        <header className="border-b border-rule bg-accent/5 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Input needed</p>
          <p className="mt-1 text-sm text-paper">The agent is waiting for your choice.</p>
        </header>
        <div className="space-y-5 p-4">
          {batch.questions.map((question) => (
            <fieldset key={question.id} className="space-y-2">
              <legend className="w-full">
                <span className="font-mono text-[10px] uppercase tracking-wider text-dim">
                  {question.header}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-paper">
                  {question.question}
                </span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {question.options.map((option) => {
                  const selected = choices[question.id] === option.label;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      aria-pressed={selected}
                      disabled={submitting}
                      onClick={() => setChoices((prev) => ({ ...prev, [question.id]: option.label }))}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        selected
                          ? 'border-accent bg-accent/10 text-paper'
                          : 'border-rule bg-codebg/40 text-paper/80 hover:border-accent/50'
                      }`}
                    >
                      <span className="block text-xs font-medium">{option.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-dim">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={choices[question.id] === OTHER}
                  disabled={submitting}
                  onClick={() => setChoices((prev) => ({ ...prev, [question.id]: OTHER }))}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                    choices[question.id] === OTHER
                      ? 'border-accent bg-accent/10 text-paper'
                      : 'border-rule bg-codebg/40 text-paper/80 hover:border-accent/50'
                  }`}
                >
                  Other
                </button>
              </div>
              {choices[question.id] === OTHER && (
                <>
                  <input
                    aria-label={`Answer: ${question.question}`}
                    aria-invalid={Array.from(answers[question.id] ?? '').length > MAX_ANSWER_LENGTH}
                    aria-describedby={`answer-limit-${batch.callId}-${question.id}`}
                    autoFocus
                    value={other[question.id] ?? ''}
                    disabled={submitting}
                    onChange={(event) =>
                      setOther((prev) => ({ ...prev, [question.id]: event.target.value }))
                    }
                    placeholder="Enter your answer"
                    className="w-full rounded-lg border border-rule bg-codebg px-3 py-2 text-sm text-paper outline-none focus:border-accent"
                  />
                  <p id={`answer-limit-${batch.callId}-${question.id}`} className="text-xs text-dim" aria-live="polite">
                    {Array.from(answers[question.id] ?? '').length > MAX_ANSWER_LENGTH
                      ? `Answer must be ${MAX_ANSWER_LENGTH} characters or fewer.`
                      : `Up to ${MAX_ANSWER_LENGTH} characters.`}
                  </p>
                </>
              )}
            </fieldset>
          ))}
          <div className="flex items-center gap-2 border-t border-rule pt-3">
            <button
              type="button"
              disabled={!complete || submitting}
              onClick={() => void run(() => onAnswer(answers))}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black disabled:opacity-40"
            >
              {submitting ? 'Sending…' : 'Continue'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void run(onCancel)}
              className="rounded-md border border-rule px-3 py-1.5 text-xs text-dim hover:text-paper disabled:opacity-40"
            >
              Cancel
            </button>
            {error !== null && <span role="alert" className="text-xs text-verdict">{error}</span>}
          </div>
        </div>
      </section>
    </div>
  );
};

export default UserQuestionCard;
