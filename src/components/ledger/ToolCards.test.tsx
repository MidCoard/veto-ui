import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../../i18n/I18nContext';
import { ToolCallCard, ToolResultBody } from './ToolCards';
import LedgerEntry from './LedgerEntry';

afterEach(cleanup);
function result(name: string, text: string, success = true) {
  return render(<I18nProvider><ToolResultBody toolName={name} text={text} success={success} /></I18nProvider>);
}

describe('backend tool result contracts', () => {
  it.each([
    ['complete', 'Answer found'], ['partial', 'Partially checked'], ['not_found', 'Information not found'],
  ])('renders web_fetch %s coverage independently of transport success', (outcome, label) => {
    result('web_fetch', JSON.stringify({ outcome, answer: 'Timeout uses seconds.', evidence: [{ url: 'https://example.com/docs', section: 'Timeout configuration', quote: 'The default timeout is 30 seconds.' }], limitations: ['Only v3 was checked.'], execution: { id: 'reader-1', model: 'reader-model', durationMs: 150, modelCalls: 2 } }));
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText('Timeout uses seconds.')).toBeInTheDocument();
    expect(screen.getByText('The default timeout is 30 seconds.')).toBeInTheDocument();
    expect(screen.getByText('Only v3 was checked.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Timeout configuration' })).toHaveAttribute('href', 'https://example.com/docs');
    expect(screen.getByText('reader-model')).toBeInTheDocument();
  });
  it('keeps web_fetch content inert and unsafe evidence destinations unlinked', () => {
    const view = result('web_fetch', JSON.stringify({ outcome: 'partial', answer: '<img src=x onerror=alert(1)>', evidence: [{ url: 'javascript:alert(1)', section: '<script>unsafe</script>', quote: '<iframe src="evil">' }, { url: 'https://secret@example.com', section: 'Credentials', quote: 'Untrusted' }], limitations: [] }));
    expect(view.container.querySelector('a,script,img,iframe')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  });
  it.each([
    ['complete', 'Answer found'], ['partial', 'Partially checked'], ['not_found', 'Information not found'],
  ])('renders DETAILED web_fetch %s results with evidence and execution details', (outcome, label) => {
    const text = JSON.stringify({ status: 'success', format: 'json', errorCode: null, content: JSON.stringify({ outcome, answer: 'Authority is based on the URI.', evidence: [{ url: 'https://www.rfc-editor.org/rfc/rfc6454.txt', section: 'Ambient Authority', quote: 'user agents grant authority to content based on its URI' }], limitations: [], execution: { model: 'MiniMax-M3', modelCalls: 5 } }) });
    result('web_fetch', text);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText('Authority is based on the URI.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ambient Authority' })).toHaveAttribute('href', 'https://www.rfc-editor.org/rfc/rfc6454.txt');
    expect(screen.getByText('MiniMax-M3')).toBeInTheDocument();
    expect(screen.getByText(text)).toBeInTheDocument();
  });
  it('preserves malformed DETAILED content instead of claiming success', () => {
    const text = JSON.stringify({ status: 'success', format: 'json', content: '{broken' });
    result('web_fetch', text);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByText('Answer found')).not.toBeInTheDocument();
  });
  it('does not let a wrapped body override a failed tool status', () => {
    const text = JSON.stringify({ status: 'success', format: 'json', content: JSON.stringify({ outcome: 'complete', answer: 'Unsupported', evidence: [], limitations: [] }) });
    result('web_fetch', text, false);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByText('Answer found')).not.toBeInTheDocument();
  });
  it.each(['Access denied', 'Reading cancelled'])('keeps web_fetch canonical failures visible: %s', message => {
    result('web_fetch', message, false);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByText('Answer found')).not.toBeInTheDocument();
  });
  it('preserves malformed web_fetch evidence instead of showing a misleading semantic result', () => {
    const text = JSON.stringify({ outcome: 'complete', answer: 'Unsupported', evidence: [{ url: 'https://example.com' }], limitations: [] });
    result('web_fetch', text);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByText('Answer found')).not.toBeInTheDocument();
  });
  it('shows the web_fetch objective and URL before a result arrives', () => {
    render(<I18nProvider><ToolCallCard toolName="web_fetch" args={{ url: 'https://example.com/docs', objective: 'Find the timeout unit.' }} /></I18nProvider>);
    expect(screen.getByText('web_fetch')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/docs')).toBeInTheDocument();
    expect(screen.getByText('Find the timeout unit.')).toBeInTheDocument();
    expect(screen.queryByText('Answer found')).not.toBeInTheDocument();
  });
  it('renders web search titles as safe links and retains snippets', () => {
    result('web_search', 'Found 1 results:\n\n1. Java docs\n   https://example.com/docs\n   Reference guide\n\nSources:\n- https://example.com/docs\n');
    expect(screen.getByRole('link', { name: '1. Java docs' })).toHaveAttribute('href', 'https://example.com/docs');
    expect(screen.getByText('Reference guide')).toBeInTheDocument();
  });
  it('does not turn untrusted URLs or page markup into executable content', () => {
    const view = result('web_fetch', '[200] javascript:alert(1)\n\n<script>alert(1)</script>');
    expect(view.container.querySelector('a,script')).toBeNull();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
  });
  it('shows matching files and truncation metadata', () => {
    result('find_files', JSON.stringify({ base: '/app', pattern: '**/*.java', matches: ['src/Main.java'], truncated: true, truncationReason: 'RESULT_LIMIT', skippedEntries: 5 }));
    expect(screen.getByText('src/Main.java')).toBeInTheDocument();
    expect(screen.getByText('RESULT_LIMIT')).toBeInTheDocument();
    expect(screen.getByText('skippedEntries')).toBeInTheDocument();
  });
  it('shows each background task rather than only the count', () => {
    result('view_task', JSON.stringify({ count: 2, tasks: [{ taskId: 'bg-1', alive: true, command: 'npm run dev', cwd: '/app' }, { taskId: 'bg-2', alive: false, exitCode: 1, recentOutput: 'Build failed' }] }));
    for (const text of ['bg-1', 'bg-2', 'npm run dev', '/app', 'Build failed']) expect(screen.getByText(text)).toBeInTheDocument();
  });
  it('shows question options and recorded answers', () => {
    render(<I18nProvider><ToolCallCard toolName="ask_user" args={{ questions: [{ header: 'Format', id: 'format', question: 'Which format?', options: [{ label: 'Markdown (Recommended)', description: 'Easy to edit' }, { label: 'Plain text', description: 'No formatting' }] }] }} /></I18nProvider>);
    expect(screen.getByText('Which format?')).toBeInTheDocument();
    expect(screen.getByText('Easy to edit')).toBeInTheDocument();
    cleanup();
    result('ask_user', '{"answers":{"format":"Markdown"}}');
    expect(screen.getByText('format')).toBeInTheDocument();
    expect(screen.getByText('Markdown')).toBeInTheDocument();
  });
  it.each(['find_files', 'ask_user', 'view_task', 'web_search', 'input_task'])('keeps malformed %s bodies visible', name => {
    result(name, '{unexpected');
    expect(screen.getByText('{unexpected')).toBeInTheDocument();
  });
  it('never paints a failed result as a directory listing', () => {
    const view = result('list_dir', 'Access denied', false);
    expect(view.container.querySelector('pre')).toHaveTextContent('Access denied');
  });
  it('shows combined tool status without payload details or turn numbers in conversation', () => {
    const resultEntry = { id: 'result', seq: 3, kind: 'tool_result' as const, text: 'Private output details', success: true };
    render(<I18nProvider><LedgerEntry entry={{ id: 'call', seq: 2, kind: 'tool_call', toolName: 'web_fetch', text: '', args: { url: 'https://example.com', detail: 'Exact argument details' }, resultEntry }} /></I18nProvider>);
    expect(screen.getByText('web_fetch')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/Exact argument details|Private output details|T-02/)).not.toBeInTheDocument();
  });
  it.each([
    [true, undefined, 'Running', 'running'],
    [false, undefined, 'Waiting for result', 'waiting'],
    [true, true, 'Succeeded', 'success'],
    [true, false, 'Failed', 'failed'],
  ] as const)('shows the execution LED for live=%s, success=%s', (live, success, label, state) => {
    render(<I18nProvider><LedgerEntry entry={{ id: 'call', seq: 1, kind: 'tool_call', text: '', toolName: 'web_fetch', live,
      resultEntry: success === undefined ? undefined : { id: 'result', seq: 2, kind: 'tool_result', text: '', success },
    }} /></I18nProvider>);
    expect(screen.getByRole('img', { name: label })).toHaveAttribute('data-state', state);
  });
  it('shows the fetch objective alongside its URL in conversation', () => {
    render(<I18nProvider><LedgerEntry entry={{ id: 'fetch', seq: 1, kind: 'tool_call', text: '', toolName: 'web_fetch', args: { url: 'https://example.com', objective: 'Find the timeout unit.' } }} /></I18nProvider>);
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByText('Find the timeout unit.')).toBeInTheDocument();
  });
  it('shows a bounded write preview and the actual file path', () => {
    render(<I18nProvider><LedgerEntry entry={{ id: 'write', seq: 1, kind: 'tool_call', text: '', toolName: 'write_to_file', args: { absolutePath: '/app/config.ts', codeContent: 'const enabled = true;\n'.repeat(12) + 'Hidden tail' } }} /></I18nProvider>);
    expect(screen.getByText('/app/config.ts')).toBeInTheDocument();
    expect(screen.getByText(/const enabled = true;/)).toBeInTheDocument();
    expect(screen.queryByText(/Hidden tail/)).not.toBeInTheDocument();
  });
  it('shows both sides of a replacement as inert text', () => {
    const view = render(<I18nProvider><LedgerEntry entry={{ id: 'edit', seq: 1, kind: 'tool_call', text: '', toolName: 'replace_file_content', args: { absolutePath: '/app/index.html', targetContent: '<script>old()</script>', replacementContent: '<script>newValue()</script>' } }} /></I18nProvider>);
    expect(screen.getByText('<script>old()</script>')).toBeInTheDocument();
    expect(screen.getByText('<script>newValue()</script>')).toBeInTheDocument();
    expect(view.container.querySelector('script')).toBeNull();
  });
  it('previews thoughts and renders Markdown only when expanded', () => {
    render(<I18nProvider><LedgerEntry entry={{ id: 'thought', seq: 1, kind: 'thought', text: 'Check the inputs.\n\n- First item\n- Second item' }} /></I18nProvider>);
    const toggle = screen.getByRole('button', { name: 'Thought' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(/Check the inputs/)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(toggle);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
  it('updates a collapsed live thought preview without opening it', () => {
    const thought = (text: string, live: boolean) => <I18nProvider><LedgerEntry entry={{ id: 'thought', seq: 1, kind: 'thought', text, live }} /></I18nProvider>;
    const view = render(thought('Checking inputs', true));
    expect(screen.getByText('Thinking…')).toBeInTheDocument();
    view.rerender(thought('Inputs checked', false));
    expect(screen.getByText('Inputs checked')).toBeInTheDocument();
    expect(screen.queryByText('Thinking…')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thought' })).toHaveAttribute('aria-expanded', 'false');
  });
  it('does not hide failed think calls', () => {
    render(<I18nProvider><LedgerEntry entry={{ id: 'failed-think', seq: 1, kind: 'tool_result', toolName: 'think', text: 'Invalid arguments', success: false }} /></I18nProvider>);
    expect(screen.getByText('think')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Failed' })).toBeInTheDocument();
  });
  it.each(['move_path', 'delete_path', 'input_task', 'write_to_file', 'replace_file_content', 'run_task', 'stop_task', 'view_file', 'list_dir', 'grep_search', 'load_skill', 'run_command', 'recall_memory', 'write_memory', 'forget_memory', 'inspect_group', 'create_node', 'remove_node', 'post_message', 'remote_extension'])('keeps %s failure details intact', name => {
    result(name, 'Request refused', false);
    expect(screen.getByText('Request refused')).toBeInTheDocument();
  });
});
