import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HITLApprovalCard from './HITLApprovalCard';

describe('HITLApprovalCard', () => {
  const defaultProps = {
    title: 'Test Approval',
    description: 'Test Description',
    payload: '{"key": "value"}',
    riskLevel: 'medium' as const,
    onApprove: vi.fn(),
    onReject: vi.fn(),
  };

  it('renders title and description', () => {
    render(<HITLApprovalCard {...defaultProps} />);
    expect(screen.getByText('Test Approval')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('renders payload correctly when expanded', () => {
    render(<HITLApprovalCard {...defaultProps} />);
    
    // Payload should be hidden by default
    expect(screen.queryByText(/"key": "value"/)).not.toBeInTheDocument();
    
    // Click show button
    const showButton = screen.getByText(/Show sanitized payload/);
    fireEvent.click(showButton);
    
    expect(screen.getByText(/"key"/)).toBeInTheDocument();
    expect(screen.getByText(/"value"/)).toBeInTheDocument();
  });

  it('calls onApprove when approve button is clicked', () => {
    render(<HITLApprovalCard {...defaultProps} />);
    const approveButton = screen.getByText('Approve & Send');
    fireEvent.click(approveButton);
    expect(defaultProps.onApprove).toHaveBeenCalled();
  });

  it('calls onReject when reject button is clicked', () => {
    render(<HITLApprovalCard {...defaultProps} />);
    const rejectButton = screen.getByText('Reject');
    fireEvent.click(rejectButton);
    expect(defaultProps.onReject).toHaveBeenCalled();
  });

  it('displays correct risk level badge', () => {
    const { rerender } = render(<HITLApprovalCard {...defaultProps} riskLevel="critical" />);
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();

    rerender(<HITLApprovalCard {...defaultProps} riskLevel="low" />);
    expect(screen.getByText('LOW')).toBeInTheDocument();
  });
});
