import { describe, expect, it } from 'vitest';
import {
  parseCommandOutput,
  parseFileToolStatus,
  parseGrepContent,
  parseGrepSearchArgs,
  parseListDirArgs,
  parseListDirContent,
  parseLoadSkillArgs,
  parseReplaceFileArgs,
  parseRunCommandArgs,
  parseViewFileArgs,
  parseViewFileContent,
  parseWriteFileArgs,
  toolSummary,
} from './toolContent';

describe('parseCommandOutput', () => {
  it('returns plain stdout when no stderr or exit code is present', () => {
    expect(parseCommandOutput('BUILD SUCCESSFUL in 12s')).toEqual({
      stdout: 'BUILD SUCCESSFUL in 12s',
      stderr: null,
      exitCode: null,
    });
  });

  it('splits stderr at the separator', () => {
    expect(parseCommandOutput('out\n[stderr]\nsome warning')).toEqual({
      stdout: 'out',
      stderr: 'some warning',
      exitCode: null,
    });
  });

  it('strips a trailing exit code line', () => {
    expect(parseCommandOutput('src/Main.java:15: error\n(exit code: 1)')).toEqual({
      stdout: 'src/Main.java:15: error',
      stderr: null,
      exitCode: 1,
    });
  });

  it('handles stderr followed by an exit code', () => {
    expect(parseCommandOutput('out\n[stderr]\nerr text\n(exit code: 2)')).toEqual({
      stdout: 'out',
      stderr: 'err text',
      exitCode: 2,
    });
  });

  it('handles an exit code with empty output', () => {
    expect(parseCommandOutput('\n(exit code: 127)')).toEqual({
      stdout: '',
      stderr: null,
      exitCode: 127,
    });
  });

  it('keeps exit-code-looking text that is not trailing', () => {
    expect(parseCommandOutput('(exit code: 1) was the problem\nmore')).toEqual({
      stdout: '(exit code: 1) was the problem\nmore',
      stderr: null,
      exitCode: null,
    });
  });
});

describe('parseFileToolStatus', () => {
  it('parses an ok envelope', () => {
    expect(parseFileToolStatus('{"status":"ok","file":"/abs/a.ts","bytes":12}')).toEqual({
      ok: true,
      file: '/abs/a.ts',
      error: null,
    });
  });

  it('parses an error envelope', () => {
    expect(
      parseFileToolStatus('{"status":"error","error":"File exists and overwrite=false: /abs/a.ts"}'),
    ).toEqual({ ok: false, file: null, error: 'File exists and overwrite=false: /abs/a.ts' });
  });

  it('returns null for non-JSON bodies', () => {
    expect(parseFileToolStatus('not json at all')).toBeNull();
    expect(parseFileToolStatus('REFUSED - policy block')).toBeNull();
  });

  it('returns null for JSON that is not the status envelope', () => {
    expect(parseFileToolStatus('{"foo":1}')).toBeNull();
    expect(parseFileToolStatus('[1,2]')).toBeNull();
    expect(parseFileToolStatus('{"status":"ok"}')).toBeNull();
  });
});

describe('parseRunCommandArgs', () => {
  it('parses commands, cwd, connect, and timeout', () => {
    expect(
      parseRunCommandArgs({
        commands: [
          { executable: 'gradle', args: ['build'] },
          { executable: 'git', args: ['status'] },
        ],
        cwd: '/abs',
        connect: 'RUN_ALL',
        timeout: 300,
      }),
    ).toEqual({
      commands: [
        { executable: 'gradle', args: ['build'] },
        { executable: 'git', args: ['status'] },
      ],
      cwd: '/abs',
      connect: 'RUN_ALL',
      timeout: 300,
    });
  });

  it('tolerates omitted cwd/connect/timeout and missing argv', () => {
    expect(parseRunCommandArgs({ commands: [{ executable: 'ls' }] })).toEqual({
      commands: [{ executable: 'ls', args: [] }],
      cwd: null,
      connect: null,
      timeout: null,
    });
  });

  it('returns null for malformed shapes', () => {
    expect(parseRunCommandArgs(undefined)).toBeNull();
    expect(parseRunCommandArgs({})).toBeNull();
    expect(parseRunCommandArgs({ commands: 'gradle build' })).toBeNull();
    expect(parseRunCommandArgs({ commands: [{ args: ['x'] }] })).toBeNull();
    expect(parseRunCommandArgs({ commands: [{ executable: 'ls', args: [1] }] })).toBeNull();
  });
});

describe('parseWriteFileArgs', () => {
  it('parses the full shape', () => {
    expect(
      parseWriteFileArgs({ targetFile: '/abs/a.ts', codeContent: 'body', overwrite: true }),
    ).toEqual({ targetFile: '/abs/a.ts', codeContent: 'body', overwrite: true });
  });

  it('treats a missing overwrite flag as false', () => {
    expect(parseWriteFileArgs({ targetFile: '/abs/a.ts', codeContent: '' })).toEqual({
      targetFile: '/abs/a.ts',
      codeContent: '',
      overwrite: false,
    });
  });

  it('returns null when required fields are missing', () => {
    expect(parseWriteFileArgs(undefined)).toBeNull();
    expect(parseWriteFileArgs({ targetFile: '/abs/a.ts' })).toBeNull();
    expect(parseWriteFileArgs({ codeContent: 'body' })).toBeNull();
  });
});

describe('parseReplaceFileArgs', () => {
  it('parses the full shape', () => {
    expect(
      parseReplaceFileArgs({
        targetFile: '/abs/a.ts',
        startLine: 5,
        endLine: 8,
        targetContent: 'old',
        replacementContent: 'new',
      }),
    ).toEqual({ targetFile: '/abs/a.ts', targetContent: 'old', replacementContent: 'new' });
  });

  it('returns null when any required field is missing', () => {
    expect(parseReplaceFileArgs(undefined)).toBeNull();
    expect(parseReplaceFileArgs({ targetFile: '/abs/a.ts', targetContent: 'old' })).toBeNull();
    expect(
      parseReplaceFileArgs({ targetFile: '/abs/a.ts', replacementContent: 'new' }),
    ).toBeNull();
  });
});

describe('parseViewFileArgs', () => {
  it('parses path and optional line range', () => {
    expect(parseViewFileArgs({ absolutePath: '/abs/Main.java', startLine: 10, endLine: 20 })).toEqual({
      path: '/abs/Main.java',
      startLine: 10,
      endLine: 20,
    });
    expect(parseViewFileArgs({ absolutePath: '/abs/Main.java' })).toEqual({
      path: '/abs/Main.java',
      startLine: null,
      endLine: null,
    });
  });

  it('returns null without a path', () => {
    expect(parseViewFileArgs(undefined)).toBeNull();
    expect(parseViewFileArgs({})).toBeNull();
  });
});

describe('parseViewFileContent', () => {
  it('splits "N: text" lines into gutter numbers and text', () => {
    expect(parseViewFileContent('1: package com.example;\n2: \n3: public class Main {')).toEqual([
      { n: 1, text: 'package com.example;' },
      { n: 2, text: '' },
      { n: 3, text: 'public class Main {' },
    ]);
  });

  it('handles a trailing newline and empty body', () => {
    expect(parseViewFileContent('9: x\n')).toEqual([{ n: 9, text: 'x' }]);
    expect(parseViewFileContent('')).toEqual([]);
  });

  it('returns null for non-conforming bodies (error envelopes, prose)', () => {
    expect(parseViewFileContent('{"status":"error","error":"Not a regular file: /x"}')).toBeNull();
    expect(parseViewFileContent('just some text')).toBeNull();
  });
});

describe('parseListDirArgs', () => {
  it('parses the directory path', () => {
    expect(parseListDirArgs({ directoryPath: '/abs/src' })).toBe('/abs/src');
  });

  it('returns null without a path', () => {
    expect(parseListDirArgs(undefined)).toBeNull();
    expect(parseListDirArgs({})).toBeNull();
  });
});

describe('parseListDirContent', () => {
  it('marks directories by their trailing slash', () => {
    expect(parseListDirContent('src/\nbuild.gradle.kts\nREADME.md\n')).toEqual([
      { name: 'src', isDir: true },
      { name: 'build.gradle.kts', isDir: false },
      { name: 'README.md', isDir: false },
    ]);
  });

  it('returns an empty listing for an empty directory', () => {
    expect(parseListDirContent('')).toEqual([]);
  });

  it('returns null for error envelopes', () => {
    expect(parseListDirContent('{"status":"error","error":"Not a directory: /x"}')).toBeNull();
  });
});

describe('parseGrepSearchArgs', () => {
  it('parses path, query, flags and includes', () => {
    expect(
      parseGrepSearchArgs({
        searchPath: '/abs',
        query: 'FIXME',
        caseInsensitive: true,
        includes: ['*.ts', '*.tsx'],
      }),
    ).toEqual({
      searchPath: '/abs',
      query: 'FIXME',
      caseInsensitive: true,
      includes: ['*.ts', '*.tsx'],
    });
  });

  it('defaults flags/includes when omitted or malformed', () => {
    expect(parseGrepSearchArgs({ searchPath: '/abs', query: 'x' })).toEqual({
      searchPath: '/abs',
      query: 'x',
      caseInsensitive: false,
      includes: [],
    });
    expect(
      parseGrepSearchArgs({ searchPath: '/abs', query: 'x', includes: ['*.ts', 1] }),
    ).toMatchObject({ includes: [] });
  });

  it('returns null without path or query', () => {
    expect(parseGrepSearchArgs(undefined)).toBeNull();
    expect(parseGrepSearchArgs({ searchPath: '/abs' })).toBeNull();
    expect(parseGrepSearchArgs({ query: 'x' })).toBeNull();
  });
});

describe('parseGrepContent', () => {
  it('splits "path:N: text" rows, keeping Windows drive colons in the path', () => {
    expect(
      parseGrepContent('D:\\src\\Main.java:12: // TODO\n/abs/util/Helper.java:30: // TODO(jess)'),
    ).toEqual([
      { path: 'D:\\src\\Main.java', line: 12, text: '// TODO' },
      { path: '/abs/util/Helper.java', line: 30, text: '// TODO(jess)' },
    ]);
  });

  it('returns [] for an empty report and null for non-conforming lines', () => {
    expect(parseGrepContent('')).toEqual([]);
    expect(parseGrepContent('no colon structure here')).toBeNull();
  });
});

describe('parseLoadSkillArgs', () => {
  it('parses the skill name', () => {
    expect(parseLoadSkillArgs({ skillName: 'verify_suite' })).toBe('verify_suite');
    expect(parseLoadSkillArgs(undefined)).toBeNull();
    expect(parseLoadSkillArgs({})).toBeNull();
  });
});

describe('toolSummary', () => {
  it('summarizes memory tools', () => {
    expect(toolSummary('recall_insights', { query: 'auth patterns' })).toBe('auth patterns');
    expect(toolSummary('forget', { memoryId: 'abc-123' })).toBe('abc-123');
    expect(toolSummary('write_insight', { content: 'uses Gradle 8.5' })).toBe('uses Gradle 8.5');
  });

  it('summarizes group tools', () => {
    expect(toolSummary('create_group', { task: 'Fix the auth bug' })).toBe('Fix the auth bug');
    expect(toolSummary('create_node', { nodeId: 'node-1', description: 'patch it' })).toBe(
      'node-1 — patch it',
    );
    expect(toolSummary('remove_node', { nodeId: 'node-2' })).toBe('node-2');
    expect(
      toolSummary('post_message', { type: 'STATUS', receiver: 'LEADER', payload: 're-planned' }),
    ).toBe('STATUS → LEADER: re-planned');
  });

  it('excerpts long text and flattens newlines', () => {
    const long = `line one\n${'x'.repeat(200)}`;
    const summary = toolSummary('create_group', { task: long });
    expect(summary).not.toContain('\n');
    expect(summary.endsWith('…')).toBe(true);
    expect(summary.length).toBeLessThanOrEqual(82);
  });

  it('returns "" for unknown tools or missing args', () => {
    expect(toolSummary('whatever', { a: 1 })).toBe('');
    expect(toolSummary('forget', undefined)).toBe('');
    expect(toolSummary('disband_group', {})).toBe('');
  });
});
