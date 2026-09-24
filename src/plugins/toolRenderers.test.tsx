import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {FrontendScopeContext,FrontendTool} from '../components/plugins/FrontendPlugins';
import {activateFrontend,type Registration} from './runtime';
import {I18nProvider} from '../i18n/I18nContext';
import type {ToolIdentity} from './api';
afterEach(cleanup);
function registration(pluginId:string,alias:string,broken=false){return activateFrontend({activate(host){host.registerToolRenderer('read',{call:()=>{if(broken)throw new Error('broken');return <b>{pluginId}</b>;}});}},{id:pluginId+':ui',pluginId,source:'',apiVersion:1,tools:{read:alias}},'s','a',new AbortController().signal);}
function show(registrations:Registration[],identity:ToolIdentity){return <I18nProvider><FrontendScopeContext.Provider value={{session:'s',agent:'a',registrations}}><FrontendTool {...identity} kind="call" fallback={<pre>raw arguments</pre>}/></FrontendScopeContext.Provider></I18nProvider>;}
it('uses stable producer identity before changed aliases and removes views on unload',()=>{
 const own=registration('one','new_alias');const view=render(show([own],{pluginId:'one',localId:'read',toolName:'old_alias'}));expect(screen.getByText('one')).toBeVisible();own.dispose();view.rerender(show([own],{pluginId:'one',localId:'read'}));expect(screen.getByText('raw arguments')).toBeVisible();
});
it('restricts old record alias fallback to the recorded plugin and rejects ambiguous ancient records',()=>{
 const one=registration('one','read'),two=registration('two','read');const view=render(show([one,two],{pluginId:'one',toolName:'read'}));expect(screen.getByText('one')).toBeVisible();view.rerender(show([one,two],{toolName:'read'}));expect(screen.getByText('raw arguments')).toBeVisible();view.rerender(show([two],{pluginId:'missing',toolName:'read'}));expect(screen.getByText('raw arguments')).toBeVisible();
});
it('contains a renderer exception and preserves readable raw content',()=>{
 const log=vi.spyOn(console,'error').mockImplementation(()=>{});const view=render(show([registration('broken','read',true)],{toolName:'read'}));expect(screen.getByText('raw arguments')).toBeVisible();view.rerender(show([registration('broken','read')],{toolName:'read'}));expect(screen.getByText('broken')).toBeVisible();log.mockRestore();
});
