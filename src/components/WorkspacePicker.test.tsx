import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import WorkspacePicker from './WorkspacePicker';
import { browseFs, createFsDirectory } from '../api/endpoints';
import { ApiError } from '../api/client';
vi.mock('../api/endpoints', () => ({ browseFs: vi.fn(), createFsDirectory: vi.fn() }));
beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.mocked(browseFs).mockResolvedValue({ path: '/workspace', parent: '/', entries: [] });
});
afterEach(cleanup);
const mount = (onSelect = vi.fn()) => render(<I18nProvider><WorkspacePicker onSelect={onSelect} onClose={vi.fn()} /></I18nProvider>);
it('creates a folder in the current parent, opens it, then allows selection', async () => {
  const select = vi.fn();
  vi.mocked(createFsDirectory).mockResolvedValue({ path: '/workspace/new-project' });
  mount(select);
  await waitFor(() => expect(screen.getByRole('button', { name: 'New folder' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'New folder' }));
  fireEvent.change(screen.getByLabelText('Folder name'), { target: { value: 'new-project' } });
  vi.mocked(browseFs).mockResolvedValue({ path: '/workspace/new-project', parent: '/workspace', entries: [] });
  fireEvent.click(screen.getByRole('button', { name: 'Create folder' }));
  await waitFor(() => expect(createFsDirectory).toHaveBeenCalledWith('/workspace', 'new-project'));
  await waitFor(() => expect(browseFs).toHaveBeenLastCalledWith('/workspace/new-project'));
  expect(select).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Use this directory' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Use this directory' }));
  expect(select).toHaveBeenCalledWith('/workspace/new-project');
});
it('keeps the name and current folder after a duplicate error', async () => {
  vi.mocked(createFsDirectory).mockRejectedValue(new ApiError(409, 'Folder already exists'));
  mount();
  await waitFor(() => expect(screen.getByRole('button', { name: 'New folder' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'New folder' }));
  fireEvent.change(screen.getByLabelText('Folder name'), { target: { value: 'existing' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create folder' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Folder already exists');
  expect(screen.getByLabelText('Folder name')).toHaveValue('existing');
  expect(screen.getByText('/workspace')).toBeInTheDocument();
});
it('rejects path traversal without calling the creation API', async () => {
  mount();
  await waitFor(() => expect(screen.getByRole('button', { name: 'New folder' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'New folder' }));
  fireEvent.change(screen.getByLabelText('Folder name'), { target: { value: '../outside' } });
  fireEvent.keyDown(screen.getByLabelText('Folder name'), { key: 'Enter' });
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(createFsDirectory).not.toHaveBeenCalled();
});
it('does not offer creation at the virtual drive list', async () => {
  vi.mocked(browseFs).mockResolvedValue({ path: null, parent: null, entries: [] });
  mount();
  await screen.findByText(/No subdirectories/);
  expect(screen.getByRole('button', { name: 'New folder' })).toBeDisabled();
});
