import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { activateFrontend } from './runtime';
import type { FrontendModule } from './api';
import { apiRequest } from '../api/client';
vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const module: FrontendModule = { id: 'example:frontend', pluginId: 'example', apiVersion: 1, source: '' };
it('runs plugin React hooks and registers arbitrary reference components and panels', () => {
  const abort = new AbortController(); const dispose = vi.fn();
  const registration = activateFrontend({ activate(host) {
    const { createElement: h, useState } = host.React;
    host.registerReferenceRenderer('JOB', () => {
      const [count, setCount] = useState(0);
      return h('button', { onClick: () => setCount(count + 1) }, `Count ${count}`);
    });
    host.registerPanel('jobs', 'conversation.footer', () => h('aside', null, 'Jobs'));
    return dispose;
  } }, module, 'session', 'agent', abort.signal);
  const Component = registration.references.get('JOB')!;
  const Panel = registration.panels.get('jobs')!;
  const context = { session: 'session', agent: 'agent', locale: 'en', invoke: registration.invoke };
  render(<><Component reference="42" context={context} /><Panel context={context} /></>);
  fireEvent.click(screen.getByRole('button')); expect(screen.getByText('Count 1')).toBeVisible();
  expect(screen.getByText('Jobs')).toBeVisible();
  abort.abort(); registration.dispose(); expect(dispose).toHaveBeenCalledTimes(1);
  expect(registration.references.size).toBe(0); expect(registration.panels.size).toBe(0);
});
it('scopes backend requests and cancels them on disposal', async () => {
  let requestSignal!: AbortSignal;
  vi.mocked(apiRequest).mockImplementation((_path, options) => {
    requestSignal = options!.signal!;
    return new Promise((_resolve, reject) => requestSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
  });
  const registration = activateFrontend({ activate() {} }, module, 'private session', 'agent-1', new AbortController().signal);
  const pending = registration.invoke('details', { id: 42 });
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(apiRequest).toHaveBeenCalledWith('/api/sessions/private%20session/plugin-frontend/actions', expect.objectContaining({ body: { moduleId: module.id, agentId: 'agent-1', action: 'details', arguments: { id: 42 } } }));
  registration.dispose(); expect(requestSignal.aborted).toBe(true); await rejected;
  await expect(registration.invoke('details', {})).rejects.toMatchObject({ name: 'AbortError' });
});
it('rolls back partial registrations when activation fails', () => {
  let lifetime!: AbortSignal;
  expect(() => activateFrontend({ activate(host) {
    lifetime = host.signal;
    host.registerReferenceRenderer('JOB', () => null);
    host.registerReferenceRenderer('JOB', () => null);
  } }, module, 's', 'a', new AbortController().signal)).toThrow('Invalid reference registration');
  expect(lifetime.aborted).toBe(true);
});
