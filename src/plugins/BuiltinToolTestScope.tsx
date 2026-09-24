import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll } from 'vitest';
import { I18nProvider, useI18n } from '../i18n/I18nContext';
import { FrontendScopeContext } from '../components/plugins/FrontendPlugins';
import { activateFrontend, type Registration } from './runtime';
import type { FrontendPlugin } from './api';
const source=readFileSync(resolve(process.env.VETO_SOURCE_ROOT ?? '../../IdeaProjects/veto','veto-builtin/src/main/resources/frontend/tools.js'),'utf8');
let registration:Registration;
let Fields:React.ComponentType<{values:Record<string,unknown>;literal?:boolean}>;
let Locale:React.ComponentType<{locale:string;children:React.ReactNode}>;
beforeAll(async()=>{
 const plugin=await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`) as FrontendPlugin & {tools:string[];Fields:typeof Fields;LocaleScope:typeof Locale};
 Fields=plugin.Fields;Locale=plugin.LocaleScope;
 registration=activateFrontend(plugin,{id:'top.focess.builtin:tools',pluginId:'top.focess.builtin',apiVersion:1,source,tools:Object.fromEntries(plugin.tools.map(id=>[id,id]))},'sample','agent',new AbortController().signal);
});
export function BuiltinToolTestScope({children}:{children:React.ReactNode}) {return <I18nProvider><FrontendScopeContext.Provider value={{session:'sample',agent:'agent',registrations:[registration]}}>{children}</FrontendScopeContext.Provider></I18nProvider>;}

export function BuiltinFields(props:React.ComponentProps<typeof Fields>){const {lang}=useI18n();return <Locale locale={lang}><Fields {...props}/></Locale>;}
