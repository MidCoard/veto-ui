import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import WorkspaceSidebar from './WorkspaceSidebar';

let availableWidth = 1280;
let measure: () => void;

beforeEach(() => {
  localStorage.clear();
  availableWidth = 1280;
  vi.stubGlobal('innerWidth', 1280);
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { measure = callback; }
    observe() {}
    disconnect() {}
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ width: availableWidth } as DOMRect));
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = () => true;
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function setup() {
  render(<I18nProvider><div><WorkspaceSidebar open inspectorVisible>Workspaces</WorkspaceSidebar></div></I18nProvider>);
  return screen.getByRole('separator', { name: 'Resize workspace sidebar' });
}

describe('workspace divider', () => {
  it('clamps pointer dragging and stops resizing after release', () => {
    const divider = setup();
    fireEvent.pointerDown(divider, { button: 0, clientX: 280 });
    fireEvent.pointerMove(divider, { clientX: 900 });
    expect(divider).toHaveAttribute('aria-valuenow', '420');
    fireEvent.pointerMove(divider, { clientX: -100 });
    expect(divider).toHaveAttribute('aria-valuenow', '220');
    fireEvent.pointerUp(divider);
    fireEvent.pointerMove(divider, { clientX: 300 });
    expect(divider).toHaveAttribute('aria-valuenow', '220');
  });

  it('supports keyboard resizing and reserves center space as the window shrinks', () => {
    const divider = setup();
    fireEvent.keyDown(divider, { key: 'End' });
    expect(divider).toHaveAttribute('aria-valuenow', '420');
    availableWidth = 1024;
    act(() => measure());
    expect(divider).toHaveAttribute('aria-valuemax', '378');
    expect(divider).toHaveAttribute('aria-valuenow', '378');
    fireEvent.keyDown(divider, { key: 'Home' });
    fireEvent.keyDown(divider, { key: 'ArrowLeft' });
    expect(divider).toHaveAttribute('aria-valuenow', '220');
    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    expect(divider).toHaveAttribute('aria-valuenow', '236');
  });
});
