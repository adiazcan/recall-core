/**
 * Side Panel Entry Point
 *
 * React mount point for the extension side panel.
 * Manages authentication state and token communication with the embedded web app.
 */

import type { JSX } from 'react';
import { StrictMode, useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { SidePanel } from './SidePanel';
import { getAuthState, refreshToken } from '../services/messaging';
import type { AuthStateResponse, ExtensionErrorCode } from '../types';

/**
 * Side Panel App Component
 *
 * Handles authentication state management and re-auth prompts.
 */
function SidePanelApp(): JSX.Element {
  const [authState, setAuthState] = useState<AuthStateResponse>({
    isAuthenticated: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string>();

  // Check auth state on mount
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const state = await getAuthState();
        if (!cancelled) {
          setAuthState(state);
        }
      } catch (error) {
        console.error('[SidePanel] Failed to get auth state:', error);
        if (!cancelled) {
          setAuthState({ isAuthenticated: false });
        }
      } finally {
        if (!cancelled) {
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
      setAuthState(state);
      setAuthError(undefined);
    } catch (error) {
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
    // Listen for auth state changes from service worker
    const handleStorageChange = async () => {
      try {
        const state = await getAuthState();
        setAuthState(state);
        if (state.isAuthenticated) {
          setAuthError(undefined);
        }
      } catch {
        // Ignore errors during storage change
      }
    };

    // Poll for auth changes (simple approach for extension context)
    const intervalId = setInterval(handleStorageChange, 2000);

    return () => {
      clearInterval(intervalId);
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
        <SidePanel
          authState={authState}
          onAuthRequired={handleAuthRequired}
        />
      </div>
    </div>
  );
}

// Mount the React app
const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);

root.render(
  <StrictMode>
    <SidePanelApp />
  </StrictMode>
);
