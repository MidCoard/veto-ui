import * as React from 'react';
import CodeBlock from '../components/CodeHighlight';
import Markdown from '../components/StreamingMarkdown';
import { subscribePluginResource } from './events';
import { apiRequest } from '../api/client';
import type { FrontendHost, FrontendModule, FrontendPlugin, Json, PanelProps, PluginContext, ReferenceProps } from './api';

let registrationInstance = 0;
export interface Registration {
  instance: number;
  module: FrontendModule;
  references: Map<string, React.ComponentType<ReferenceProps>>;
  tools: Map<string, import('./api').ToolRenderer>;
  panels: Map<string, React.ComponentType<PanelProps>>;
  inspectors: Map<string, { labels: Record<string, string>; Component: React.ComponentType<PanelProps> }>;
  subscribe: PluginContext['subscribe'];
  invoke: PluginContext['invoke'];
  dispose(): void;
}
export const frontendModules = (session: string, signal: AbortSignal) =>
  apiRequest<FrontendModule[]>(`/api/sessions/${encodeURIComponent(session)}/plugin-frontend`, { signal });

/** Only authenticated module bytes from the session catalog enter this loader. */
export async function loadFrontend(module: FrontendModule, session: string, agent: string, signal: AbortSignal): Promise<Registration> {
  if (module.apiVersion !== 1) throw new Error('Unsupported frontend API');
  signal.throwIfAborted();
  const url = URL.createObjectURL(new Blob([module.source], { type: 'text/javascript' }));
  try {
    const plugin = await import(/* @vite-ignore */ url) as FrontendPlugin;
    signal.throwIfAborted();
    return activateFrontend(plugin, module, session, agent, signal);
  } finally { URL.revokeObjectURL(url); }
}

export function activateFrontend(plugin: FrontendPlugin, module: FrontendModule, session: string, agent: string, signal: AbortSignal): Registration {
  signal.throwIfAborted();
  const lifetime = new AbortController();
  const references: Registration['references'] = new Map();
  const tools: Registration['tools'] = new Map();
  const panels: Registration['panels'] = new Map();
  const inspectors: Registration['inspectors'] = new Map();
  let cleanup: void | (() => void);
  let disposed = false;
  let activating = true;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    lifetime.abort();
    signal.removeEventListener('abort', dispose);
    references.clear(); panels.clear(); inspectors.clear(); tools.clear();
    try { cleanup?.(); } catch { /* A plugin cannot interrupt cleanup of its siblings. */ }
  };
  const invoke = async <T extends Json>(action: string, arguments_: Record<string, Json>, caller?: AbortSignal): Promise<T> => {
    lifetime.signal.throwIfAborted();
    const controller = new AbortController();
    const abort = () => controller.abort();
    lifetime.signal.addEventListener('abort', abort, { once: true });
    caller?.addEventListener('abort', abort, { once: true });
    if (caller?.aborted) abort();
    try {
      return await apiRequest<T>(`/api/sessions/${encodeURIComponent(session)}/plugin-frontend/actions`, {
        method: 'POST', body: { moduleId: module.id, agentId: agent, action, arguments: arguments_ }, signal: controller.signal,
      });
    } finally {
      lifetime.signal.removeEventListener('abort', abort); caller?.removeEventListener('abort', abort);
    }
  };
  const host: FrontendHost = {
    apiVersion: 1, React, signal: lifetime.signal, components: { CodeBlock, Markdown },
    registerToolRenderer(id, renderer) {
      if (!activating || disposed || !Object.prototype.hasOwnProperty.call(module.tools ?? {}, id) || tools.has(id)
          || !renderer || !['call', 'result', 'conversation'].some(key => typeof renderer[key as keyof typeof renderer] === 'function'))
        throw new Error('Invalid tool renderer registration');
      tools.set(id, Object.freeze({ ...renderer }));
    },
    registerInspector(id, labels, Component) {
      if (!activating || disposed || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(id) || inspectors.has(id)
          || !labels.en || Object.values(labels).some(label => typeof label !== 'string' || label.length > 80))
        throw new Error('Invalid inspector registration');
      inspectors.set(id, { labels: Object.freeze({ ...labels }), Component });
    },
    registerReferenceRenderer(tokenType, component) {
      if (!activating || disposed || !/^[A-Z][A-Z0-9_]{0,47}$/.test(tokenType) || references.has(tokenType))
        throw new Error('Invalid reference registration');
      references.set(tokenType, component);
    },
    registerPanel(id, slot, component) {
      if (!activating || disposed || slot !== 'conversation.footer' || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(id) || panels.has(id))
        throw new Error('Invalid panel registration');
      panels.set(id, component);
    },
  };
  signal.addEventListener('abort', dispose, { once: true });
  try {
    const result = plugin.activate(Object.freeze(host));
    if (result !== undefined && typeof result !== 'function') throw new Error('activate must return a disposer or undefined');
    cleanup = result;
    activating = false;
    return { instance: ++registrationInstance, module, references, panels, inspectors, tools, invoke, subscribe: (resource, listener) => subscribePluginResource(session, resource, listener, lifetime.signal), dispose };
  } catch (failure) { dispose(); throw failure; }
}
