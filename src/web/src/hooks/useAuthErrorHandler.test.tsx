import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthErrorHandler } from './useAuthErrorHandler';

let handler: ((status: 401 | 403) => void) | null = null;

vi.mock('../lib/api/client', () => ({
  setAuthErrorHandler: (next: ((status: 401 | 403) => void) | null) => {
    handler = next;
  },
}));

function TestHarness() {
  const { authError, clearAuthError } = useAuthErrorHandler();

  return (
    <div>
      <span data-testid="status">{authError?.status ?? 'none'}</span>
      <span data-testid="message">{authError?.message ?? 'none'}</span>
      <button type="button" onClick={clearAuthError}>
        Clear
      </button>
    </div>
  );
}

describe('useAuthErrorHandler', () => {
  beforeEach(() => {
    handler = null;
  });

  it('sets unauthorized error state for 401 responses', () => {
    render(<TestHarness />);

    act(() => {
      handler?.(401);
    });

    expect(screen.getByTestId('status')).toHaveTextContent('401');
    expect(screen.getByTestId('message')).toHaveTextContent('sign in again');
  });

  it('sets forbidden error state for 403 responses', () => {
    render(<TestHarness />);

    act(() => {
      handler?.(403);
    });

    expect(screen.getByTestId('status')).toHaveTextContent('403');
    expect(screen.getByTestId('message')).toHaveTextContent('permission');
  });

  it('clears error state on reset', () => {
    render(<TestHarness />);

    act(() => {
      handler?.(401);
    });

    fireEvent.click(screen.getByRole('button', { name: /clear/i }));

    expect(screen.getByTestId('status')).toHaveTextContent('none');
  });
});
