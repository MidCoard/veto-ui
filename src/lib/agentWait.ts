import type { SessionAgent } from '../api/types';

export type AgentWait = 'PAUSED' | 'APPROVAL' | 'QUESTION' | 'BREAKER' | 'UNKNOWN';

export function agentWait(agent: SessionAgent | undefined): AgentWait | null {
  if (!agent || agent.state === 'TERMINATED') return null;
  if (agent.state === 'PAUSED') return 'PAUSED';
  if (!agent.executionWait) return null;
  switch (agent.executionWait) {
    case 'APPROVAL': case 'QUESTION': case 'BREAKER': return agent.executionWait;
    default: return 'UNKNOWN';
  }
}
