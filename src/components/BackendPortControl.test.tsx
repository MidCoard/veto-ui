import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';
import BackendPortControl from './BackendPortControl';

describe('BackendPortControl', () => {
  beforeEach(() => localStorage.clear());

  it('persists a valid port and asks the app to reconnect', () => {
    const onApplied = vi.fn();
    render(
      <I18nProvider>
        <BackendPortControl onApplied={onApplied} />
      </I18nProvider>,
    );

    fireEvent.change(screen.getByLabelText('Backend port'), { target: { value: '9443' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply and reconnect' }));

    expect(localStorage.getItem('veto.backend.port')).toBe('9443');
    expect(onApplied).toHaveBeenCalledOnce();
  });

  it('shows an error instead of applying an invalid port', () => {
    const onApplied = vi.fn();
    render(
      <I18nProvider>
        <BackendPortControl onApplied={onApplied} />
      </I18nProvider>,
    );

    fireEvent.change(screen.getByLabelText('Backend port'), { target: { value: '70000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply and reconnect' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a port from 1 to 65535.');
    expect(onApplied).not.toHaveBeenCalled();
  });
});
