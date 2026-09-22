import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/I18nContext';
import type { PluginNode, PluginView } from '../../api/pluginViews';
import PluginViewRenderer from './PluginView';
afterEach(cleanup);
const text = (fallback: string): PluginNode => ({ type: 'text', text: {fallback,translations:{}} });
const view = (content: PluginNode[]): PluginView => ({content,resetAfterMillis:0,resetOnHidden:false});
it('renders a non-secret status panel and dispatches the plugin-defined action', async () => {
 const initial=view([{type:'group',direction:'COLUMN',children:[text('Build #42'),{type:'button',label:{fallback:'Refresh status',translations:{}},action:{target:'SERVER',id:'refresh-job'}}]}]);
 const invoke=vi.fn(async () => view([text('Completed'),{type:'button',label:{fallback:'Back',translations:{}},action:{target:'RESET',id:'back'}}]));
 render(<I18nProvider><PluginViewRenderer initialView={initial} invoke={invoke} /></I18nProvider>);
 expect(screen.getByText('Build #42')).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Refresh status'}));
 expect(await screen.findByText('Completed')).toBeVisible();expect(invoke).toHaveBeenCalledWith('refresh-job',expect.any(AbortSignal));
 fireEvent.click(screen.getByRole('button',{name:'Back'}));expect(screen.getByText('Build #42')).toBeVisible();expect(invoke).toHaveBeenCalledTimes(1);
});
it('discards pending action results after reset', async () => {
 let finish!: (value: PluginView) => void;
 const invoke=()=>new Promise<PluginView>(resolve=>{finish=resolve;});
 const initial=view([{type:'button',label:{fallback:'Load details',translations:{}},action:{target:'SERVER',id:'details'}}]);
 render(<I18nProvider><PluginViewRenderer initialView={initial} invoke={invoke} /></I18nProvider>);
 const button=screen.getByRole('button');fireEvent.click(button);fireEvent.keyDown(button,{key:'Escape'});finish(view([text('stale result')]));
 await waitFor(()=>expect(screen.queryByText('stale result')).not.toBeInTheDocument());expect(button).toBeEnabled();
});
