import { describe, expect, it } from 'vitest';
import type { SessionEntity } from '../api/types';
import { groupSessionsByWorkspace, recentWorkspaces } from './workspaces';

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
    toolResultPresentation: 'BASIC',
    guidedEnabled: false,
    createdAt: 0,
    lastActiveAt,
  };
}

describe('recentWorkspaces', () => {
  it('groups complete root sets once, handles missing roots, and orders groups and sessions by activity', () => {
    const groups = groupSessionsByWorkspace([
      session('older', '/a, /b', 1000),
      session('missing', null, 2000),
      session('latest', ' /b, /a, /a ', 4000),
      session('other', '/c', 3000),
      session('blank', ' , ', 500),
    ]);
    expect(groups.map((group) => group.sessions.map((item) => item.id))).toEqual([
      ['latest', 'older'], ['other'], ['missing', 'blank'],
    ]);
    expect(groups[0].roots).toEqual(['/a', '/b']);
    expect(groups[2].roots).toEqual([]);
  });

  it('merges Windows path spellings while preserving POSIX case sensitivity', () => {
    const groups = groupSessionsByWorkspace([
      session('windows-a', 'E:\\test', 3000),
      session('windows-b', 'e:/test/', 2000),
      session('posix-a', '/Test', 1000),
      session('posix-b', '/test', 500),
    ]);
    expect(groups.map((group) => group.sessions.map((item) => item.id))).toEqual([
      ['windows-a', 'windows-b'], ['posix-a'], ['posix-b'],
    ]);
  });
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
