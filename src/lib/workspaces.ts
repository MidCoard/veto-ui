import type { SessionEntity } from '../api/types';
import { toDate } from './time';

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
