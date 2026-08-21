import { describe, expect, it } from 'vitest';
import type { SessionEntity } from '../api/types';
import { recentWorkspaces } from './workspaces';

function session(
  id: string,
  workspaceRoots: string | null,
  lastActiveAt: number | string | null,
): SessionEntity {
  return {
    id,
    owner: 'admin',
    name: id,
    workspaceRoots,
    primaryAgentId: null,
    createdAt: 0,
    lastActiveAt,
  };
}

describe('recentWorkspaces', () => {
  it('splits comma-joined roots and orders them by session activity, newest first', () => {
    const sessions = [
      session('old', '/abs/old', 1000),
      session('new', '/abs/new-a, /abs/new-b', 3000),
      session('mid', '/abs/mid', 2000),
    ];
    expect(recentWorkspaces(sessions)).toEqual(['/abs/new-a', '/abs/new-b', '/abs/mid', '/abs/old']);
  });

  it('dedupes roots, first-seen (most recent) wins', () => {
    const sessions = [
      session('a', '/abs/shared, /abs/a', 2000),
      session('b', '/abs/shared, /abs/b', 1000),
    ];
    expect(recentWorkspaces(sessions)).toEqual(['/abs/shared', '/abs/a', '/abs/b']);
  });

  it('skips null roots and blank segments', () => {
    const sessions = [session('a', null, 2000), session('b', ' , /abs/b,, ', 1000)];
    expect(recentWorkspaces(sessions)).toEqual(['/abs/b']);
  });

  it('caps the list', () => {
    const sessions = [session('a', '/r1,/r2,/r3,/r4,/r5,/r6,/r7', 1000)];
    expect(recentWorkspaces(sessions)).toHaveLength(5);
    expect(recentWorkspaces(sessions, 3)).toEqual(['/r1', '/r2', '/r3']);
  });

  it('falls back to createdAt when lastActiveAt is null', () => {
    const dormant = { ...session('dormant', '/abs/dormant', null), createdAt: 5000 };
    const sessions = [session('active', '/abs/active', 1000), dormant];
    expect(recentWorkspaces(sessions)).toEqual(['/abs/dormant', '/abs/active']);
  });

  it('returns an empty list when no session has roots', () => {
    expect(recentWorkspaces([session('a', null, 1000)])).toEqual([]);
    expect(recentWorkspaces([])).toEqual([]);
  });
});
