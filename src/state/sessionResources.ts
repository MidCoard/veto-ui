import { apiRequest, getToken } from '../api/client';
import { getSessionHistory, getSessionRecords, listSessionAgents, listBgTasks, listVetoes, listUserQuestions, listSessionGroups } from '../api/endpoints';
import type { HistoryTurn, SessionAgent, SessionRecordsView, BgTaskListResponse, PendingVeto, PendingUserQuestions, SessionGroup } from '../api/types';
import { backendApiUrl } from '../config/backend';
import { SessionResource } from './SessionResource';

export interface SessionResources {
  records: SessionResource<SessionRecordsView>;
  agents: SessionResource<SessionAgent[]>;
  history: SessionResource<HistoryTurn[]>;
  tasks: SessionResource<BgTaskListResponse>;
  interactions: SessionResource<{ vetoes: PendingVeto[]; questions: PendingUserQuestions[] }>;
  groups: SessionResource<SessionGroup[]>;
  monitors: SessionResource<SessionMonitor[]>;
  execution: SessionResource<{ agentId: string; busy: boolean }[]>;
}
export interface SessionMonitor {
  id: string; agentId: string; kind: string; purpose: string; state: string;
  dueAt: string | number | null;
  pending: { id: string; content: string }[];
  delivered?: { id: string; content: string }[] | null;
}
export type SessionResourceName = keyof SessionResources;

let scope = '';
const sessions = new Map<string, SessionResources>();

export function resetSessionResources(): void {
  sessions.forEach(resources => Object.values(resources).forEach(resource => resource.dispose()));
  sessions.clear();
  scope = '';
}

export function sessionResources(name: string, id = name): SessionResources {
  const identity = JSON.stringify([backendApiUrl(''), getToken()]);
  if (scope !== identity) { resetSessionResources(); scope = identity; }
  const key = JSON.stringify([id, name]);
  const existing = sessions.get(key);
  if (existing) return existing;
  // Retain a bounded set of inactive sessions for fast view/session switching.
  if (sessions.size >= 32) {
    for (const [candidate, resources] of sessions) {
      if (!Object.values(resources).some(resource => resource.observed)) {
        Object.values(resources).forEach(resource => resource.dispose());
        sessions.delete(candidate);
        break;
      }
    }
  }
  const resources = {
    records: new SessionResource(signal => getSessionRecords(name, signal)),
    agents: new SessionResource(signal => listSessionAgents(name, signal)),
    history: new SessionResource(signal => getSessionHistory(name, signal)),
    tasks: new SessionResource(signal => listBgTasks(name, signal)),
    interactions: new SessionResource(async signal => {
      const [vetoes, questions] = await Promise.all([listVetoes(name, signal), listUserQuestions(name, signal)]);
      return { vetoes, questions };
    }),
    groups: new SessionResource(signal => listSessionGroups(name, signal)),
    monitors: new SessionResource(signal => apiRequest<SessionMonitor[]>(`/api/sessions/${encodeURIComponent(name)}/monitors`, { signal })),
    execution: new SessionResource(signal => apiRequest<{ agentId: string; busy: boolean }[]>(`/api/sessions/${encodeURIComponent(name)}/execution`, { signal })),
  };
  sessions.set(key, resources);
  return resources;
}

export function invalidateSessionResources(name: string, id: string, keys: SessionResourceName[]): void {
  const resources = sessionResources(name, id);
  keys.forEach(key => resources[key].invalidate());
}

export function recoverSessionResources(): void {
  sessions.forEach(resources => Object.values(resources).forEach(resource => resource.invalidate()));
}

export function isSessionResourceName(value: unknown): value is SessionResourceName {
  return typeof value === 'string' && ['records', 'agents', 'history', 'tasks', 'interactions', 'groups', 'monitors', 'execution'].includes(value);
}
