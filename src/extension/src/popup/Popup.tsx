/**
 * Popup Component
 *
 * Main popup component that orchestrates:
 * - Authentication state check
 * - Sign-in prompt for unauthenticated users
 * - Save current tab functionality
 */

import type { JSX } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { AuthStatus } from './components/AuthStatus';
import { SaveCurrentTab } from './components/SaveCurrentTab';
import { getAuthState, signIn, signOut } from '../services/messaging';
import type { AuthStateResponse, ExtensionErrorCode } from '../types';

type PopupView = 'main' | 'batch-select';

export function Popup(): JSX.Element {
  const [authState, setAuthState] = useState<AuthStateResponse>({
    isAuthenticated: false,
  });
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | undefined>();
  const [_view, _setView] = useState<PopupView>('main');

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

  return (
    <div className="popup">
      {/* Header */}
      <header className="popup__header">
        <div className="popup__logo">
          <img
            src="../assets/icon-32.svg"
            alt="Recall"
            className="popup__logo-img"
          />
          <span className="popup__logo-text">Recall</span>
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
        <div className="popup__error">
          <span>{authError}</span>
          <button
            type="button"
            className="popup__error-dismiss"
            onClick={() => setAuthError(undefined)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Main content - only show when authenticated */}
      {authState.isAuthenticated && (
        <main className="popup__main">
          <SaveCurrentTab
            isAuthenticated={authState.isAuthenticated}
            onSaveSuccess={handleSaveSuccess}
          />
        </main>
      )}

      {/* Footer with shortcuts hint */}
      {authState.isAuthenticated && (
        <footer className="popup__footer">
          <span className="popup__hint">
            Tip: Press <kbd>Alt+Shift+S</kbd> to quick save
          </span>
        </footer>
      )}

      <style>{popupStyles}</style>
    </div>
  );
}

const popupStyles = `
  .popup {
    display: flex;
    flex-direction: column;
    min-height: 200px;
  }

  .popup__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #e5e7eb;
  }

  .popup__logo {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .popup__logo-img {
    width: 24px;
    height: 24px;
  }

  .popup__logo-text {
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
  }

  .popup__error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 16px;
    background-color: #fef2f2;
    border-bottom: 1px solid #fecaca;
    font-size: 13px;
    color: #991b1b;
  }

  .popup__error-dismiss {
    padding: 2px 6px;
    font-size: 18px;
    line-height: 1;
    color: #991b1b;
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0.7;
  }

  .popup__error-dismiss:hover {
    opacity: 1;
  }

  .popup__main {
    flex: 1;
  }

  .popup__footer {
    padding: 10px 16px;
    border-top: 1px solid #e5e7eb;
    background-color: #f9fafb;
  }

  .popup__hint {
    font-size: 12px;
    color: #6b7280;
  }

  .popup__hint kbd {
    padding: 2px 6px;
    font-family: ui-monospace, monospace;
    font-size: 11px;
    background-color: #e5e7eb;
    border-radius: 4px;
    border: 1px solid #d1d5db;
  }

  @media (prefers-color-scheme: dark) {
    .popup__header {
      border-bottom-color: #374151;
    }

    .popup__logo-text {
      color: #f0f0f0;
    }

    .popup__error {
      background-color: #450a0a;
      border-bottom-color: #7f1d1d;
      color: #fecaca;
    }

    .popup__error-dismiss {
      color: #fecaca;
    }

    .popup__footer {
      border-top-color: #374151;
      background-color: #111827;
    }

    .popup__hint {
      color: #9ca3af;
    }

    .popup__hint kbd {
      background-color: #374151;
      border-color: #4b5563;
      color: #d1d5db;
    }
  }
`;
