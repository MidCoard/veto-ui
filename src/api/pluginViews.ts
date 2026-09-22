import { apiRequest } from './client';
export interface PluginLabel { fallback: string; translations: Record<string, string> }
export interface PluginAction { target: 'SERVER' | 'RESET'; id: string }
export type PluginNode =
  | { type: 'text'; text: PluginLabel }
  | { type: 'button'; label: PluginLabel; action: PluginAction }
  | { type: 'group'; direction: 'ROW' | 'COLUMN'; children: PluginNode[] };
export interface PluginView { content: PluginNode[]; resetAfterMillis: number; resetOnHidden: boolean }
export interface ReferenceRenderer { id: string; pluginId: string; tokenType: string; initialView: PluginView }
export const referenceRenderers = (session: string, signal: AbortSignal): Promise<ReferenceRenderer[]> =>
  apiRequest(`/api/sessions/${encodeURIComponent(session)}/plugin-references`, { signal });
export const referenceAction = (session: string, agentId: string, rendererId: string, reference: string, action: string, signal: AbortSignal): Promise<PluginView> =>
  apiRequest(`/api/sessions/${encodeURIComponent(session)}/plugin-references/actions`, { method: 'POST', body: { agentId, rendererId, reference, action }, signal });
