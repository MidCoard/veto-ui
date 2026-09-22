import { FrontendPlugins, FrontendReference } from './FrontendPlugins';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { referenceAction, referenceRenderers, type ReferenceRenderer } from '../../api/pluginViews';
import PluginViewRenderer from './PluginView';

interface Scope { session: string; agent: string; renderers: ReferenceRenderer[] }
const Context = createContext<Scope | null>(null);

/** Session-selected plugin declarations; plaintext is never stored in this provider. */
export function PluginReferences({ session, agent, children }: { session?: string; agent?: string; children: React.ReactNode }) {
  const [catalog, setCatalog] = useState<{ session: string; renderers: ReferenceRenderer[] }>();
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    referenceRenderers(session, controller.signal)
      .then(renderers => { if (!controller.signal.aborted) setCatalog({ session, renderers }); }).catch(() => {});
    return () => controller.abort();
  }, [session]);
  const scope = session && agent ? { session, agent, renderers: catalog?.session === session ? catalog.renderers : [] } : null;
  return <FrontendPlugins session={session} agent={agent}><Context.Provider value={scope}>{children}</Context.Provider></FrontendPlugins>;
}

/** The host recognizes the token syntax; each selected plugin chooses its renderer and reader. */
export function PluginText({ text }: { text: string }) {
  const scope = useContext(Context);
  if (!scope) return <>{text}</>;
  const parts: React.ReactNode[] = []; let at = 0;
  for (const match of text.matchAll(/\[([A-Z][A-Z0-9_]{0,47}):([^\]\s]{1,256})\]/g)) {
    const renderer = scope.renderers.find(r => r.tokenType === match[1]);
    parts.push(text.slice(at, match.index));
    const fallback = renderer ? <PluginViewRenderer initialView={renderer.initialView} invoke={(action, signal) => referenceAction(scope.session, scope.agent, renderer.id, match[2], action, signal)} /> : match[0];
    parts.push(<FrontendReference key={`${scope.session}:${scope.agent}:${match[0]}:${match.index}`} tokenType={match[1]} reference={match[2]} fallback={fallback} />);
    at = match.index + match[0].length;
  }
  parts.push(text.slice(at)); return <>{parts}</>;
}
export function pluginChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, child => typeof child === 'string' ? <PluginText text={child} /> : child);
}
