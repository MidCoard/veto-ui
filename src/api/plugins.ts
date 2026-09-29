import { apiRequest } from './client';
export interface InstalledPlugin {
  id: string;
  name: string;
  version: string;
  sha256?: string;
  active: boolean;
  tools: string[];
  hooks: string[];
  state: string;
}
export const listPlugins = (): Promise<InstalledPlugin[]> => apiRequest('/api/plugins');
export const setPluginEnabled = (id: string, enabled: boolean): Promise<void> =>
  apiRequest(`/api/plugins/${encodeURIComponent(id)}/${enabled ? 'enable' : 'disable'}`, { method: 'POST' });
