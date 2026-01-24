import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthGuard } from './AuthGuard';

const useIsAuthenticated = vi.fn();

vi.mock('@azure/msal-react', () => ({
  useIsAuthenticated: () => useIsAuthenticated(),
}));

vi.mock('./SignInButton', () => ({
  SignInButton: () => <button>Sign in</button>,
}));

describe('AuthGuard', () => {
  it('renders children when authenticated', () => {
    useIsAuthenticated.mockReturnValue(true);

    render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>,
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('renders sign-in prompt when unauthenticated', () => {
    useIsAuthenticated.mockReturnValue(false);

    render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>,
    );

    expect(screen.getByText('Sign in to continue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
});
