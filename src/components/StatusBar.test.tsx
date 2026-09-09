import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import StatusBar from './StatusBar';
import TokenUsageLine from './TokenUsageLine';
vi.mock('../state/AuthContext', () => ({useAuth: () => ({username:'test',signOut:vi.fn()})}));
const state = vi.hoisted(() => ({usage:{total:52000 as number|null,context:38000 as number|null,max:128000 as number|null}}));
vi.mock('../state/SessionContext', () => ({useSessions: () => ({currentName:'session',busStatus:'connected',busActivity:[],tokenUsage:state.usage})}));
describe('token status', () => {
  it('shows usage and context limit without opening a popover', () => {
    state.usage={total:52000,context:38000,max:128000};
    render(<I18nProvider><StatusBar /><TokenUsageLine usage={state.usage} /></I18nProvider>);
    const status=screen.getByRole('status');
    expect(status).toHaveTextContent('52,000');
    expect(status).toHaveTextContent('38,000 / 128,000');
  });
  it('does not present missing measurements as zero', () => {
    state.usage={total:null,context:null,max:128000};
    render(<I18nProvider><StatusBar /><TokenUsageLine usage={state.usage} /></I18nProvider>);
    expect(screen.getByRole('status')).toHaveTextContent('— / 128,000');
  });
});
