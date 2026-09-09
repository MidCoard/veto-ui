import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import Composer from './Composer';
import StatusBar from './StatusBar';
vi.mock('../state/AuthContext', () => ({ useAuth: () => ({ username: 'test', signOut: vi.fn() }) }));
vi.mock('../state/SessionContext', () => ({ useSessions: () => ({ currentName: 's', pending: false, busStatus: 'connected', busActivity: [], tokenUsage: { total: 120, context: 100, max: 128000 } }) }));
it('places current-agent usage below the input and removes the footer shortcut and header usage', () => {
  render(<I18nProvider><StatusBar /><Composer /></I18nProvider>);
  const usage = screen.getByLabelText('Token usage');
  expect(usage).toHaveTextContent('120');
  expect(usage).toHaveTextContent('100 / 128,000');
  expect(screen.getByRole('banner')).not.toContainElement(usage);
  expect(screen.getByRole('textbox').compareDocumentPosition(usage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByText('Enter to send · Shift+Enter for newline')).not.toBeInTheDocument();
});
