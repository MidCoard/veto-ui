import type * as React from 'react';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export interface FrontendModule { id: string; pluginId: string; apiVersion: number; source: string }
export interface PluginContext {
  session: string;
  agent: string;
  locale: string;
  /** Requests are also cancelled when the session's frontend plugin is disposed. */
  invoke<T extends Json = Json>(action: string, arguments_: Record<string, Json>, signal?: AbortSignal): Promise<T>;
}
export interface ReferenceProps { reference: string; context: PluginContext }
export interface PanelProps { context: PluginContext }
export interface FrontendHost {
  apiVersion: 1;
  React: typeof React;
  signal: AbortSignal;
  registerReferenceRenderer(tokenType: string, component: React.ComponentType<ReferenceProps>): void;
  registerPanel(id: string, slot: 'conversation.footer', component: React.ComponentType<PanelProps>): void;
}
/** Plugins compile TS/JSX to self-contained ESM, obtaining the host's React instance here. */
export interface FrontendPlugin { activate(host: FrontendHost): void | (() => void) }
