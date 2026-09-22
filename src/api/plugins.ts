import { apiRequest } from './client';
export interface InstalledPlugin {
  id: string;
  version: string;
  sha256?: string;
  active: boolean;
  tools: string[];
  hooks: string[];
  state: string;
}
export const listPlugins = (): Promise<InstalledPlugin[]> => apiRequest('/api/plugins');
