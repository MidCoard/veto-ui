import { useSyncExternalStore } from 'react';
import type { ResourceSnapshot } from './SessionResource';
import { sessionResources, type SessionResourceName, type SessionResources } from './sessionResources';

const empty: ResourceSnapshot<never> = { data: null, loading: false, stale: false, error: null };
const emptySnapshot = () => empty;
const noSubscription = () => () => undefined;

export function useSessionResource<K extends SessionResourceName>(name: string | null, key: K, id?: string) {
  const resource = name === null ? null : sessionResources(name, id)[key];
  return useSyncExternalStore<ResourceSnapshot<unknown>>(resource?.subscribe ?? noSubscription, resource?.getSnapshot ?? emptySnapshot) as ReturnType<SessionResources[K]['getSnapshot']>;
}
