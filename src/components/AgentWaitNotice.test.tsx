import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import type { SessionAgent } from '../api/types';
import { I18nProvider } from '../i18n/I18nContext';
import AgentWaitNotice from './AgentWaitNotice';
import AgentCard from './AgentCard';

const agent: SessionAgent = { id: 'primary', name: 'Primary', role: 'LEADER', state: 'WAITING', live: false, parentAgentId: null, parentCallId: null, createdAt: null, startedAt: null, endedAt: null };
beforeEach(() => localStorage.clear());

it.each([
  ['APPROVAL', 'Awaiting approval', 'pending approval'],
  ['QUESTION', 'Awaiting your answer', 'pending questions'],
  ['BREAKER', 'Call limit reached', 'continue'],
  ['FUTURE_REASON', 'Awaiting user input', 'pending questions or approvals'],
])('explains %s without hiding an offline primary behind Dormant', (reason, title, hint) => {
  render(<I18nProvider><AgentWaitNotice agent={{ ...agent, executionWait: reason }} /><ul><AgentCard agent={{ ...agent, executionWait: reason }} primaryAgentId="primary" selected={false} usedTokens={null} /></ul></I18nProvider>);
  expect(screen.getByRole('status')).toHaveTextContent(title);
  expect(screen.getByRole('status')).toHaveTextContent(hint);
  expect(screen.getByRole('listitem')).toHaveTextContent(title);
  expect(screen.getByRole('listitem')).toHaveAttribute('data-tone', 'attention');
  expect(screen.queryByText('Dormant')).not.toBeInTheDocument();
});

it('prioritizes pause, localizes cached state, and hides a terminated hold', () => {
  localStorage.setItem('veto.lang', 'zh-CN');
  const view = render(<I18nProvider><AgentWaitNotice stale agent={{ ...agent, state: 'PAUSED', executionWait: 'QUESTION' }} /></I18nProvider>);
  expect(screen.getByRole('status')).toHaveTextContent('上次已知状态 · 已暂停');
  expect(screen.queryByText('等待你的回答')).not.toBeInTheDocument();
  view.rerender(<I18nProvider><AgentWaitNotice agent={{ ...agent, state: 'TERMINATED', executionWait: 'QUESTION' }} /></I18nProvider>);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('does not invent a recovery hold for legacy agents without executionWait', () => {
  render(<I18nProvider><AgentWaitNotice agent={agent} /></I18nProvider>);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
