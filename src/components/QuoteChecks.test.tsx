import { RecordNavigation } from '../state/RecordNavigation';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import StreamingMarkdown from './StreamingMarkdown';
import { I18nProvider } from '../i18n/I18nContext';
import { apiRequest } from '../api/client';
vi.mock('../api/client', async original => ({ ...await original<typeof import('../api/client')>(), apiRequest: vi.fn() }));
const origin = { session: 'session', agent: 'author', turn: 3 };
beforeEach(() => { vi.clearAllMocks(); localStorage.setItem('veto.lang', 'en'); });
it('leaves streaming text visible without a check, then displays an unmatched result', async () => {
  vi.mocked(apiRequest).mockResolvedValue([{ id: 'one', status: 'not_found', matches: [] }]);
  const show = (streaming: boolean) => <I18nProvider><StreamingMarkdown content={'[Fabricated quotation](cite:one)'} isStreaming={streaming} quoteOrigin={origin} /></I18nProvider>;
  const view = render(show(true));
  expect(screen.getByText('Fabricated quotation')).toBeVisible();
  expect(apiRequest).not.toHaveBeenCalled();
  view.rerender(show(false));
  fireEvent.click(screen.getByRole('button', { name: 'Fabricated quotation' }));
  await screen.findByText('The quoted text is not in the specified message');
  expect(screen.getByText('Fabricated quotation')).toBeVisible();
});
it('shows a highlighted source as a conversation quotation, not web evidence', async () => {
  vi.mocked(apiRequest).mockResolvedValue([{ id: 'one', status: 'matched', matches: [{ turn: 1, kind: 'conversation', field: 'content', method: 'exact', url: '', excerpt: 'Earlier words here', highlightStart: 8, highlightEnd: 13 }] }]);
  const { container } = render(<I18nProvider><StreamingMarkdown content={'[words](cite:one)'} quoteOrigin={origin} /></I18nProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'words' }));
  await screen.findByText('Conversation quotation');
  expect(container.querySelector('mark')?.textContent).toBe('words');
  expect(screen.queryByText('Web source text matched')).toBeNull();
});
it('ignores a late result after changing the answer', async () => {
  let resolveOld: (value: unknown) => void = () => {};
  vi.mocked(apiRequest).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValue([{ id: 'one', status: 'not_found', matches: [] }]);
  const view = render(<I18nProvider><StreamingMarkdown content={'[old](cite:one)'} quoteOrigin={origin} /></I18nProvider>);
  view.rerender(<I18nProvider><StreamingMarkdown content={'[new](cite:one)'} quoteOrigin={origin} /></I18nProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'new' }));
  await screen.findByText('The quoted text is not in the specified message');
  resolveOld([{ id: 'one', status: 'unavailable', matches: [] }]);
  await waitFor(() => expect(screen.getByText('The quoted text is not in the specified message')).toBeVisible());
});

it('navigates using source offsets without displaying implementation labels', async () => {
  const navigate = vi.fn();
  vi.mocked(apiRequest).mockResolvedValue([{ id: 'one', status: 'matched', matches: [{ turn: 11, kind: 'conversation', field: 'content', method: 'exact', url: '', excerpt: 'Earlier words here', highlightStart: 8, highlightEnd: 13, sourceStart: 108, sourceEnd: 113 }] }]);
  render(<I18nProvider><RecordNavigation.Provider value={navigate}><StreamingMarkdown content={'[words](cite:one)'} quoteOrigin={origin} /></RecordNavigation.Provider></I18nProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'words' }));
  await screen.findByText('Conversation quotation');
  fireEvent.click(screen.getByRole('button', { name: 'View source message' }));
  expect(navigate).toHaveBeenCalledWith({ session: 'session', agent: 'author', turn: 11, field: 'content', start: 108, end: 113, text: 'words' });
  expect(screen.queryByText(/T-11|Exact match|This checks source wording/)).toBeNull();
});

it('ordinary blockquotes never request source discovery', () => {
  render(<I18nProvider><StreamingMarkdown content={'> Earlier words'} quoteOrigin={origin} /></I18nProvider>);
  expect(screen.getByText('Earlier words')).toBeVisible();
  expect(apiRequest).not.toHaveBeenCalled();
});

it('exposes all declared matches and does not hide partial failure', async () => {
  const match = { turn: 1, kind: 'conversation', field: 'content', method: 'exact', url: '', excerpt: 'meeting', highlightStart: 0, highlightEnd: 7, sourceStart: 0, sourceEnd: 7 };
  vi.mocked(apiRequest).mockResolvedValue([{ id: 'one', status: 'unavailable', references: [{ messageIndex: 0, status: 'matched' }, { messageIndex: 2, status: 'not_found' }], matches: [match, { ...match, turn: 2 }] }]);
  render(<I18nProvider><RecordNavigation.Provider value={vi.fn()}><StreamingMarkdown content={'[Meeting](cite:one)'} quoteOrigin={origin} /></RecordNavigation.Provider></I18nProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Meeting' }));
  await screen.findByText('Some declared sources could not be verified.');
  expect(screen.getAllByRole('button', { name: 'View source message' })).toHaveLength(2);
});

it('keeps undeclared markers unavailable and unsafe links inert', async () => {
  vi.mocked(apiRequest).mockResolvedValue([]);
  const { container } = render(<I18nProvider><StreamingMarkdown content={'[missing](cite:unknown) [bad](javascript:alert)'} quoteOrigin={origin} /></I18nProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'missing' }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
  expect(screen.queryByText('Conversation quotation')).toBeNull();
});
