import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../../i18n/I18nContext';
import LedgerEntry from './LedgerEntry';

afterEach(cleanup);
const show = (toolName: string, args: Record<string, unknown>) => render(<I18nProvider><LedgerEntry entry={{ id: 'call', seq: 1, kind: 'tool_call', text: '', toolName, args }} /></I18nProvider>);

describe('conversation tool summaries', () => {
  it.each([
    ['run_command', { commands: [{ executable: 'git', args: ['status', '--short'] }], connect: 'AND', network: false }, 'git status --short'],
    ['run_task', { commands: [{ executable: 'npm', args: ['run', 'dev'] }] }, 'npm run dev'],
    ['view_task', {}, 'List background tasks.'],
    ['stop_task', { taskId: 'task-123' }, 'task-123'],
    ['input_task', { taskId: 'task-123', content: 'hello process', closeStdin: false }, 'hello process'],
    ['view_file', { absolutePath: '/app/main.ts', startLine: 12, endLine: 30 }, '12'],
    ['list_dir', { absolutePath: '/app/src' }, '/app/src'],
    ['find_files', { absolutePath: '/app', pattern: '**/*.java' }, '**/*.java'],
    ['grep_search', { absolutePath: '/app', query: 'needle', includes: ['*.ts'], caseInsensitive: true }, '*.ts'],
    ['move_path', { sourceAbsolutePath: '/app/old', destinationAbsolutePath: '/app/new' }, '/app/new'],
    ['delete_path', { absolutePath: '/app/temp', recursive: true }, 'Recursive'],
    ['write_to_file', { absolutePath: '/app/a', codeContent: 'new content', overwrite: false }, 'new content'],
    ['replace_file_content', { absolutePath: '/app/a', startLine: 1, endLine: 2, targetContent: 'old content', replacementContent: 'changed content' }, 'changed content'],
    ['web_search', { query: 'manual', allowed_domains: ['example.org'] }, 'example.org'],
    ['web_fetch', { url: 'https://example.org', objective: 'Read the manual' }, 'Read the manual'],
    ['fetch_page', {}, 'Fetch the page assigned to this reader.'],
    ['find_sections', { query: 'installation' }, 'installation'],
    ['read_sections', { ids: ['section-1', 'section-4'] }, 'section-1, section-4'],
    ['finish_read', { outcome: 'partial', answer: 'Found instructions', evidenceIds: ['e1'], limitations: ['Missing appendix'] }, 'Missing appendix'],
    ['load_skill', { skillName: 'java-build' }, 'java-build'],
    ['think', {}, 'Thinking…'],
    ['ask_user', { questions: [{ question: 'Which format?', options: [{ label: 'Markdown' }] }] }, 'Markdown'],
    ['recall_memory', { query: 'build conventions' }, 'build conventions'],
    ['write_memory', { mode: 'PROMOTE', promoteMemoryId: 'memory-7', projectId: 'veto' }, 'memory-7'],
    ['forget_memory', { memoryId: 'memory-8' }, 'memory-8'],
    ['create_group', { task: 'Audit the codebase' }, 'Audit the codebase'],
    ['disband_group', {}, 'Disband the current group.'],
    ['inspect_group', { sinceSeq: 10, waitSeconds: 5 }, '10'],
    ['create_node', { nodeId: 'test', description: 'Verify behavior', skillset: 'testing', dependsOn: ['build'] }, 'Verify behavior'],
    ['remove_node', { nodeId: 'unused-node' }, 'unused-node'],
    ['post_message', { type: 'FEEDBACK', receiver: 'mate-1', payload: 'Please review this change' }, 'Please review this change'],
  ] as [string, Record<string, unknown>, string][])('renders the relevant %s details', (name, args, expected) => {
    show(name, args);
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
  });
  it('shows the file path only once while retaining the line range', () => {
    show('view_file', { absolutePath: '/app/ModpackCard.vue', startLine: 12, endLine: 30 });
    expect(screen.getAllByText('/app/ModpackCard.vue')).toHaveLength(1);
    expect(screen.queryByText('Path')).not.toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });
  it.each([
    ['web_search', { query: 'unique search' }, 'unique search'],
    ['find_sections', { query: 'unique section' }, 'unique section'],
    ['recall_memory', { query: 'unique memory' }, 'unique memory'],
    ['view_task', { taskId: 'unique task' }, 'unique task'],
    ['stop_task', { taskId: 'unique task' }, 'unique task'],
    ['input_task', { taskId: 'unique task', content: 'input text' }, 'unique task'],
    ['load_skill', { skillName: 'unique skill' }, 'unique skill'],
    ['create_node', { nodeId: 'unique node', description: 'work to do' }, 'unique node'],
    ['remove_node', { nodeId: 'unique node' }, 'unique node'],
    ['forget_memory', { memoryId: 'unique memory' }, 'unique memory'],
    ['post_message', { receiver: 'unique receiver', payload: 'message text' }, 'unique receiver'],
  ] as [string, Record<string, unknown>, string][])('does not repeat the %s header target', (name, args, target) => {
    show(name, args);
    expect(screen.getAllByText(target)).toHaveLength(1);
  });
  it('keeps distinct fields even when their values match', () => {
    show('create_node', { nodeId: 'shared text', description: 'shared text' });
    expect(screen.getAllByText('shared text')).toHaveLength(2);
  });
  it('keeps a fetch objective in the body when the URL is missing', () => {
    show('web_fetch', { objective: 'Find supported versions' });
    expect(screen.getAllByText('Find supported versions')).toHaveLength(1);
  });
  it('keeps command arguments inert and shows every command in a chain', () => {
    const view = show('run_command', { commands: [{ executable: 'echo', args: ['<img src=x onerror=alert(1)>'] }, { executable: 'git', args: ['status'] }], connect: 'PIPE' });
    expect(view.container.querySelector('img')).toBeNull();
    expect(screen.getByText('git status')).toBeInTheDocument();
    expect(screen.getByText('PIPE')).toBeInTheDocument();
  });
  it('handles malformed commands without crashing or exposing raw objects', () => {
    show('run_command', { commands: 'broken' });
    expect(screen.getByText('Command details unavailable.')).toBeInTheDocument();
  });
  it('gives extension tools a readable bounded fallback', () => {
    show('extension_tool', { documentName: 'Design notes', text: 'x'.repeat(1500) });
    expect(screen.getByText('document Name')).toBeInTheDocument();
    expect(screen.getByText('Design notes')).toBeInTheDocument();
    expect(screen.queryByText('x'.repeat(1500))).not.toBeInTheDocument();
  });
});
