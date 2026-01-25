import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { InteractionStatus } from '@azure/msal-browser';
import { AuthGuard } from './AuthGuard';

const useIsAuthenticated = vi.fn();
const useMsal = vi.fn();
const signIn = vi.fn();

vi.mock('@azure/msal-react', () => ({
  useIsAuthenticated: () => useIsAuthenticated(),
  useMsal: () => useMsal(),
  InteractionStatus: {
    None: 'none',
    Login: 'login',
    Logout: 'logout',
    HandleRedirect: 'handleRedirect',
  },
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ signIn: signIn }),
}));

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when authenticated', () => {
    useIsAuthenticated.mockReturnValue(true);
    useMsal.mockReturnValue({ inProgress: InteractionStatus.None });

    render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>,
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('renders sign-in progress message when unauthenticated', () => {
    useIsAuthenticated.mockReturnValue(false);
    useMsal.mockReturnValue({ inProgress: InteractionStatus.None });

    render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>,
    );

    expect(screen.getByText('Signing you in…')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Redirecting to Microsoft sign-in so you can access your saved items and collections.',
      ),
    ).toBeInTheDocument();
  });

  it('automatically initiates sign-in when unauthenticated and no interaction in progress', async () => {
    useIsAuthenticated.mockReturnValue(false);
    useMsal.mockReturnValue({ inProgress: InteractionStatus.None });

    render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>,
    );

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledTimes(1);
    });
  });

  it('does not initiate sign-in when interaction is already in progress', () => {
    useIsAuthenticated.mockReturnValue(false);
    useMsal.mockReturnValue({ inProgress: InteractionStatus.Login });

    render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>,
    );

    expect(signIn).not.toHaveBeenCalled();
  });

  it('does not initiate sign-in multiple times', async () => {
    useIsAuthenticated.mockReturnValue(false);
    useMsal.mockReturnValue({ inProgress: InteractionStatus.None });

    const { rerender } = render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>,
    );

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledTimes(1);
    });

    // Trigger re-render
    rerender(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>,
    );

    // Should still only be called once
    expect(signIn).toHaveBeenCalledTimes(1);
  });
});
