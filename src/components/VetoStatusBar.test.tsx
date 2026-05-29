import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import VetoStatusBar from './VetoStatusBar';
import { useVeto } from '../context/VetoContext';

// Mock the useVeto hook
vi.mock('../context/VetoContext', () => ({
  useVeto: vi.fn()
}));

describe('VetoStatusBar', () => {
  it('renders correctly when connected', () => {
    // Mock the context value for connected state
    (useVeto as any).mockReturnValue({
      wsStatus: 'connected',
      wsConnected: true,
      sessionManager: {
        getWorkspaceNodeCount: () => 5,
        getSessions: () => [
          { messageCount: 10 },
          { messageCount: 20 }
        ]
      },
      isProcessing: false
    });

    render(<VetoStatusBar />);

    // Check for "Active" status
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Veto')).toBeInTheDocument();

    // Check for message count (10 + 20 = 30)
    expect(screen.getByText('30')).toBeInTheDocument();

    // Check for workspace node count
    expect(screen.getByText('5')).toBeInTheDocument();

    // Check for "Idle" status
    expect(screen.getByText('Idle')).toBeInTheDocument();
  });

  it('renders correctly when disconnected', () => {
    // Mock the context value for disconnected state
    (useVeto as any).mockReturnValue({
      wsStatus: 'disconnected',
      wsConnected: false,
      sessionManager: {
        getWorkspaceNodeCount: () => 0,
        getSessions: () => []
      },
      isProcessing: false
    });

    render(<VetoStatusBar />);

    // Check for "Disconnected" status
    expect(screen.getAllByText('Disconnected')[0]).toBeInTheDocument();
    expect(screen.getByText('Idle')).toBeInTheDocument();
  });

  it('shows processing state correctly', () => {
    // Mock the context value for processing state
    (useVeto as any).mockReturnValue({
      wsStatus: 'connected',
      wsConnected: true,
      sessionManager: {
        getWorkspaceNodeCount: () => 5,
        getSessions: () => []
      },
      isProcessing: true
    });

    render(<VetoStatusBar />);

    // Check for "Processing" status
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });
});
