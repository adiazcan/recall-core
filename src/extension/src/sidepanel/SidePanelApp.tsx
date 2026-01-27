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
  const [initError, setInitError] = useState<string>();
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
      console.log('[SidePanelApp] Starting auth check...');
      try {
        console.log('[SidePanelApp] Calling getAuthState()...');
        const state = await getAuthState();
        console.log('[SidePanelApp] Auth state received:', JSON.stringify(state));
        if (!cancelled && isMountedRef.current) {
          setAuthState(state);
          setInitError(undefined);
        }
      } catch (error) {
        console.error('[SidePanelApp] getAuthState() failed:', error);
        if (!cancelled && isMountedRef.current) {
          setAuthState({ isAuthenticated: false });
          // Set error message for display
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          if (errorMessage.includes('timeout') || errorMessage.includes('No response')) {
            setInitError('Unable to connect to extension. Try reloading the extension.');
          } else {
            setInitError(`Connection error: ${errorMessage}`);
          }
        }
      } finally {
        console.log('[SidePanelApp] Auth check finished');
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

  // Initialization error state (service worker not responding)
  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Connection Error
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-xs">
          {initError}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Reload Panel
        </button>
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
