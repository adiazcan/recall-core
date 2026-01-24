import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuthErrorHandler } from '../../hooks/useAuthErrorHandler';
import { SignInButton } from './SignInButton';
import { Button } from '../ui/button';

type AuthErrorBoundaryProps = {
  children: ReactNode;
};

export function AuthErrorBoundary({ children }: AuthErrorBoundaryProps) {
  const { authError, clearAuthError } = useAuthErrorHandler();

  if (!authError) {
    return <>{children}</>;
  }

  const isUnauthorized = authError.status === 401;

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-neutral-900">{authError.title}</h1>
        <p className="mt-2 text-sm text-neutral-600">{authError.message}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {isUnauthorized ? <SignInButton className="w-full sm:flex-1" /> : null}
          <Button
            type="button"
            variant="outline"
            className="w-full sm:flex-1"
            onClick={clearAuthError}
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
