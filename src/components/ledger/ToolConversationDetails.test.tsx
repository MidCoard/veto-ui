import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BuiltinToolTestScope as I18nProvider } from '../../plugins/BuiltinToolTestScope';
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
    ['load_skill', { skillName: 'java-build' }, 'java-build'],
    ['ask_user', { questions: [{ question: 'Which format?', options: [{ label: 'Markdown' }] }] }, 'Markdown'],
    ['recall_memory', { query: 'build conventions' }, 'build conventions'],
    ['write_memory', { mode: 'PROMOTE', promoteMemoryId: 'memory-7', projectId: 'veto' }, 'memory-7'],
    ['forget_memory', { memoryId: 'memory-8' }, 'memory-8'],
    ['create_group', { task: 'Audit the codebase' }, 'Audit the codebase'],
    ['disband_group', {}, 'Disband the current group.'],
    ['inspect_group', { sinceSeq: 10, waitSeconds: 5 }, '10'],
    ['create_task', { taskId: 'test', description: 'Verify behavior', skillset: 'testing', dependsOn: ['build'] }, 'Verify behavior'],
    ['remove_node', { nodeId: 'unused-node' }, 'unused-node'],
    ['post_message', { type: 'FEEDBACK', receiver: 'mate-1', payload: 'Please review this change' }, 'Please review this change'],
  ] as [string, Record<string, unknown>, string][])('renders the relevant %s details', (name, args, expected) => {
    show(name, args);
    expect(screen.getAllByText(expected, {exact: name !== 'ask_user'}).length).toBeGreaterThan(0);
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
    ['recall_memory', { query: 'unique memory' }, 'unique memory'],
    ['view_task', { taskId: 'unique task' }, 'unique task'],
    ['stop_task', { taskId: 'unique task' }, 'unique task'],
    ['input_task', { taskId: 'unique task', content: 'input text' }, 'unique task'],
    ['load_skill', { skillName: 'unique skill' }, 'unique skill'],
    ['create_task', { taskId: 'unique node', description: 'work to do' }, 'unique node'],
    ['remove_node', { nodeId: 'unique node' }, 'unique node'],
    ['forget_memory', { memoryId: 'unique memory' }, 'unique memory'],
    ['post_message', { receiver: 'unique receiver', payload: 'message text' }, 'unique receiver'],
  ] as [string, Record<string, unknown>, string][])('does not repeat the %s header target', (name, args, target) => {
    show(name, args);
    expect(screen.getAllByText(target)).toHaveLength(1);
  });
  it('keeps distinct fields even when their values match', () => {
    show('create_task', { taskId: 'shared text', description: 'shared text' });
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

describe('visible failure reasons', () => {
  it('shows the failed question reason and error code inline', () => {
    render(<I18nProvider><LedgerEntry entry={{ id: 'ask', seq: 7, kind: 'tool_call', toolName: 'ask_user', text: '',
      resultEntry: { id: 'result', seq: 8, kind: 'tool_result', text: 'Question project: label has 43 characters; maximum is 40.', success: false, errorCode: 'INVALID_QUESTIONS' },
    }} /></I18nProvider>);
    expect(screen.getByRole('alert')).toHaveTextContent('INVALID_QUESTIONS');
    expect(screen.getByRole('alert')).toHaveTextContent('label has 43');
    expect(screen.getByRole('alert')).not.toHaveTextContent('No answer is required');
  });
  it('shows an explanation when a failed tool returned no detail', () => {
    render(<I18nProvider><LedgerEntry entry={{ id: 'result', seq: 8, kind: 'tool_result', toolName: 'list_dir', text: '', success: false }} /></I18nProvider>);
    expect(screen.getByRole('alert')).toHaveTextContent('did not provide an error description');
  });
  it('renders execution failure text as inert text and retains its cause', () => {
    const view = render(<I18nProvider><LedgerEntry entry={{ id: 'failure', seq: 9, kind: 'error', errorCode: 'EXECUTION_ERROR', text: 'Invalid model response <script>alert(1)</script>' }} /></I18nProvider>);
    expect(screen.getByRole('alert')).toHaveTextContent('Run stopped');
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid model response');
    expect(view.container.querySelector('script')).toBeNull();
  });
});

 it('does not describe a local connection error as a stopped agent run', () => {
    render(<I18nProvider><LedgerEntry entry={{ id: 'local', seq: 0, kind: 'error', text: 'Cannot reach backend' }} /></I18nProvider>);
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach backend');
    expect(screen.queryByText('Run stopped')).not.toBeInTheDocument();
  });

describe('generic historical plugin calls', () => {
 it('keeps complete question JSON and persisted answer text readable without a plugin renderer', () => {
  const questions=Array.from({length:10},(_,i)=>({id:`q${i}`,question:`Question ${i}?`,options:[{label:'Yes'},{label:'No'}]}));
  const view=render(<I18nProvider><LedgerEntry entry={{id:'call',seq:1,kind:'tool_call',text:'',toolName:'ask_user',args:{questions},resultEntry:{id:'result',seq:2,kind:'tool_result',text:JSON.stringify({answers:{q9:'<b>custom answer</b>'}}),success:true}}}/></I18nProvider>);
  expect(view.container).toHaveTextContent('Question 9?');
  expect(view.container).toHaveTextContent('custom answer');
  expect(view.container.querySelector('b')).toBeNull();
  expect(screen.queryByText(/Selected/)).not.toBeInTheDocument();
 });
});

it.each(['fetch_page','find_sections','read_sections','finish_read','think','create_node'])('keeps unregistered historical %s arguments readable without impersonating a current tool',name=>{const view=show(name,{historical:'Original data'});expect(view.container).toHaveTextContent('Original data');});
