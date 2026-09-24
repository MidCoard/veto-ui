import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { activateFrontend } from './runtime';
import { apiRequest } from '../api/client';
import { recoverPluginResources } from './events';
import type { FrontendPlugin, PluginContext } from './api';
vi.mock('../api/client', () => ({ apiRequest: vi.fn(), setHttpErrorLocalizer: vi.fn() }));
const source = readFileSync(resolve(process.env.VETO_SOURCE_ROOT ?? '../../IdeaProjects/veto', 'veto-builtin/src/main/resources/frontend/questions.js'), 'utf8');
let plugin: FrontendPlugin;
beforeAll(async () => { plugin = await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`); });
const disposers: (() => void)[] = [];
afterEach(() => {cleanup(); disposers.splice(0).forEach(dispose=>dispose()); vi.resetAllMocks();});
const batch = (count=1) => ({callId:'call', questions:Array.from({length:count},(_,i)=>({id:`q${i}`,header:`Topic ${i}`,question:`Choose ${i}?`,options:[{label:'Yes',description:'Proceed'},{label:'No',description:'Skip'}]}))});
function mount(count=1) {
 let active=true;
 vi.mocked(apiRequest).mockImplementation(async (_path,options)=>{const action=(options?.body as {action:string}).action;if(action==='list') return {items:active?[batch(count)]:[]} as never; active=false;return true as never;});
 const registration=activateFrontend(plugin,{id:'top.focess.builtin:questions',pluginId:'top.focess.builtin',apiVersion:1,source},'sample','agent',new AbortController().signal);
 disposers.push(registration.dispose);
 const Component=registration.panels.get('questions')!;
 const context:PluginContext={session:'sample',agent:'agent',locale:'en',connected:true,invoke:registration.invoke,subscribe:registration.subscribe};
 const view=render(<Component context={context}/>);
 return {...view,Component,context,registration};
}
it('requires the complete batch, submits once and removes only after confirmed success',async()=>{
 mount(2);await screen.findByText('Choose 1?');
 const next=screen.getByRole('button',{name:'Continue'});expect(next).toBeDisabled();
 for(const group of screen.getAllByRole('group'))fireEvent.click(within(group).getByRole('button',{name:'Yes (Recommended) Proceed'}));
 fireEvent.click(next);fireEvent.click(next);
 await waitFor(()=>expect(screen.queryByText('Choose 0?')).not.toBeInTheDocument());
 const writes=vi.mocked(apiRequest).mock.calls.filter(([,options])=>(options?.body as {action:string}).action==='answer');
 expect(writes).toHaveLength(1);expect(writes[0][1]?.body).toMatchObject({action:'answer',arguments:{callId:'call',answers:{q0:'Yes',q1:'Yes'}}});
});
it('preserves Unicode Other input across locale and connection changes and enforces 500 code points',async()=>{
 const {rerender,Component,context}=mount();await screen.findByText('Choose 0?');fireEvent.click(screen.getByRole('button',{name:'Other'}));
 const input=screen.getByRole('textbox');fireEvent.change(input,{target:{value:'😀'.repeat(501)}});expect(screen.getByRole('button',{name:'Continue'})).toBeDisabled();
 rerender(<Component context={{...context,locale:'zh-CN',connected:false}}/>);expect(input).toHaveValue('😀'.repeat(501));expect(input).toBeDisabled();expect(screen.getByText('回答不能超过 500 个字符。')).toBeInTheDocument();
 rerender(<Component context={{...context,locale:'zh-CN',connected:true}}/>);fireEvent.change(input,{target:{value:'😀'.repeat(500)}});expect(screen.getByRole('button',{name:'继续'})).toBeEnabled();
});
it('retains failed submissions and localizes fallback errors, then permits cancel',async()=>{
 const {rerender,Component,context}=mount();await screen.findByText('Choose 0?');fireEvent.click(screen.getByRole('button',{name:'Yes (Recommended) Proceed'}));
 vi.mocked(apiRequest).mockRejectedValueOnce(new Error('offline'));fireEvent.click(screen.getByRole('button',{name:'Continue'}));await screen.findByRole('alert');
 rerender(<Component context={{...context,locale:'zh-CN'}}/>);expect(screen.getByRole('alert')).toHaveTextContent('无法连接后端');expect(screen.getByRole('button',{name:'Yes （推荐） Proceed'})).toHaveAttribute('aria-pressed','true');
 fireEvent.click(screen.getByRole('button',{name:'取消'}));await waitFor(()=>expect(screen.queryByText('Choose 0?')).not.toBeInTheDocument());
 expect(vi.mocked(apiRequest).mock.calls.some(([,options])=>(options?.body as {action:string}).action==='cancel')).toBe(true);
});
it('refreshes on recovery and aborts loads and subscriptions on unload',async()=>{
 const {unmount}=mount();await screen.findByText('Choose 0?');const before=vi.mocked(apiRequest).mock.calls.length;
 vi.mocked(apiRequest).mockImplementation(()=>new Promise(()=>{}));
 await act(async()=>recoverPluginResources());expect(vi.mocked(apiRequest).mock.calls.length).toBeGreaterThan(before);
 const signal=vi.mocked(apiRequest).mock.calls[vi.mocked(apiRequest).mock.calls.length - 1]?.[1]?.signal;unmount();expect(signal?.aborted).toBe(true);
 const after=vi.mocked(apiRequest).mock.calls.length;await act(async()=>recoverPluginResources());expect(vi.mocked(apiRequest).mock.calls).toHaveLength(after);
});
it('clears old-session cards immediately before a replacement request resolves',async()=>{
 const {rerender,Component,context}=mount();await screen.findByText('Choose 0?');
 vi.mocked(apiRequest).mockImplementation(()=>new Promise(()=>{}));rerender(<Component context={{...context,session:'other'}}/>);expect(screen.queryByText('Choose 0?')).not.toBeInTheDocument();
});
