import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { InteractionStatus } from '@azure/msal-browser';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { useAuth } from '../../hooks/useAuth';
import {
  isInExtensionFrame,
  hasValidExtensionToken,
  onExtensionTokenChange,
} from '../../lib/extensionAuth';

type AuthGuardProps = {
  children: ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const isAuthenticated = useIsAuthenticated();
  const { inProgress } = useMsal();
  const { signIn } = useAuth();
  const hasInitiatedSignIn = useRef(false);
  const [hasExtensionToken, setHasExtensionToken] = useState(() => hasValidExtensionToken());
  const inExtensionFrame = isInExtensionFrame();

  // Listen for extension token changes
  useEffect(() => {
    if (!inExtensionFrame) {
      return;
    }
    
    // Check current state in case token arrived before listener was set up
    const currentHasToken = hasValidExtensionToken();
    if (currentHasToken) {
      setHasExtensionToken(true);
    }

    const unsubscribe = onExtensionTokenChange((hasToken) => {
      setHasExtensionToken(hasToken);
    });

    // Check once after a short delay in case token arrives during initialization
    const checkTimeout = setTimeout(() => {
      const nowHasToken = hasValidExtensionToken();
      if (nowHasToken) {
        setHasExtensionToken(true);
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearTimeout(checkTimeout);
    };
  }, [inExtensionFrame]);

  useEffect(() => {
    // If in extension frame, don't auto-redirect to MSAL sign-in
    // Wait for extension to provide token
    if (inExtensionFrame) {
      return;
    }

    if (isAuthenticated) {
      return;
    }

    if (inProgress !== InteractionStatus.None) {
      return;
    }

    if (hasInitiatedSignIn.current) {
      return;
    }

    hasInitiatedSignIn.current = true;
    void signIn();
  }, [inProgress, isAuthenticated, signIn, inExtensionFrame]);

  // In extension frame, check extension token
  if (inExtensionFrame) {
    if (hasExtensionToken) {
      return <>{children}</>;
    }

    // Waiting for extension to provide token
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
        <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-neutral-900">Waiting for authentication…</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Please sign in through the extension popup if prompted.
          </p>
        </div>
      </div>
    );
  }

  // Standard MSAL authentication flow
  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-neutral-900">Signing you in…</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Redirecting to Microsoft sign-in so you can access your saved items and collections.
        </p>
      </div>
    </div>
  );
}
