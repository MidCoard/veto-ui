import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api/client';

export interface BoundPluginStatus {
  id: string;
  version: string;
  revision: string;
  available: boolean;
  availability?: 'AVAILABLE' | 'ABSENT' | 'DISABLED' | 'DECLINED' | 'REVISION_MISMATCH' | 'INACTIVE';
}

export interface SessionPluginEnvironment {
  missing: BoundPluginStatus[];
  loading: boolean;
  failed: boolean;
  acknowledged: boolean;
  acknowledge: () => void;
  retry: () => void;
}

export const AVAILABLE_PLUGIN_ENVIRONMENT: SessionPluginEnvironment = {
  missing: [], loading: false, failed: false, acknowledged: true,
  acknowledge: () => undefined,
  retry: () => undefined,
};

/** Acknowledgement lasts only while this session and exact unavailable package set stay mounted. */
export function useSessionPluginEnvironment(sessionName: string | null, environmentEpoch?: string): SessionPluginEnvironment {
  const [plugins, setPlugins] = useState<BoundPluginStatus[]>([]);
  const [loading, setLoading] = useState(sessionName !== null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [acknowledgedSnapshot, setAcknowledgedSnapshot] = useState<string | null>(null);

  useEffect(() => {
    setAcknowledgedSnapshot(null);
    if (sessionName === null) {
      setPlugins([]);
      setLoading(false);
      setFailed(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    void apiRequest<BoundPluginStatus[]>(`/api/sessions/${encodeURIComponent(sessionName)}/plugins`, { signal: controller.signal })
      .then(result => {
        if (!controller.signal.aborted) setPlugins(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPlugins([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [environmentEpoch, revision, sessionName]);

  const missing = useMemo(() => plugins.filter(plugin => !plugin.available), [plugins]);
  const snapshot = useMemo(() => sessionName === null ? null : `${sessionName}:${missing
    .map(plugin => `${plugin.id}@${plugin.version}#${plugin.revision}:${plugin.availability ?? 'UNKNOWN'}`)
    .sort()
    .join('|')}`, [missing, sessionName]);
  const acknowledge = useCallback(() => setAcknowledgedSnapshot(snapshot), [snapshot]);
  const retry = useCallback(() => setRevision(value => value + 1), []);

  return {
    missing,
    loading,
    failed,
    acknowledged: missing.length === 0 || acknowledgedSnapshot === snapshot,
    acknowledge,
    retry,
  };
}
