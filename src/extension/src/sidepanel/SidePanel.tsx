/**
 * SidePanel Component
 *
 * Embeds the Recall web app in a responsive iframe with SSO support.
 *
 * Features:
 * - Responsive iframe embedding
 * - PostMessage token sharing for SSO (RECALL_EXT_AUTH)
 * - Token request handling (RECALL_REQUEST_TOKEN)
 * - Load failure handling with retry and fallback
 * - Unauthenticated state guidance
 */

import type { JSX } from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { config, getAllowedWebAppOrigin } from '../config';
import { getAuth, hasValidAuth } from '../services/storage';
import { signIn } from '../services/messaging';
import type { AuthStateResponse, ExtAuthTokenMessage, RequestTokenMessage, ExtSignOutMessage } from '../types';

/** Time in ms to wait for iframe load before showing error */
const LOAD_TIMEOUT_MS = 15000;

/** Buffer time before token expiry to trigger re-auth prompt (5 minutes) */
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

type LoadState = 'loading' | 'loaded' | 'error';

interface SidePanelProps {
  authState: AuthStateResponse;
  onAuthRequired: () => void;
}

export function SidePanel({ authState, onAuthRequired }: SidePanelProps): JSX.Element {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadTimeoutRef = useRef<number | undefined>(undefined);
  const tokenSentRef = useRef(false);

  const webAppOrigin = getAllowedWebAppOrigin();

  /**
   * Sends auth token to the web app via postMessage
   */
  const sendTokenToWebApp = useCallback(async () => {
    if (!iframeRef.current?.contentWindow) {
      return;
    }

    const auth = await getAuth();
    if (!auth?.accessToken || !auth.expiresAt) {
      return;
    }

    const message: ExtAuthTokenMessage = {
      type: 'RECALL_EXT_AUTH',
      accessToken: auth.accessToken,
      expiresAt: auth.expiresAt,
    };

    iframeRef.current.contentWindow.postMessage(message, webAppOrigin);
    tokenSentRef.current = true;
  }, [webAppOrigin]);

  /**
   * Sends sign-out notification to the web app
   */
  const sendSignOutToWebApp = useCallback(() => {
    if (!iframeRef.current?.contentWindow) {
      return;
    }

    const message: ExtSignOutMessage = {
      type: 'RECALL_EXT_SIGN_OUT',
    };

    iframeRef.current.contentWindow.postMessage(message, webAppOrigin);
  }, [webAppOrigin]);

  /**
   * Handles messages from the web app
   */
  const handleWebAppMessage = useCallback(
    async (event: MessageEvent) => {
      // Validate origin
      if (event.origin !== webAppOrigin) {
        return;
      }

      const message = event.data as RequestTokenMessage | undefined;
      if (!message || typeof message !== 'object') {
        return;
      }

      if (message.type === 'RECALL_REQUEST_TOKEN') {
        // Check if we still have a valid token
        const isValid = await hasValidAuth(TOKEN_EXPIRY_BUFFER_MS);
        
        if (!isValid) {
          // Token expired - notify parent to prompt re-auth
          onAuthRequired();
          return;
        }

        // Send token to web app
        await sendTokenToWebApp();
      }
    },
    [webAppOrigin, sendTokenToWebApp, onAuthRequired]
  );

  // Setup message listener for web app communication
  useEffect(() => {
    window.addEventListener('message', handleWebAppMessage);
    return () => {
      window.removeEventListener('message', handleWebAppMessage);
    };
  }, [handleWebAppMessage]);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    // Clear timeout
    if (loadTimeoutRef.current) {
      window.clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = undefined;
    }

    setLoadState('loaded');
    setErrorMessage(undefined);

    // Send token to web app immediately after load
    if (authState.isAuthenticated && !tokenSentRef.current) {
      sendTokenToWebApp();
    }
  }, [authState.isAuthenticated, sendTokenToWebApp]);

  // Handle iframe error
  const handleIframeError = useCallback(() => {
    if (loadTimeoutRef.current) {
      window.clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = undefined;
    }

    setLoadState('error');
    setErrorMessage('Failed to load Recall. The web app may be unavailable.');
  }, []);

  // Setup load timeout
  useEffect(() => {
    if (authState.isAuthenticated && loadState === 'loading') {
      loadTimeoutRef.current = window.setTimeout(() => {
        setLoadState('error');
        setErrorMessage('Connection timed out. The web app may be unavailable.');
      }, LOAD_TIMEOUT_MS);
    }

    return () => {
      if (loadTimeoutRef.current) {
        window.clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [authState.isAuthenticated, loadState]);

  // Reset token sent flag when auth state changes
  useEffect(() => {
    if (!authState.isAuthenticated) {
      tokenSentRef.current = false;
      // Notify web app of sign out
      sendSignOutToWebApp();
    }
  }, [authState.isAuthenticated, sendSignOutToWebApp]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setLoadState('loading');
    setErrorMessage(undefined);
    tokenSentRef.current = false;

    // Force iframe reload
    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = '';
      iframeRef.current.src = currentSrc;
    }
  }, []);

  // Handle open in new tab
  const handleOpenInNewTab = useCallback(() => {
    chrome.tabs.create({ url: config.webAppUrl });
  }, []);

  // Handle sign in
  const handleSignIn = useCallback(async () => {
    setIsSigningIn(true);
    try {
      await signIn();
      // Auth state will be updated via parent component
    } catch {
      // Error handled in parent
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  // Unauthenticated state
  if (!authState.isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="text-5xl mb-4">🔐</div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Sign in Required
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-xs">
          Sign in to your Recall account to browse your saved items in the side panel.
        </p>
        <button
          type="button"
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {isSigningIn ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Signing in...
            </span>
          ) : (
            'Sign in to Recall'
          )}
        </button>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
          Or{' '}
          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            open Recall in a new tab
          </button>
        </p>
      </div>
    );
  }

  // Error state
  if (loadState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Connection Error
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-xs">
          {errorMessage}
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleRetry}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            Open in New Tab
          </button>
        </div>
      </div>
    );
  }

  // Main iframe view
  return (
    <div className="relative w-full h-full">
      {/* Loading overlay */}
      {loadState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin dark:border-gray-600 dark:border-t-blue-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Loading Recall...</span>
          </div>
        </div>
      )}

      {/* Iframe */}
      <iframe
        ref={iframeRef}
        src={config.webAppUrl}
        title="Recall Web App"
        className="w-full h-full border-0"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
