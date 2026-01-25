import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { InteractionStatus } from '@azure/msal-browser';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { useAuth } from '../../hooks/useAuth';

type AuthGuardProps = {
  children: ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const isAuthenticated = useIsAuthenticated();
  const { inProgress } = useMsal();
  const { signIn } = useAuth();
  const hasInitiatedSignIn = useRef(false);

  useEffect(() => {
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
  }, [inProgress, isAuthenticated, signIn]);

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
