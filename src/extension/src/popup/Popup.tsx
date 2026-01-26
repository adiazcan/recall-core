/**
 * Popup Component
 *
 * Main popup component that orchestrates:
 * - Authentication state check
 * - Sign-in prompt for unauthenticated users
 * - Save current tab functionality
 * - Open side panel action
 */

import type { JSX } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { AuthStatus } from './components/AuthStatus';
import { SaveCurrentTab } from './components/SaveCurrentTab';
import { SaveSelectedTabs } from './components/SaveSelectedTabs';
import { getAuthState, signIn, signOut, openSidePanel } from '../services/messaging';
import type { AuthStateResponse, ExtensionErrorCode } from '../types';

type PopupView = 'main' | 'batch-select';

export function Popup(): JSX.Element {
  const [authState, setAuthState] = useState<AuthStateResponse>({
    isAuthenticated: false,
  });
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | undefined>();
  const [view, setView] = useState<PopupView>('main');

  // Check auth state on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const state = await getAuthState();
        setAuthState(state);
      } catch (error) {
        console.error('[Popup] Failed to get auth state:', error);
        setAuthState({ isAuthenticated: false });
      } finally {
        setIsLoadingAuth(false);
      }
    }

    checkAuth();
  }, []);

  // Handle sign in
  const handleSignIn = useCallback(async () => {
    setIsSigningIn(true);
    setAuthError(undefined);

    try {
      const state = await signIn();
      setAuthState(state);
    } catch (error) {
      console.error('[Popup] Sign in failed:', error);

      // Check if it's a user cancellation
      const errorCode = (error as { code?: ExtensionErrorCode })?.code;
      if (errorCode === 'AUTH_CANCELLED') {
        // Don't show error for user cancellation
        return;
      }

      const message =
        error instanceof Error ? error.message : 'Sign in failed';
      setAuthError(message);
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      setAuthState({ isAuthenticated: false });
    } catch (error) {
      console.error('[Popup] Sign out failed:', error);
    }
  }, []);

  // Handle save success
  const handleSaveSuccess = useCallback(() => {
    // Could auto-close popup or show additional feedback
    console.log('[Popup] Save successful');
  }, []);

  // Handle open side panel
  const handleOpenSidePanel = useCallback(async () => {
    try {
      // Get current window ID
      const currentWindow = await chrome.windows.getCurrent();
      if (currentWindow.id) {
        await openSidePanel(currentWindow.id);
        // Close popup after opening side panel
        window.close();
      }
    } catch (error) {
      console.error('[Popup] Failed to open side panel:', error);
    }
  }, []);

  // Handle batch select view switch
  const handleOpenBatchSelect = useCallback(() => {
    setView('batch-select');
  }, []);

  // Handle return to main view
  const handleCloseBatchSelect = useCallback(() => {
    setView('main');
  }, []);

  // Render batch-select view
  if (view === 'batch-select' && authState.isAuthenticated) {
    return (
      <div className="flex flex-col min-h-[360px] min-w-[320px]">
        <SaveSelectedTabs
          onCancel={handleCloseBatchSelect}
          onComplete={() => {
            // Could auto-close or stay on summary
            console.log('[Popup] Batch save complete');
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[200px]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <img
            src="../assets/icon-32.svg"
            alt="Recall"
            className="w-6 h-6"
          />
          <span className="text-base font-semibold text-gray-800 dark:text-gray-100">Recall</span>
        </div>
      </header>

      {/* Auth status section */}
      <AuthStatus
        authState={authState}
        isLoading={isLoadingAuth}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        isSigningIn={isSigningIn}
      />

      {/* Auth error */}
      {authError && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-red-50 border-b border-red-200 text-[13px] text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200">
          <span>{authError}</span>
          <button
            type="button"
            className="px-1.5 py-0.5 text-lg leading-none text-red-800 opacity-70 hover:opacity-100 dark:text-red-200"
            onClick={() => setAuthError(undefined)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Main content - only show when authenticated */}
      {authState.isAuthenticated && (
        <main className="flex-1">
          <SaveCurrentTab
            isAuthenticated={authState.isAuthenticated}
            onSaveSuccess={handleSaveSuccess}
            onSignIn={handleSignIn}
          />
          
          {/* Action buttons */}
          <div className="px-4 py-3 border-t border-gray-200 space-y-2 dark:border-gray-700">
            {/* Save selected tabs button */}
            <button
              type="button"
              onClick={handleOpenBatchSelect}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              Save selected tabs
            </button>

            {/* Open Side Panel button */}
            <button
              type="button"
              onClick={handleOpenSidePanel}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h7"
                />
              </svg>
              Open Side Panel
            </button>
          </div>
        </main>
      )}

      {/* Footer with shortcuts hint */}
      {authState.isAuthenticated && (
        <footer className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Tip: Press{' '}
            <kbd className="px-1.5 py-0.5 font-mono text-[11px] bg-gray-200 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300">
              Alt+Shift+S
            </kbd>{' '}
            to quick save
          </span>
        </footer>
      )}
    </div>
  );
}
