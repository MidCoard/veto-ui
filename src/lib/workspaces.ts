import type { SessionEntity } from '../api/types';
import { toDate } from './time';

function workspaceKey(root: string): string {
  if (/^[a-z]:[\\/]/i.test(root) || root.startsWith('\\\\')) {
    return root.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  }
  return root.replace(/\/+$/, '') || '/';
}

/** Split a roots CSV into trimmed, non-empty roots, deduped first-occurrence-wins. */
export function splitRoots(csv: string | null): string[] {
  return [...new Set((csv ?? '').split(',').map((root) => root.trim()).filter((root) => root !== ''))];
}

/** Append `root` to a roots CSV, trimming and deduplicating; no empty segments. */
export function appendRoot(csv: string, root: string): string {
  const roots = splitRoots(csv);
  const trimmed = root.trim();
  if (trimmed !== '' && !roots.includes(trimmed)) roots.push(trimmed);
  return roots.join(', ');
}

/** Drop `root` from a roots CSV; the remaining roots stay comma-joined in order. */
export function removeRoot(csv: string, root: string): string {
  return splitRoots(csv).filter((candidate) => candidate !== root).join(', ');
}

/** Last path segment of a root, tolerating either separator and trailing slashes. */
export function rootBasename(root: string): string {
  return root.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || root;
}

/**
 * Compact multi-root summary: the primary root (the session's
 * `currentWorkspaceRootIndex`, clamped into range, defaulting to the first
 * root) plus how many additional roots the CSV holds.
 */
export function formatRoots(csv: string | null, currentWorkspaceRootIndex = 0): {
  roots: string[];
  primary: string | null;
  base: string | null;
  extra: number;
} {
  const roots = splitRoots(csv);
  const index = Math.min(Math.max(currentWorkspaceRootIndex, 0), roots.length - 1);
  const primary = roots[index] ?? null;
  return {
    roots,
    primary,
    base: primary === null ? null : rootBasename(primary),
    extra: Math.max(roots.length - 1, 0),
  };
}

/** Group by the complete root set, keeping multi-root sessions in a single group. */
export function groupSessionsByWorkspace(sessions: SessionEntity[]) {
  const groups = new Map<string, { key: string; roots: string[]; sessions: SessionEntity[] }>();
  const millis = (session: SessionEntity) =>
    toDate(session.lastActiveAt)?.getTime() ?? toDate(session.createdAt)?.getTime() ?? 0;
  for (const session of [...sessions].sort((a, b) => millis(b) - millis(a))) {
    const roots = splitRoots(session.workspaceRoots).sort();
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
