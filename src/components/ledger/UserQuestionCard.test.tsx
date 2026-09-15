import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import type { PendingUserQuestions } from '../../api/types';
import UserQuestionCard from './UserQuestionCard';
import { I18nProvider, useI18n } from '../../i18n/I18nContext';

beforeEach(() => localStorage.setItem('veto.lang', 'en'));
afterEach(() => { cleanup(); localStorage.removeItem('veto.lang'); });

function batch(count = 1, callId = 'call-1'): PendingUserQuestions {
  return {
    callId,
    questions: Array.from({ length: count }, (_, index) => ({
      id: `question_${index}`,
      header: `Topic ${index}`,
      question: `Choose ${index}?`,
      options: [
        { label: 'Yes', description: 'Proceed' },
        { label: 'No', description: 'Skip' },
      ],
    })),
  };
}

function setup(value = batch(), answer = vi.fn(async () => {}), cancel = vi.fn(async () => {})) {
  const view = render(<UserQuestionCard key={value.callId} batch={value} onAnswer={answer} onCancel={cancel} />, { wrapper: I18nProvider });
  return { ...view, answer, cancel };
}

function choose(index = 0, option = 'Yes (Recommended) Proceed') {
  fireEvent.click(within(screen.getAllByRole('group')[index]).getByRole('button', { name: option }));
}

function pendingAction() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe('ask_user action flow', () => {
  it('localizes controls and errors without losing custom input on language changes', async () => {
    function Languages() {
      const { setLang } = useI18n();
      return <><button onClick={() => setLang('zh-CN')}>中文</button><button onClick={() => setLang('en')}>English</button></>;
    }
    const answer = vi.fn(async () => { throw new Error('offline'); });
    render(<><Languages /><UserQuestionCard batch={batch()} onAnswer={answer} onCancel={vi.fn(async () => {})} /></>, { wrapper: I18nProvider });
    choose(0, 'Other');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '😀'.repeat(501) } });
    fireEvent.click(screen.getByRole('button', { name: '中文' }));
    expect(screen.getByText('需要你的回答')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '回答：Choose 0?' })).toHaveValue('😀'.repeat(501));
    expect(screen.getByText('回答不能超过 500 个字符。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '继续' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '保留答案' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '继续' })));
    expect(screen.getByRole('alert')).toHaveTextContent('无法连接后端。');
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to reach the backend.');
    expect(screen.getByRole('textbox', { name: 'Answer: Choose 0?' })).toHaveValue('保留答案');
    expect(screen.getByRole('button', { name: 'Other' })).toHaveAttribute('aria-pressed', 'true');
    expect(answer).toHaveBeenCalledExactlyOnceWith({ question_0: '保留答案' });
  });

  it('renders ten questions and submits only when all ten are answered, keyed by id', async () => {
    const { answer } = setup(batch(10));
    expect(screen.getAllByRole('group')).toHaveLength(10);
    for (let index = 0; index < 9; index++) choose(index);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    choose(9, 'No Skip');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
    expect(answer).toHaveBeenCalledExactlyOnceWith(Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [`question_${index}`, index === 9 ? 'No' : 'Yes']),
    ));
  });

  it('requires nonblank Other text and trims the submitted answer', async () => {
    const { answer } = setup();
    choose(0, 'Other');
    const input = screen.getByRole('textbox', { name: 'Answer: Choose 0?' });
    fireEvent.change(input, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '  自定义 answer 😀  ' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
    expect(answer).toHaveBeenCalledExactlyOnceWith({ question_0: '自定义 answer 😀' });
  });

  it('accepts 500 Unicode code points but blocks 501 with accessible feedback', async () => {
    const { answer } = setup();
    choose(0, 'Other');
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '😀'.repeat(501) } });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Answer must be 500 characters or fewer.');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '😀'.repeat(500) } });
    expect(input).toHaveAttribute('aria-invalid', 'false');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
    expect(answer).toHaveBeenCalledExactlyOnceWith({ question_0: '😀'.repeat(500) });
  });

  it('switches from Other to an option without submitting stale custom text', async () => {
    const { answer } = setup();
    choose(0, 'Other');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'custom' } });
    choose();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes (Recommended) Proceed' })).toHaveAttribute('aria-pressed', 'true');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
    expect(answer).toHaveBeenCalledExactlyOnceWith({ question_0: 'Yes' });
  });

  it('treats an option named __other__ as an ordinary answer', async () => {
    const value = batch();
    value.questions[0].options[0].label = '__other__';
    const { answer } = setup(value);
    choose(0, '__other__ (Recommended) Proceed');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
    expect(answer).toHaveBeenCalledExactlyOnceWith({ question_0: '__other__' });
  });

  it.each(['answer', 'cancel'] as const)('allows only the first %s action during same-tick competing clicks', async (first) => {
    const request = pendingAction();
    const answer = vi.fn(() => request.promise);
    const cancel = vi.fn(() => request.promise);
    setup(batch(), answer, cancel);
    choose();
    const submit = screen.getByRole('button', { name: 'Continue' });
    const dismiss = screen.getByRole('button', { name: 'Cancel' });
    act(() => {
      (first === 'answer' ? submit : dismiss).click();
      submit.click();
      dismiss.click();
    });
    expect(answer).toHaveBeenCalledTimes(first === 'answer' ? 1 : 0);
    expect(cancel).toHaveBeenCalledTimes(first === 'cancel' ? 1 : 0);
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
    await act(async () => request.resolve());
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it.each(['answer', 'cancel'] as const)('re-enables retry after asynchronous %s failure', async (action) => {
    const request = pendingAction();
    const callback = vi.fn().mockImplementationOnce(() => request.promise).mockResolvedValue(undefined);
    const answer = action === 'answer' ? callback : vi.fn(async () => {});
    const cancel = action === 'cancel' ? callback : vi.fn(async () => {});
    setup(batch(), answer, cancel);
    choose();
    const name = action === 'answer' ? 'Continue' : 'Cancel';
    fireEvent.click(screen.getByRole('button', { name }));
    await act(async () => request.reject(new ApiError(503, 'Please retry.')));
    expect(screen.getByRole('alert')).toHaveTextContent('Please retry.');
    expect(screen.getByRole('button', { name })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Yes (Recommended) Proceed' })).toHaveAttribute('aria-pressed', 'true');
    await act(async () => fireEvent.click(screen.getByRole('button', { name })));
    expect(callback).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports network failures and permits cancellation without answering', async () => {
    const cancel = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const { answer } = setup(batch(), undefined, cancel);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cancel' })));
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to reach the backend.');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cancel' })));
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(answer).not.toHaveBeenCalled();
  });

  it('isolates a new call with reused question ids from answers and late failures of an old call', async () => {
    const request = pendingAction();
    const answer = vi.fn(() => request.promise);
    const cancel = vi.fn(async () => {});
    const { rerender } = setup(batch(), answer, cancel);
    choose();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const next = batch(1, 'call-2');
    rerender(<UserQuestionCard key={next.callId} batch={next} onAnswer={answer} onCancel={cancel} />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Yes (Recommended) Proceed' })).toHaveAttribute('aria-pressed', 'false');
    await act(async () => request.reject(new ApiError(409, 'Old call expired')));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });
});

it('renders five plain-label choices and adds recommendation without altering the submitted answer', async () => {
  const value = batch();
  value.questions[0].options = Array.from({ length: 5 }, (_, i) => ({ label: `Choice ${i}`, description: `Description ${i}` }));
  const { answer } = setup(value);
  expect(screen.getByRole('button', { name: 'Choice 0 (Recommended) Description 0' })).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Choice 4 Description 4' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  expect(answer).toHaveBeenCalledWith({ question_0: 'Choice 4' });
});
