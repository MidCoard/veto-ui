import React, { createContext, useContext, useEffect, useState, useSyncExternalStore, useRef } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { frontendModules, loadFrontend, type Registration } from '../../plugins/runtime';
import { observePluginConnection, pluginConnected, subscribePluginResource } from '../../plugins/events';
import { listSessionAgents } from '../../api/endpoints';
import type { ToolIdentity, ToolPresentationProps, PluginContext } from '../../plugins/api';

interface Scope { session: string; agent: string; registrations: Registration[]; openAgent?: PluginContext['openAgent'] }
export const FrontendScopeContext = createContext<Scope | null>(null);

class Boundary extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export function FrontendPlugins({ session, agent, children, onOpenAgent }: { session?: string; agent?: string; children: React.ReactNode; onOpenAgent?: (id: string) => void }) {
  const { t } = useI18n();
  const navigation = useRef(onOpenAgent);
  navigation.current = onOpenAgent;
  const canNavigate = !!onOpenAgent;
  const [scope, setScope] = useState<Scope>();
  const [failure, setFailure] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!session || !agent) return;
    const controller = new AbortController();
    let loaded: Registration[] = [];
    let generation = 0;
    const openAgent = canNavigate ? async (id: string) => {
      const catalogueGeneration = generation;
      const agents = await listSessionAgents(session, controller.signal);
      controller.signal.throwIfAborted();
      if (catalogueGeneration !== generation) throw new DOMException('Plugin catalog changed', 'AbortError');
      if (!agents.some(candidate => candidate.id === id)) throw new Error('Agent is unavailable in this session');
      navigation.current?.(id);
    } : undefined;
    setScope(undefined); setFailure(undefined);
    const refresh = async (invalidate = false) => {
      const request = ++generation;
      if (invalidate) { loaded.forEach(item => item.dispose()); loaded = []; setScope(undefined); }
      try {
        const modules = await frontendModules(session, controller.signal);
        if (controller.signal.aborted || request !== generation) return;
        const next: Registration[] = [];
        const tokens = new Set<string>();
        const toolRenderers = new Set<string>();
        let failed = false;
        for (const module of modules) {
          let registration: Registration | undefined;
          try {
            registration = loaded.find(item => item.module.id === module.id && item.module.source === module.source && item.module.apiVersion === module.apiVersion && JSON.stringify(item.module.tools) === JSON.stringify(module.tools));
            registration ??= await loadFrontend(module, session, agent, controller.signal);
            if (controller.signal.aborted || request !== generation) { if (!loaded.includes(registration)) registration.dispose(); next.filter(item => !loaded.includes(item)).forEach(item => item.dispose()); return; }
            if ([...registration.tools.keys()].some(id => toolRenderers.has(`${module.pluginId}:${id}`))) throw new Error('Duplicate tool renderer');
            if ([...registration.references.keys()].some(token => tokens.has(token))) throw new Error('Duplicate reference renderer');
            registration.tools.forEach((_, id) => toolRenderers.add(`${module.pluginId}:${id}`));
            registration.references.forEach((_, token) => tokens.add(token));
            next.push(registration);
          } catch { registration?.dispose(); if (controller.signal.aborted) { next.filter(item => !loaded.includes(item)).forEach(item => item.dispose()); return; } failed = true; }
        }
        loaded.filter(item => !next.includes(item)).forEach(item => item.dispose());
        loaded = next;
        setScope({ session, agent, registrations: loaded, openAgent });
        setFailure(failed ? `${session}:${agent}` : undefined);
      } catch { if (!controller.signal.aborted && request === generation) setFailure(`${session}:${agent}`); }
    };
    const recover = () => { if (document.visibilityState === 'visible') void refresh(); };
    const unsubscribe = subscribePluginResource(session, 'plugin-frontend', () => void refresh(true), controller.signal);
    const reconnect = observePluginConnection(() => { if (pluginConnected()) void refresh(); });
    window.addEventListener('focus', recover);
    document.addEventListener('visibilitychange', recover);
    void refresh();
    return () => {
      controller.abort(); loaded.forEach(registration => registration.dispose()); unsubscribe(); reconnect();
      window.removeEventListener('focus', recover); document.removeEventListener('visibilitychange', recover);
    };
  }, [session, agent, attempt, canNavigate]);
  const active = scope?.session === session && scope?.agent === agent ? scope ?? null : null;
  return <FrontendScopeContext.Provider value={active}>
    {failure === `${session}:${agent}` && <div role="alert" className="text-sm text-verdict">{t('pluginFrontend.failed')} <button className="ui-button" onClick={() => setAttempt(value => value + 1)}>{t('pluginFrontend.retry')}</button></div>}
    {children}
  </FrontendScopeContext.Provider>;
}
export function useFrontendReference(tokenType: string) {
  const scope = useContext(FrontendScopeContext);
  const { lang } = useI18n();
  const connected = useSyncExternalStore(observePluginConnection, pluginConnected);
  const registration = scope?.registrations.find(item => item.references.has(tokenType));
  if (!scope || !registration) return null;
  return { Component: registration.references.get(tokenType)!, context: context(scope, registration, lang, connected), id: registration.module.id };
}
function context(scope: Scope, registration: Registration, locale: string, connected: boolean): PluginContext {
  return { session: scope.session, agent: scope.agent, locale, connected, openAgent: scope.openAgent, invoke: registration.invoke, subscribe: registration.subscribe };
}
export function FrontendReference({ tokenType, reference, fallback }: { tokenType: string; reference: string; fallback: React.ReactNode }) {
  const entry = useFrontendReference(tokenType);
  if (!entry) return <>{fallback}</>;
  const { Component, context } = entry;
  return <Boundary key={`${context.session}:${context.agent}:${entry.id}`} fallback={fallback}><Component reference={reference} context={context} /></Boundary>;
}
export function FrontendSlot({ name }: { name: 'conversation.footer' }) {
  const scope = useContext(FrontendScopeContext);
  const { lang, t } = useI18n();
  const connected = useSyncExternalStore(observePluginConnection, pluginConnected);
  if (!scope || name !== 'conversation.footer') return null;
  return <>{scope.registrations.flatMap(registration => [...registration.panels].map(([id, Component]) =>
    <Boundary key={`${scope.session}:${scope.agent}:${registration.module.id}:${id}`} fallback={<span role="alert">{t('pluginFrontend.failed')}</span>}>
      <Component context={context(scope, registration, lang, connected)} />
    </Boundary>))}</>;
}

export function useFrontendInspectors() {
  const scope = useContext(FrontendScopeContext);
  const { lang, t } = useI18n();
  const connected = useSyncExternalStore(observePluginConnection, pluginConnected);
  if (!scope) return [];
  return scope.registrations.flatMap(registration => [...registration.inspectors].map(([local, panel]) => ({
    id: `${registration.module.id}/${local}`,
    label: panel.labels[lang] ?? panel.labels[lang.split('-')[0]] ?? panel.labels.en,
    render: (onCount: (count: number | null) => void) => <Boundary key={`${scope.session}:${scope.agent}:${registration.module.id}:${local}`} fallback={<span role="alert">{t('pluginFrontend.failed')}</span>}>
      <panel.Component context={context(scope, registration, lang, connected)} onCount={onCount} />
    </Boundary>,
  })));
}

export function useFrontendTool(identity: ToolIdentity) {
  const scope = useContext(FrontendScopeContext);
  const { lang } = useI18n();
  const connected = useSyncExternalStore(observePluginConnection, pluginConnected);
  if (!scope) return null;
  if (!(identity.pluginId && identity.localId) && identity.toolName) {
    const owners=new Set(scope.registrations.flatMap(registration=>Object.entries(registration.module.tools??{})
      .filter(([,name])=>name===identity.toolName && (!identity.pluginId || registration.module.pluginId===identity.pluginId))
      .map(([id])=>`${registration.module.pluginId}:${id}`)));
    if(owners.size!==1) return null;
  }
  const matches = scope.registrations.flatMap(registration => [...registration.tools].filter(([id]) => {
    if (identity.pluginId && registration.module.pluginId !== identity.pluginId) return false;
    if (identity.pluginId && identity.localId) return id === identity.localId;
    return !!identity.toolName && registration.module.tools?.[id] === identity.toolName;
  }).map(([id, renderer]) => ({ id: `${registration.module.id}:${id}:${registration.instance}`, renderer, context: context(scope, registration, lang, connected) })));
  return matches.length === 1 ? matches[0] : null;
}
export function FrontendTool({ kind, fallback, ...props }: Omit<ToolPresentationProps, 'context'> & { kind: 'call' | 'result' | 'conversation'; fallback: React.ReactNode }) {
  const entry = useFrontendTool(props);
  const Component = entry?.renderer[kind];
  return entry && Component ? <Boundary key={`${entry.context.session}:${entry.context.agent}:${entry.id}:${kind}`} fallback={fallback}><Component {...props} context={entry.context} /></Boundary> : <>{fallback}</>;
}
export function useToolHeader(identity: ToolIdentity, args: Record<string, unknown>): string | undefined {
  const entry = useFrontendTool(identity);
  try { const target=entry?.renderer.headerTarget?.(args); return typeof target === "string" ? target : undefined; } catch { return undefined; }
}
