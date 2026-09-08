import type { SessionEntity } from '../api/types';
import { toDate } from './time';

function workspaceKey(root: string): string {
  if (/^[a-z]:[\\/]/i.test(root) || root.startsWith('\\\\')) {
    return root.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  }
  return root.replace(/\/+$/, '') || '/';
}

/** Group by the complete root set, keeping multi-root sessions in a single group. */
export function groupSessionsByWorkspace(sessions: SessionEntity[]) {
  const groups = new Map<string, { key: string; roots: string[]; sessions: SessionEntity[] }>();
  const millis = (session: SessionEntity) =>
    toDate(session.lastActiveAt)?.getTime() ?? toDate(session.createdAt)?.getTime() ?? 0;
  for (const session of [...sessions].sort((a, b) => millis(b) - millis(a))) {
    const roots = [...new Set((session.workspaceRoots ?? '').split(',').map((root) => root.trim()).filter(Boolean))].sort();
    const key = JSON.stringify([...new Set(roots.map(workspaceKey))].sort());
    const group = groups.get(key) ?? { key, roots, sessions: [] };
    group.sessions.push(session);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/**
 * Derive recently-used workspace roots from the loaded sessions: each
 * session's comma-joined `workspaceRoots` is split into individual roots,
 * sessions are ordered by lastActiveAt (falling back to createdAt) descending,
 * roots dedupe first-seen-wins, capped at `cap`.
 */
export function recentWorkspaces(sessions: SessionEntity[], cap = 5): string[] {
  const millis = (session: SessionEntity): number =>
    toDate(session.lastActiveAt)?.getTime() ?? toDate(session.createdAt)?.getTime() ?? 0;
  const byActivityDesc = [...sessions].sort((a, b) => millis(b) - millis(a));

  const seen = new Set<string>();
  const roots: string[] = [];
  for (const session of byActivityDesc) {
    if (session.workspaceRoots === null) continue;
    for (const raw of session.workspaceRoots.split(',')) {
      const root = raw.trim();
      if (root === '' || seen.has(root)) continue;
      seen.add(root);
      roots.push(root);
      if (roots.length >= cap) return roots;
    }
  }
  return roots;
}
