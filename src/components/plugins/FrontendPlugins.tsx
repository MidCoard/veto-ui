import React, { createContext, useContext, useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { frontendModules, loadFrontend, type Registration } from '../../plugins/runtime';
import type { PluginContext } from '../../plugins/api';

interface Scope { session: string; agent: string; registrations: Registration[] }
const Context = createContext<Scope | null>(null);

class Boundary extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export function FrontendPlugins({ session, agent, children }: { session?: string; agent?: string; children: React.ReactNode }) {
  const { t } = useI18n();
  const [scope, setScope] = useState<Scope>();
  const [failure, setFailure] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!session || !agent) return;
    const controller = new AbortController();
    const loaded: Registration[] = [];
    setScope(undefined); setFailure(undefined);
    void (async () => {
      const modules = await frontendModules(session, controller.signal);
      const tokens = new Set<string>();
      let failed = false;
      for (const module of modules) {
        try {
          const registration = await loadFrontend(module, session, agent, controller.signal);
          if ([...registration.references.keys()].some(token => tokens.has(token))) {
            registration.dispose(); throw new Error('Duplicate reference renderer');
          }
          registration.references.forEach((_, token) => tokens.add(token));
          loaded.push(registration);
        } catch { if (controller.signal.aborted) return; failed = true; }
      }
      if (!controller.signal.aborted) {
        setScope({ session, agent, registrations: loaded });
        if (failed) setFailure(`${session}:${agent}`);
      }
    })().catch(() => { if (!controller.signal.aborted) setFailure(`${session}:${agent}`); });
    return () => { controller.abort(); loaded.forEach(registration => registration.dispose()); };
  }, [session, agent, attempt]);
  const active = scope?.session === session && scope?.agent === agent ? scope ?? null : null;
  return <Context.Provider value={active}>
    {failure === `${session}:${agent}` && <div role="alert" className="text-sm text-verdict">{t('pluginFrontend.failed')} <button className="ui-button" onClick={() => setAttempt(value => value + 1)}>{t('pluginFrontend.retry')}</button></div>}
    {children}
  </Context.Provider>;
}
export function useFrontendReference(tokenType: string) {
  const scope = useContext(Context);
  const { lang } = useI18n();
  const registration = scope?.registrations.find(item => item.references.has(tokenType));
  if (!scope || !registration) return null;
  return { Component: registration.references.get(tokenType)!, context: context(scope, registration, lang), id: registration.module.id };
}
function context(scope: Scope, registration: Registration, locale: string): PluginContext {
  return { session: scope.session, agent: scope.agent, locale, invoke: registration.invoke };
}
export function FrontendReference({ tokenType, reference, fallback }: { tokenType: string; reference: string; fallback: React.ReactNode }) {
  const entry = useFrontendReference(tokenType);
  if (!entry) return <>{fallback}</>;
  const { Component, context } = entry;
  return <Boundary key={`${context.session}:${context.agent}:${entry.id}`} fallback={fallback}><Component reference={reference} context={context} /></Boundary>;
}
export function FrontendSlot({ name }: { name: 'conversation.footer' }) {
  const scope = useContext(Context);
  const { lang, t } = useI18n();
  if (!scope || name !== 'conversation.footer') return null;
  return <>{scope.registrations.flatMap(registration => [...registration.panels].map(([id, Component]) =>
    <Boundary key={`${scope.session}:${scope.agent}:${registration.module.id}:${id}`} fallback={<span role="alert">{t('pluginFrontend.failed')}</span>}>
      <Component context={context(scope, registration, lang)} />
    </Boundary>))}</>;
}
