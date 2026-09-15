import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import Composer from './Composer';
import { ApiError } from '../api/client';
const mocks = vi.hoisted(() => ({ sendPrompt: vi.fn(), busStatus: 'connected' }));
beforeEach(() => { mocks.sendPrompt.mockReset(); mocks.busStatus = 'connected'; localStorage.clear(); });
afterEach(cleanup);
import StatusBar from './StatusBar';
vi.mock('../state/AuthContext', () => ({ useAuth: () => ({ username: 'test', signOut: vi.fn() }) }));
vi.mock('../state/SessionContext', () => ({ useSessions: () => ({ currentName: 's', sendPrompt: mocks.sendPrompt, pending: false, busStatus: mocks.busStatus, busActivity: [], tokenUsage: { total: 120, context: 100, max: 128000 } }) }));
it('places current-agent usage below the input and removes the footer shortcut and header usage', () => {
  render(<I18nProvider><StatusBar /><Composer /></I18nProvider>);
  const usage = screen.getByLabelText('Token usage');
  expect(usage).toHaveTextContent('120');
  expect(usage).toHaveTextContent('100 / 128,000');
  expect(screen.getByRole('banner')).not.toContainElement(usage);
  expect(screen.getByRole('textbox').compareDocumentPosition(usage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByText('Enter to send · Shift+Enter for newline')).not.toBeInTheDocument();
});

it('retains the draft until acknowledgement and prevents duplicate sends', async () => {
  let accepted!: () => void;
  mocks.sendPrompt.mockReturnValue(new Promise<void>(resolve => { accepted = resolve; }));
  render(<I18nProvider><Composer /></I18nProvider>);
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: '  synthetic draft  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(input).toHaveValue('  synthetic draft  ');
  expect(input).toBeDisabled();
  expect(mocks.sendPrompt).toHaveBeenCalledExactlyOnceWith('synthetic draft');
  await act(async () => { accepted(); });
  expect(input).toHaveValue('');
  expect(input).toBeEnabled();
});

it('keeps rejected protected input and allows an explicit retry', async () => {
  mocks.sendPrompt.mockRejectedValueOnce(new ApiError(422, 'opaque backend message', 'PROTECTED_INPUT_UNAVAILABLE'));
  render(<I18nProvider><Composer /></I18nProvider>);
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'synthetic draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your draft is retained');
  expect(input).toHaveValue('synthetic draft');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveFocus();
  mocks.sendPrompt.mockResolvedValueOnce(undefined);
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await act(async () => {});
  expect(input).toHaveValue('');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('does not send while the input method is composing', () => {
  render(<I18nProvider><Composer /></I18nProvider>);
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: '输入中' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(mocks.sendPrompt).not.toHaveBeenCalled();
  expect(input).toHaveValue('输入中');
});

it('keeps an editable draft across disconnection and blocks both button and Enter submission', async () => {
  const view = render(<I18nProvider><Composer /></I18nProvider>);
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'Help me plan dinner' } });
  mocks.busStatus = 'reconnecting';
  view.rerender(<I18nProvider><Composer /></I18nProvider>);
  expect(input).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  expect(screen.getByText('Reconnecting')).toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(mocks.sendPrompt).not.toHaveBeenCalled();
  mocks.busStatus = 'connected';
  view.rerender(<I18nProvider><Composer /></I18nProvider>);
  expect(input).toHaveValue('Help me plan dinner');
  expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
});
