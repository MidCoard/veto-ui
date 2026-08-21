/**
 * DTOs mirroring the veto-core REST API exactly as serialized by Jackson
 * (camelCase, no naming strategy). Source: veto-core controllers + entities.
 */

// ---- Auth (/api/auth) ----

export interface LoginRequest {
  username: string;
  password: string;
}

/** POST /api/auth/login and /api/auth/setup success body. */
export interface LoginResponse {
  status: 'ok';
  token: string;
  username: string;
  role: 'ADMIN' | 'USER';
  /** Present on setup ("Vault initialized and unlocked"). */
  message?: string;
}

/** GET /api/auth/status */
export interface AuthStatus {
  setupNeeded: boolean;
  vaultLocked: boolean;
  activeSessions: number;
  currentUser: string | null;
  timestamp: string;
  authenticated: boolean;
  username?: string;
}

// ---- Sessions (/api/sessions) ----

/**
 * JPA entities serialize Instant as fractional epoch SECONDS on the wire
 * (Jackson WRITE_DATES_AS_TIMESTAMPS); tolerate ISO strings too.
 * Parse with src/lib/time.ts helpers, never `new Date(...)` directly.
 */
export type WireTimestamp = number | string;

/** SessionEntity — bean getter naming. */
export interface SessionEntity {
  id: string;
  owner: string;
  name: string;
  /** CSV of absolute paths, or null. */
  workspaceRoots: string | null;
  primaryAgentId: string | null;
  createdAt: WireTimestamp;
  lastActiveAt: WireTimestamp | null;
}

/** POST /api/sessions request body (CreateSessionRequest record). */
export interface CreateSessionRequest {
  pattern: string;
  name?: string;
  /** CSV of absolute paths. */
  workspaceRoots: string;
}

// ---- Filesystem browser (/api/fs) ----

/** One subdirectory (or filesystem root) in a browse response. */
export interface FsEntry {
  name: string;
  path: string;
}

/** GET /api/fs/browse response; path/parent are null at the roots level. */
export interface FsBrowseResponse {
  path: string | null;
  parent: string | null;
  entries: FsEntry[];
}

// ---- HITL vetoes (/api/sessions/{name}/vetoes) ----

/** A parked tool call awaiting a human decision. Option names are backend enums. */
export interface PendingVeto {
  callId: string;
  toolName: string;
  args: Record<string, unknown>;
  options: string[];
  /** Screening danger level (backend Danger enum name); undefined when not screened. */
  danger?: string;
}

// ---- Prompt (/api/sessions/{name}/prompt) ----

/** agent/TurnType.java enum names. */
export type TurnType =
  | 'USER_PROMPT'
  | 'USER_INTERRUPT'
  | 'ASSISTANT_THOUGHT'
  | 'ASSISTANT_RESPONSE'
  | 'TOOL_CALL'
  | 'TOOL_RESPONSE'
  | 'REWIND'
  | 'AGENT_INIT'
  | 'COMPACTION_SUMMARY'
  | 'RECALL';

export interface HistoryTurn {
  turnNumber: number;
  type: TurnType | string;
  payload: Record<string, unknown>;
  /** ISO-8601; present on the GET /api/sessions/{name}/history wire shape. */
  timestamp?: string;
}

/**
 * POST /api/sessions/{name}/prompt 202 ack. The episode starts and returns immediately;
 * progress and the outcome arrive as WS DeltaFrames (EPISODE_DONE ends the run), and
 * GET /api/sessions/{name}/history is the authoritative ledger.
 */
export interface PromptAck {
  status: string;
  sessionId: string;
}

// ---- System (/api/system) ----

/** GET /api/system/info — server OS info (no auth required). */
export interface SystemInfo {
  /** e.g. "Windows 11". */
  os: string;
  arch: string;
  /** "windows" | "posix". */
  family: string;
  /** "\\" on Windows, "/" elsewhere. */
  pathSeparator: string;
  /** An example absolute path in the SERVER's OS syntax, e.g. "D:\projects\one". */
  pathExample: string;
}

// ---- Model tier profiles (/api/modeltiers) ----

/** One model-tier profile (GET /api/modeltiers row). */
export interface ModelTierProfile {
  name: string;
  active: boolean;
  createdAt: WireTimestamp;
}

/**
 * One tier binding row (GET /api/modeltiers/{name}/bindings). Only rows that
 * exist are returned — the UI merges the four tiers itself. All fields are
 * null when unset.
 */
export interface TierBinding {
  tier: ModelTier;
  /** ProviderType enum name. */
  provider: string | null;
  baseUrl: string | null;
  model: string | null;
  /** Vault note title holding the API key. */
  credKey: string | null;
  temp: number | null;
  max: number | null;
}

// ---- Vault notes (/api/vault/notes) ----
// GET /api/vault/notes returns string[] (sorted titles);
// GET /api/vault/notes/{title} returns the note, value included.

/** GET /api/vault/notes/{title} — a note with its (sensitive) value. */
export interface VaultNote {
  title: string;
  value: string;
}

// ---- Patterns (/api/patterns) ----

export type ModelTier = 'TOP' | 'MID' | 'LOW' | 'LOCAL';

/** AgentPatternEntity. */
export interface AgentPatternEntity {
  id: string;
  name: string;
  tier: ModelTier;
  owner: string;
  createdAt: WireTimestamp;
  provider: string;
  model: string;
  topModel: string;
  credentialKey: string;
}

// ---- Background tasks (/api/sessions/{name}/tasks) ----

/** A run_task background task row (BackgroundTaskManager.TaskInfo wire shape). */
export interface BgTask {
  taskId: string;
  command: string;
  cwd: string;
  pid: number;
  /** true while the process is still running. */
  alive: boolean;
  /** null while alive. */
  exitCode: number | null;
  /** ISO-8601. */
  startedAt: string;
  /** ISO-8601; null while alive. */
  finishedAt: string | null;
  /** Seconds run so far (or total runtime once stopped). */
  uptimeSeconds: number;
  /** Tail of the task's merged stdout/stderr (last ~20 lines). */
  recentOutput?: string;
}

/** GET /api/sessions/{name}/tasks response. */
export interface BgTaskListResponse {
  status: string;
  tasks: BgTask[];
}

// ---- Tasks (/api/tasks) — legacy DAG tasks ----

export interface TaskSummary {
  id: string;
  taskType: string;
  /** DAGPayloadStatus enum name. */
  status: string;
  createdAt: WireTimestamp;
}

export interface TaskListResponse {
  status: 'ok';
  total: number;
  tasks: TaskSummary[];
  busConnected: boolean;
  timestamp: string;
}

export interface TaskDetail {
  status: string;
  id: string;
  taskType: string;
  dagStatus: string;
  parameters: Record<string, unknown>;
  dependencies: unknown[];
  sourceComponent: string | null;
  targetComponent: string | null;
  createdAt: WireTimestamp;
  updatedAt: WireTimestamp;
  timestamp: string;
}
