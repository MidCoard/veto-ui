import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FrontendPlugins, useFrontendInspectors } from './FrontendPlugins';
import { frontendModules, loadFrontend, activateFrontend } from '../../plugins/runtime';
import { listSessionAgents } from '../../api/endpoints';
import { publishPluginResource } from '../../plugins/events';
import type { FrontendModule } from '../../plugins/api';
vi.mock('../../i18n/I18nContext', () => ({ useI18n: () => ({ lang: 'en', t: (key: string) => key }) }));
vi.mock('../../api/endpoints', () => ({ listSessionAgents: vi.fn() }));
vi.mock('../../plugins/runtime', async importOriginal => ({ ...await importOriginal<typeof import('../../plugins/runtime')>(), frontendModules: vi.fn(), loadFrontend: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const module: FrontendModule = { id: 'example:page', pluginId: 'example', apiVersion: 1, source: 'one' };
function View() { return <>{useFrontendInspectors().map(page => <section key={page.id}>{page.label}{page.render(() => {})}</section>)}</>; }
function setup() {
  const dispose = vi.fn();
  vi.mocked(frontendModules).mockResolvedValue([module]);
  vi.mocked(loadFrontend).mockImplementation(async (metadata, session, agent, signal) => activateFrontend({ activate(host) {
    host.registerInspector('tasks', { en: 'Plugin tasks' }, ({ context }) => host.React.createElement('button', { onClick: () => void context.openAgent?.('mate').catch(() => {}) }, 'Open Agent'));
    return dispose;
  } }, metadata, session, agent, signal));
  return dispose;
}
it('loads zero plugins without feature requests and unloads immediately on catalog invalidation', async () => {
  const dispose = setup();
  render(<FrontendPlugins session="sample" agent="leader"><View /></FrontendPlugins>);
  await screen.findByText('Plugin tasks');
  vi.mocked(frontendModules).mockResolvedValue([]);
  act(() => publishPluginResource('sample', 'plugin-frontend'));
  expect(screen.queryByText('Plugin tasks')).not.toBeInTheDocument();
  expect(dispose).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(frontendModules).toHaveBeenCalledTimes(2));
  expect(listSessionAgents).not.toHaveBeenCalled();
});
it('checks session Agent ownership before navigation and preserves unchanged views on focus', async () => {
  const dispose = setup(); const open = vi.fn();
  render(<FrontendPlugins session="sample" agent="leader" onOpenAgent={open}><View /></FrontendPlugins>);
  const button = await screen.findByRole('button', { name: 'Open Agent' });
  vi.mocked(listSessionAgents).mockResolvedValue([]); fireEvent.click(button);
  await waitFor(() => expect(listSessionAgents).toHaveBeenCalledTimes(1)); expect(open).not.toHaveBeenCalled();
  vi.mocked(listSessionAgents).mockResolvedValue([{ id: 'mate' }] as never); fireEvent.click(button);
  await waitFor(() => expect(open).toHaveBeenCalledWith('mate'));
  fireEvent.focus(window);
  await waitFor(() => expect(frontendModules).toHaveBeenCalledTimes(2));
  expect(loadFrontend).toHaveBeenCalledTimes(1); expect(dispose).not.toHaveBeenCalled();
});

it('keeps modules mounted when the navigation callback identity changes', async () => {
  const dispose = setup(); const first = vi.fn(); const latest = vi.fn();
  const view = render(<FrontendPlugins session="sample" agent="leader" onOpenAgent={first}><View /></FrontendPlugins>);
  await screen.findByText('Plugin tasks');
  view.rerender(<FrontendPlugins session="sample" agent="leader" onOpenAgent={latest}><View /></FrontendPlugins>);
  expect(frontendModules).toHaveBeenCalledTimes(1); expect(dispose).not.toHaveBeenCalled();
  vi.mocked(listSessionAgents).mockResolvedValue([{ id: 'mate' }] as never);
  fireEvent.click(screen.getByRole('button', { name: 'Open Agent' }));
  await waitFor(() => expect(latest).toHaveBeenCalledWith('mate')); expect(first).not.toHaveBeenCalled();
});

it('reloads renderer registrations when effective aliases change',async()=>{
 const dispose=setup();vi.mocked(frontendModules).mockResolvedValue([{...module,tools:{read:'old'}}]);
 render(<FrontendPlugins session="sample" agent="leader"><View/></FrontendPlugins>);await screen.findByText('Plugin tasks');
 vi.mocked(frontendModules).mockResolvedValue([{...module,tools:{read:'new'}}]);
 fireEvent.focus(window);await waitFor(()=>expect(loadFrontend).toHaveBeenCalledTimes(2));expect(dispose).toHaveBeenCalledTimes(1);
});
it('rejects duplicate producer renderers across modules while allowing other plugins',async()=>{
 const dispose=vi.fn();vi.mocked(frontendModules).mockResolvedValue([
 {...module,id:'example:first',tools:{read:'one'}},{...module,id:'example:second',tools:{read:'one'}},
 {...module,id:'other:first',pluginId:'other',tools:{read:'two'}}]);
 vi.mocked(loadFrontend).mockImplementation(async(metadata,session,agent,signal)=>activateFrontend({activate(host){
 host.registerToolRenderer('read',{call:()=>null});host.registerInspector('test',{en:metadata.id},()=>null);return dispose;
 }},metadata,session,agent,signal));
 render(<FrontendPlugins session="sample" agent="leader"><View/></FrontendPlugins>);
 await screen.findByText('example:first');expect(screen.queryByText('example:second')).not.toBeInTheDocument();expect(screen.getByText('other:first')).toBeVisible();expect(dispose).toHaveBeenCalledTimes(1);expect(screen.getByRole('alert')).toBeVisible();
});
