/**
 * Typed endpoint functions for the veto-core REST API.
 * All paths are same-origin; the Vite dev proxy forwards /api → http://localhost:8443.
 */

import { apiRequest } from './client';
import type {
  AgentPatternEntity,
  AuthStatus,
  BgTaskListResponse,
  CreateSessionRequest,
  FsBrowseResponse,
  HistoryTurn,
  LoginRequest,
  LoginResponse,
  ModelTier,
  ModelTierProfile,
  PendingVeto,
  PromptAck,
  SessionEntity,
  SystemInfo,
  TaskDetail,
  TaskListResponse,
  TierBinding,
  VaultNote,
} from './types';

// ---- Auth ----

export function login(request: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/login', { method: 'POST', body: request });
}

export function setup(request: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/setup', { method: 'POST', body: request });
}

export function logout(): Promise<{ status: string; message: string; username: string }> {
  return apiRequest('/api/auth/logout', { method: 'POST' });
}

export function getAuthStatus(): Promise<AuthStatus> {
  return apiRequest<AuthStatus>('/api/auth/status');
}

export function createUser(
  username: string,
  password: string,
  role: 'ADMIN' | 'USER' = 'USER',
): Promise<{ status: string; message?: string }> {
  return apiRequest('/api/auth/users', { method: 'POST', body: { username, password, role } });
}

// ---- Sessions ----

export function listSessions(): Promise<SessionEntity[]> {
  return apiRequest<SessionEntity[]>('/api/sessions');
}

export function createSession(request: CreateSessionRequest): Promise<SessionEntity> {
  return apiRequest<SessionEntity>('/api/sessions', { method: 'POST', body: request });
}

export function deleteSession(name: string): Promise<void> {
  return apiRequest<void>(`/api/sessions/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

/** Persisted turns for a session — used to rebuild the ledger on selection. */
export function getSessionHistory(name: string): Promise<HistoryTurn[]> {
  return apiRequest<HistoryTurn[]>(`/api/sessions/${encodeURIComponent(name)}/history`);
}

// ---- System ----

/** Server OS info — path syntax follows the SERVER's OS, not the browser's. */
export function getSystemInfo(): Promise<SystemInfo> {
  return apiRequest<SystemInfo>('/api/system/info');
}

// ---- HITL vetoes ----

/** Tool calls currently parked awaiting a human decision for this session. */
export function listVetoes(name: string): Promise<PendingVeto[]> {
  return apiRequest<PendingVeto[]>(`/api/sessions/${encodeURIComponent(name)}/vetoes`);
}

/** Resolve a parked veto with one of its offered option names. */
export function resolveVeto(name: string, callId: string, option: string): Promise<void> {
  return apiRequest<void>(
    `/api/sessions/${encodeURIComponent(name)}/vetoes/${encodeURIComponent(callId)}`,
    { method: 'POST', body: { option } },
  );
}

/**
 * The backend half of prompt cancel: every veto the session's agent is parked on
 * is declined (fail-safe refusal) so the agent unstucks. A running-but-not-parked
 * episode has no server-side interrupt — abort the in-flight request too.
 */
export function cancelSession(name: string): Promise<{ status: string; declined: number }> {
  return apiRequest(`/api/sessions/${encodeURIComponent(name)}/cancel`, { method: 'POST' });
}

// ---- Background tasks (/api/sessions/{name}/tasks) ----

/** The session's run_task background tasks (running first, then stopped). */
export function listBgTasks(name: string): Promise<BgTaskListResponse> {
  return apiRequest<BgTaskListResponse>(`/api/sessions/${encodeURIComponent(name)}/tasks`);
}

/**
 * Stop a RUNNING background task, or remove a STOPPED one from the registry —
 * the backend picks by the task's alive flag; the response `status` tells which
 * happened ("stopped" | "removed").
 */
export function stopOrRemoveBgTask(
  name: string,
  taskId: string,
): Promise<{ status: string; task: unknown }> {
  return apiRequest(`/api/sessions/${encodeURIComponent(name)}/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
  });
}

// ---- Prompt ----

/**
 * Submit a prompt — the backend acks (202) as soon as the episode is enqueued. The run's
 * progress/outcome streams over the WS bus; EPISODE_DONE is the authoritative end signal.
 */
export function sendPrompt(sessionName: string, prompt: string): Promise<PromptAck> {
  return apiRequest<PromptAck>(`/api/sessions/${encodeURIComponent(sessionName)}/prompt`, {
    method: 'POST',
    body: { prompt },
  });
}

// ---- Model tier profiles (/api/modeltiers) ----

export function listModelTierProfiles(): Promise<ModelTierProfile[]> {
  return apiRequest<ModelTierProfile[]>('/api/modeltiers');
}

/** 201 profile view; 409 on duplicate name. */
export function createModelTierProfile(name: string): Promise<ModelTierProfile> {
  return apiRequest<ModelTierProfile>('/api/modeltiers', { method: 'POST', body: { name } });
}

/** 204; 404 if missing. */
export function activateModelTierProfile(name: string): Promise<void> {
  return apiRequest<void>(`/api/modeltiers/${encodeURIComponent(name)}/activate`, {
    method: 'POST',
  });
}

/** 204; 404 if missing. */
export function deleteModelTierProfile(name: string): Promise<void> {
  return apiRequest<void>(`/api/modeltiers/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

/** Only rows that exist come back — merge onto the four tiers client-side. */
export function getTierBindings(profile: string): Promise<TierBinding[]> {
  return apiRequest<TierBinding[]>(`/api/modeltiers/${encodeURIComponent(profile)}/bindings`);
}

/**
 * Partial update: only the keys present in `fields` are touched. Values are
 * wire strings ("0.7", "8192"); empty string clears baseUrl. 400 carries a
 * "field: reason" message.
 */
export function putTierBinding(
  profile: string,
  tier: ModelTier,
  fields: Record<string, string>,
): Promise<void> {
  return apiRequest<void>(
    `/api/modeltiers/${encodeURIComponent(profile)}/bindings/${encodeURIComponent(tier)}`,
    { method: 'PUT', body: fields },
  );
}

// ---- Vault notes (/api/vault/notes) ----

/** Sorted note titles. */
export function listVaultNotes(): Promise<string[]> {
  return apiRequest<string[]>('/api/vault/notes');
}

/** One note, value included (404 keyed body when missing). */
export function getVaultNote(title: string): Promise<VaultNote> {
  return apiRequest<VaultNote>(`/api/vault/notes/${encodeURIComponent(title)}`);
}

/** Create or overwrite a note. 204. */
export function putVaultNote(title: string, value: string): Promise<void> {
  return apiRequest<void>('/api/vault/notes', { method: 'PUT', body: { title, value } });
}

/** 204; 404 if missing. */
export function deleteVaultNote(title: string): Promise<void> {
  return apiRequest<void>(`/api/vault/notes/${encodeURIComponent(title)}`, { method: 'DELETE' });
}

// ---- Patterns ----

export function listPatterns(): Promise<AgentPatternEntity[]> {
  return apiRequest<AgentPatternEntity[]>('/api/patterns');
}

export function createPattern(name: string, tier: ModelTier): Promise<AgentPatternEntity> {
  return apiRequest<AgentPatternEntity>('/api/patterns', { method: 'POST', body: { name, tier } });
}

export function deletePattern(name: string): Promise<void> {
  return apiRequest<void>(`/api/patterns/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

// ---- Filesystem browser ----

/** Omit `path` for the filesystem roots (drive letters on Windows). */
export function browseFs(path?: string): Promise<FsBrowseResponse> {
  const query = path !== undefined && path !== '' ? `?path=${encodeURIComponent(path)}` : '';
  return apiRequest<FsBrowseResponse>(`/api/fs/browse${query}`);
}

// ---- Tasks ----

export function listTasks(): Promise<TaskListResponse> {
  return apiRequest<TaskListResponse>('/api/tasks');
}

export function getTask(id: string): Promise<TaskDetail> {
  return apiRequest<TaskDetail>(`/api/tasks/${encodeURIComponent(id)}`);
}

export function cancelTask(id: string): Promise<{ status: string; id: string; newStatus: string }> {
  return apiRequest(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
