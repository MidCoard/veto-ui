/**
 * C2: Message and Session type definitions
 * C3: DAGPayload — the core message format for the Veto Protocol
 */

// ---- Core Message Types ----

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  type: 'text' | 'streaming' | 'hitl_approval' | 'code_result' | 'error';
  content: string;
  isStreaming?: boolean;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface Session {
  id: string;
  name: string;
  created: Date;
  lastActivity: Date;
  messageCount: number;
  messages: Message[];
}

// ---- C3: Veto Protocol Message Format ----
// Messages flow through the backend as DAG nodes.
// The UI receives and sends DAGPayload via WebSocket.

/**
 * Risk levels for HITL approval prompts.
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Approval state of a HITL submission.
 */
export type ApprovalState = 'pending' | 'approved' | 'rejected';

/**
 * C3: DAGPayload — the fundamental protocol message.
 *
 * Each message sent/received via the Veto backend is a DAG node.
 * When `requires_approval` is true, the UI must show HITLApprovalCard
 * before the message is forwarded.
 */
export interface DAGPayload {
  id: string;
  type: 'dag_message' | 'dag_hitl' | 'dag_result' | 'dag_error' | 'dag_heartbeat' | 'dag_ack';
  parent_ids: string[];
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  content_type: 'text' | 'markdown' | 'json' | 'code';
  metadata: DAGMetadata;
  timestamp: string; // ISO 8601
}

/**
 * C3: Metadata attached to every DAGPayload node.
 */
export interface DAGMetadata {
  requires_approval: boolean;
  risk_level: RiskLevel;
  approval_state: ApprovalState;
  title?: string;
  description?: string;
  veto_action?: 'pass' | 'block' | 'redact' | 'pending';
  token_count?: number;
  model?: string;
  error?: string;
  tags?: string[];
}

/**
 * C3: Acknowledgment sent back to the backend.
 */
export interface DAGAck {
  type: 'dag_ack';
  ack_id: string;
  status: 'received' | 'approved' | 'rejected';
  session_id: string;
  timestamp: string;
}

// ---- Connection ----

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

// ---- Workspace ----

/**
 * C2: Workspace Tree Node
 * Represents the dynamic workspace structure maintained by the client.
 */
export interface WorkspaceNode {
  id: string;
  name: string;
  type: 'file' | 'directory' | 'project' | 'target';
  path: string;
  children?: WorkspaceNode[];
  metadata?: Record<string, unknown>;
}

// ---- User Preferences ----

/**
 * C2: User Preference — vectorized long-term user preferences
 * (e.g., rigid formatting constraints, coding conventions)
 */
export interface UserPreference {
  key: string;
  category: 'formatting' | 'convention' | 'security' | 'workflow' | 'display';
  value: string | number | boolean;
  priority: number;
  source: 'explicit' | 'learned' | 'default';
  lastUpdated: Date;
}

// ---- Session Window (Sliding) ----

/**
 * C2: Sliding-window session context
 */
export interface SessionWindow {
  maxTokens: number;
  currentTokens: number;
  messages: Message[];
  overflowMessages: Message[];
}
