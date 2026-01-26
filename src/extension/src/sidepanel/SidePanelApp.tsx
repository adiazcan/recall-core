/**
 * Side Panel App Component
 *
 * Handles authentication state management and re-auth prompts.
 */

import type { JSX } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { SidePanel } from './SidePanel';
import { getAuthState, refreshToken } from '../services/messaging';
import type { AuthStateResponse, ExtensionErrorCode } from '../types';

export function SidePanelApp(): JSX.Element {
  const [authState, setAuthState] = useState<AuthStateResponse>({
    isAuthenticated: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string>();
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Check auth state on mount
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const state = await getAuthState();
        if (!cancelled && isMountedRef.current) {
          setAuthState(state);
        }
      } catch (error) {
        console.error('[SidePanel] Failed to get auth state:', error);
        if (!cancelled && isMountedRef.current) {
          setAuthState({ isAuthenticated: false });
        }
      } finally {
        if (!cancelled && isMountedRef.current) {
          setIsLoading(false);
        }
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  // Handle auth required (token expired during session)
  const handleAuthRequired = useCallback(async () => {
    // First, try silent token refresh
    try {
      const state = await refreshToken();
      if (!isMountedRef.current) {
        return;
      }
      setAuthState(state);
      setAuthError(undefined);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }
      // Refresh failed - prompt for re-auth
      console.warn('[SidePanel] Token refresh failed, prompting re-auth:', error);

      const errorCode = (error as { code?: ExtensionErrorCode })?.code;

      // Update state to show sign-in prompt
      setAuthState({ isAuthenticated: false });

      if (errorCode === 'TOKEN_REFRESH_FAILED') {
        setAuthError('Your session has expired. Please sign in again.');
      } else {
        setAuthError('Authentication required. Please sign in.');
      }
    }
  }, []);

  // Handle sign in from SidePanel component
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== 'local' || !changes.auth) {
        return;
      }

      void (async () => {
        try {
          const state = await getAuthState();
          if (!isMountedRef.current) {
            return;
          }
          setAuthState(state);
          if (state.isAuthenticated) {
            setAuthError(undefined);
          }
        } catch {
          // Ignore errors during storage change
        }
      })();
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin dark:border-gray-600 dark:border-t-blue-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  // Auth error banner
  const errorBanner = authError ? (
    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-sm text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
      <span>{authError}</span>
      <button
        type="button"
        className="px-1.5 py-0.5 text-lg leading-none opacity-70 hover:opacity-100"
        onClick={() => setAuthError(undefined)}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  ) : null;

  return (
    <div className="flex flex-col h-full">
      {errorBanner}
      <div className="flex-1 min-h-0">
        <SidePanel authState={authState} onAuthRequired={handleAuthRequired} />
      </div>
    </div>
  );
}
