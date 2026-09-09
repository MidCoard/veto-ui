import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import AgentComposer from './AgentComposer';
import { sendAgentPrompt } from '../api/endpoints';
import { I18nProvider } from '../i18n/I18nContext';

vi.mock('../api/endpoints', () => ({ sendAgentPrompt: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); });

it('sends to the selected mate and confirms its queued request', async () => {
  vi.mocked(sendAgentPrompt).mockResolvedValue({ status: 'queued', sessionId: 'session' });
  const refresh = vi.fn();
  render(<I18nProvider><AgentComposer sessionName="Session A" agentId="mate-1" onSubmitted={refresh} /></I18nProvider>);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Check the implementation  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByText('Message queued for this agent.');
  expect(sendAgentPrompt).toHaveBeenCalledWith('Session A', 'mate-1', 'Check the implementation');
  expect(screen.getByRole('textbox')).toHaveValue('');
  expect(refresh).toHaveBeenCalledOnce();
});

it('retains the prompt when submission is rejected', async () => {
  vi.mocked(sendAgentPrompt).mockRejectedValue(new Error('Agent is read-only'));
  render(<I18nProvider><AgentComposer sessionName="Session A" agentId="reader" onSubmitted={vi.fn()} /></I18nProvider>);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Review' } });
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
  expect(await screen.findByRole('alert')).toHaveTextContent('Agent is read-only');
  await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
  expect(screen.getByRole('textbox')).toHaveValue('Review');
});
