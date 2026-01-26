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
      <div className="flex items-center justify-center gap-2 p-5 border-b border-gray-200 dark:border-gray-700">
        <span
          className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin dark:border-gray-600 dark:border-t-blue-400"
          aria-hidden="true"
        />
        <span className="text-sm text-gray-500 dark:text-gray-400">Checking sign-in...</span>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return (
      <div className="flex flex-col items-center gap-3 p-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">
            👋
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">Sign in to save bookmarks</span>
        </div>
        <button
          type="button"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-blue-600 dark:hover:bg-blue-700"
          onClick={onSignIn}
          disabled={isSigningIn}
        >
          {isSigningIn ? 'Signing in...' : 'Sign in'}
        </button>
      </div>
    );
  }

  const displayName = authState.user?.name || authState.user?.email || 'User';

  return (
    <div className="flex items-center justify-between gap-3 p-3 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <span
          className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 text-white text-xs font-semibold shrink-0 dark:bg-blue-600"
          aria-hidden="true"
        >
          {getInitials(displayName)}
        </span>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-gray-800 truncate dark:text-gray-100">
            {displayName}
          </span>
          {authState.user?.email && authState.user.email !== displayName && (
            <span className="text-xs text-gray-500 truncate dark:text-gray-400">
              {authState.user.email}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-transparent border border-gray-300 rounded-md hover:bg-gray-100 hover:text-gray-600 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        onClick={onSignOut}
      >
        Sign out
      </button>
    </div>
  );
}

/**
 * Gets initials from a display name
 */
function getInitials(name: string): string {
  if (!name || !name.trim()) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
