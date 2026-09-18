import { describe, expect, it } from 'vitest';
import type { SessionEntity } from '../api/types';
import { appendRoot, formatRoots, groupSessionsByWorkspace, recentWorkspaces, removeRoot, rootBasename, splitRoots } from './workspaces';

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
    currentWorkspaceRootIndex: 0,
    primaryAgentId: null,
    toolResultPresentation: 'BASIC',
    createdAt: 0,
    lastActiveAt,
  };
}

describe('splitRoots', () => {
  it('trims segments, drops empties, and dedupes first-occurrence-wins', () => {
    expect(splitRoots(' /a, ,/b,, /a ,/c ')).toEqual(['/a', '/b', '/c']);
    expect(splitRoots(' , ,')).toEqual([]);
    expect(splitRoots(null)).toEqual([]);
  });
});

describe('appendRoot', () => {
  it('fills an empty field and appends comma-joined otherwise', () => {
    expect(appendRoot('', '/a')).toBe('/a');
    expect(appendRoot('/a', '/b')).toBe('/a, /b');
  });

  it('ignores duplicates and blank picks, and drops empty segments already present', () => {
    expect(appendRoot('/a, /b', '/b')).toBe('/a, /b');
    expect(appendRoot('/a', '   ')).toBe('/a');
    expect(appendRoot(' , /a,, ', '/b')).toBe('/a, /b');
  });

  it('trims the picked root before appending', () => {
    expect(appendRoot('/a', '  /b  ')).toBe('/a, /b');
  });
});

describe('removeRoot', () => {
  it('drops the root and keeps the remaining order', () => {
    expect(removeRoot('/a, /b, /c', '/b')).toBe('/a, /c');
    expect(removeRoot('/a, /b', '/missing')).toBe('/a, /b');
    expect(removeRoot('/a', '/a')).toBe('');
  });
});

describe('rootBasename', () => {
  it('takes the last segment across separators and trailing slashes', () => {
    expect(rootBasename('D:/projects/veto')).toBe('veto');
    expect(rootBasename('D:\\projects\\veto\\')).toBe('veto');
    expect(rootBasename('/var/www/')).toBe('www');
    expect(rootBasename('/')).toBe('/');
  });
});

describe('formatRoots', () => {
  it('summarizes a single root with no extras', () => {
    expect(formatRoots('D:/projects/veto')).toEqual({
      roots: ['D:/projects/veto'],
      primary: 'D:/projects/veto',
      base: 'veto',
      extra: 0,
    });
  });

  it('picks the primary by index and counts the additional roots', () => {
    expect(formatRoots('/a, /b, /c', 2)).toEqual({
      roots: ['/a', '/b', '/c'],
      primary: '/c',
      base: 'c',
      extra: 2,
    });
  });

  it('clamps out-of-range and negative indexes onto a real root', () => {
    expect(formatRoots('/a, /b', 9).primary).toBe('/b');
    expect(formatRoots('/a, /b', -3).primary).toBe('/a');
  });

  it('reports no primary for an empty or null CSV', () => {
    expect(formatRoots(null)).toEqual({ roots: [], primary: null, base: null, extra: 0 });
    expect(formatRoots(' , ')).toEqual({ roots: [], primary: null, base: null, extra: 0 });
  });
});

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
