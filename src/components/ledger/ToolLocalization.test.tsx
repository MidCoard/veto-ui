import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { I18nProvider } from '../../i18n/I18nContext';
import ToolConversationDetails from './ToolConversationDetails';
import { Fields } from './ToolDetailViews';

afterEach(() => { cleanup(); localStorage.clear(); });
it('localizes command attributes and enum values without translating command content', () => {
  localStorage.setItem('veto.lang', 'zh-CN');
  render(<I18nProvider><ToolConversationDetails toolName="run_command" args={{ commands: [{ executable: 'echo', args: ['AND'] }], connect: 'AND', network: false, timeout: 30 }} /></I18nProvider>);
  expect(screen.getByText('执行顺序')).toBeInTheDocument();
  expect(screen.getByText('全部成功后继续')).toBeInTheDocument();
  expect(screen.getByText('网络访问')).toBeInTheDocument();
  expect(screen.getByText('否')).toBeInTheDocument();
  expect(screen.getByText('echo AND')).toBeInTheDocument();
});
it('localizes nested result metadata and preserves unknown values', () => {
  localStorage.setItem('veto.lang', 'zh-CN');
  render(<I18nProvider><Fields values={{ tasks: [{ state: 'RUNNING', exitCode: 0, cwd: '/app' }], customField: 'customValue' }} /></I18nProvider>);
  for (const text of ['任务列表', '状态', '执行中', '退出码', '工作目录', '/app', 'customField', 'customValue']) expect(screen.getByText(text)).toBeInTheDocument();
});
it('preserves user-defined answer keys and text', () => {
  localStorage.setItem('veto.lang', 'zh-CN');
  render(<I18nProvider><Fields values={{ status: 'success' }} literal /></I18nProvider>);
  expect(screen.getByText('status')).toBeInTheDocument();
  expect(screen.getByText('success')).toBeInTheDocument();
});
