/**
 * C2: Message and Session type definitions
 */

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

/**
 * C2: Sliding-window session context
 */
export interface SessionWindow {
  maxTokens: number;
  currentTokens: number;
  messages: Message[];
  overflowMessages: Message[];
}

/**
 * C2: Connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
