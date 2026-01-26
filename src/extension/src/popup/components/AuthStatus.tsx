/**
 * AuthStatus Component
 *
 * Displays the current authentication state and provides sign-in/sign-out actions.
 */

import type { JSX } from 'react';
import type { AuthStateResponse } from '../../types';

export interface AuthStatusProps {
  /** Current auth state */
  authState: AuthStateResponse;
  /** Loading state while checking auth */
  isLoading: boolean;
  /** Callback when user clicks sign in */
  onSignIn: () => void;
  /** Callback when user clicks sign out */
  onSignOut: () => void;
  /** Whether sign-in is in progress */
  isSigningIn?: boolean;
}

export function AuthStatus({
  authState,
  isLoading,
  onSignIn,
  onSignOut,
  isSigningIn = false,
}: AuthStatusProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="auth-status auth-status--loading">
        <span className="auth-status__spinner" aria-hidden="true" />
        <span className="auth-status__text">Checking sign-in...</span>
        <style>{authStatusStyles}</style>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return (
      <div className="auth-status auth-status--signed-out">
        <div className="auth-status__message">
          <span className="auth-status__icon" aria-hidden="true">
            👋
          </span>
          <span className="auth-status__text">Sign in to save bookmarks</span>
        </div>
        <button
          type="button"
          className="auth-status__button auth-status__button--primary"
          onClick={onSignIn}
          disabled={isSigningIn}
        >
          {isSigningIn ? 'Signing in...' : 'Sign in'}
        </button>
        <style>{authStatusStyles}</style>
      </div>
    );
  }

  const displayName = authState.user?.name || authState.user?.email || 'User';

  return (
    <div className="auth-status auth-status--signed-in">
      <div className="auth-status__user">
        <span className="auth-status__avatar" aria-hidden="true">
          {getInitials(displayName)}
        </span>
        <div className="auth-status__info">
          <span className="auth-status__name">{displayName}</span>
          {authState.user?.email && authState.user.email !== displayName && (
            <span className="auth-status__email">{authState.user.email}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="auth-status__button auth-status__button--secondary"
        onClick={onSignOut}
      >
        Sign out
      </button>
      <style>{authStatusStyles}</style>
    </div>
  );
}

/**
 * Gets initials from a display name
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

const authStatusStyles = `
  .auth-status {
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
  }

  .auth-status--loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px 12px;
  }

  .auth-status--signed-out {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 12px;
  }

  .auth-status--signed-in {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .auth-status__spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #e0e0e0;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .auth-status__message {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .auth-status__icon {
    font-size: 20px;
  }

  .auth-status__text {
    font-size: 14px;
    color: #6b7280;
  }

  .auth-status__user {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }

  .auth-status__avatar {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background-color: #3b82f6;
    color: white;
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .auth-status__info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .auth-status__name {
    font-size: 14px;
    font-weight: 500;
    color: #1f2937;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .auth-status__email {
    font-size: 12px;
    color: #6b7280;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .auth-status__button {
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .auth-status__button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .auth-status__button--primary {
    background-color: #3b82f6;
    color: white;
    border: none;
  }

  .auth-status__button--primary:hover:not(:disabled) {
    background-color: #2563eb;
  }

  .auth-status__button--secondary {
    background-color: transparent;
    color: #6b7280;
    border: 1px solid #d1d5db;
    padding: 6px 12px;
    font-size: 12px;
  }

  .auth-status__button--secondary:hover {
    background-color: #f3f4f6;
    color: #4b5563;
  }

  @media (prefers-color-scheme: dark) {
    .auth-status {
      border-bottom-color: #374151;
    }

    .auth-status__text {
      color: #9ca3af;
    }

    .auth-status__spinner {
      border-color: #444;
      border-top-color: #60a5fa;
    }

    .auth-status__avatar {
      background-color: #2563eb;
    }

    .auth-status__name {
      color: #f0f0f0;
    }

    .auth-status__email {
      color: #9ca3af;
    }

    .auth-status__button--primary {
      background-color: #2563eb;
    }

    .auth-status__button--primary:hover:not(:disabled) {
      background-color: #1d4ed8;
    }

    .auth-status__button--secondary {
      color: #9ca3af;
      border-color: #4b5563;
    }

    .auth-status__button--secondary:hover {
      background-color: #374151;
      color: #d1d5db;
    }
  }
`;
