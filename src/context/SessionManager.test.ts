import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './SessionManager';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  it('should initialize with a default session', () => {
    expect(sessionManager.getSessionsCount()).toBe(1);
    expect(sessionManager.getCurrentSession()).toBeDefined();
    expect(sessionManager.getCurrentSession()?.name).toBe('Default');
  });

  it('should create a new session', () => {
    const session = sessionManager.createSession('Test Session');
    expect(sessionManager.getSessionsCount()).toBe(2);
    expect(session.name).toBe('Test Session');
    expect(sessionManager.getCurrentSession()?.id).toBe(session.id);
  });

  it('should switch between sessions', () => {
    const session1 = sessionManager.getCurrentSession()!;
    const session2 = sessionManager.createSession('Session 2');
    
    expect(sessionManager.getCurrentSession()?.id).toBe(session2.id);
    
    sessionManager.switchToSession(session1.id);
    expect(sessionManager.getCurrentSession()?.id).toBe(session1.id);
  });

  it('should delete a session', () => {
    const session1 = sessionManager.getCurrentSession()!;
    const session2 = sessionManager.createSession('Session 2');
    
    expect(sessionManager.getSessionsCount()).toBe(2);
    
    sessionManager.deleteSession(session2.id);
    expect(sessionManager.getSessionsCount()).toBe(1);
    expect(sessionManager.getCurrentSession()?.id).toBe(session1.id);
  });

  it('should not delete the last session', () => {
    const session1 = sessionManager.getCurrentSession()!;
    const result = sessionManager.deleteSession(session1.id);
    
    expect(result).toBe(false);
    expect(sessionManager.getSessionsCount()).toBe(1);
  });

  it('should add messages to the current session', () => {
    sessionManager.sendMessage('Hello Veto');
    const messages = sessionManager.getCurrentSessionMessages();
    
    expect(messages.length).toBe(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('Hello Veto');
  });

  it('should enforce sliding window for messages', () => {
    // Set a small window for testing if possible, but the class has it hardcoded to 100
    // We can just loop 105 times
    for (let i = 0; i < 105; i++) {
      sessionManager.sendMessage(`Message ${i}`);
    }
    
    const messages = sessionManager.getCurrentSessionMessages();
    expect(messages.length).toBe(100);
    expect(messages[0].content).toBe('Message 5');
    expect(messages[99].content).toBe('Message 104');
  });

  it('should handle HITL approvals', () => {
    const messageId = 'test-hitl-id';
    // Manually add a HITL message
    sessionManager.addExternalMessage(sessionManager.getCurrentSession()!.id, {
      id: messageId,
      role: 'assistant',
      type: 'hitl_approval',
      content: 'Approval needed',
      timestamp: new Date(),
      metadata: { requires_approval: true }
    });
    
    sessionManager.handleApproval(messageId, true);
    
    const messages = sessionManager.getCurrentSessionMessages();
    expect(messages.length).toBe(2);
    expect(messages[1].content).toContain('Approved');
    expect(messages[1].metadata?.vetoAction).toBe('pass');
  });

  it('should handle HITL rejections', () => {
    const messageId = 'test-hitl-id';
    sessionManager.addExternalMessage(sessionManager.getCurrentSession()!.id, {
      id: messageId,
      role: 'assistant',
      type: 'hitl_approval',
      content: 'Approval needed',
      timestamp: new Date(),
      metadata: { requires_approval: true }
    });
    
    sessionManager.handleApproval(messageId, false);
    
    const messages = sessionManager.getCurrentSessionMessages();
    expect(messages.length).toBe(2);
    expect(messages[1].content).toContain('Rejected');
    expect(messages[1].metadata?.vetoAction).toBe('block');
  });

  it('should manage workspace nodes', () => {
    const initialCount = sessionManager.getWorkspaceNodeCount();
    sessionManager.addWorkspaceFile('test.txt', '/test.txt');
    
    expect(sessionManager.getWorkspaceNodeCount()).toBe(initialCount + 1);
    const nodes = sessionManager.getWorkspaceTree().findByName('test.txt');
    expect(nodes.length).toBe(1);
    expect(nodes[0].path).toBe('/test.txt');
  });
});
