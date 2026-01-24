import { useCallback, useEffect, useState } from 'react';
import { setAuthErrorHandler, type AuthErrorStatus } from '../lib/api/client';

export type AuthError = {
  status: AuthErrorStatus;
  title: string;
  message: string;
};

const AUTH_ERROR_MAP: Record<AuthErrorStatus, { title: string; message: string }> = {
  401: {
    title: 'Sign in required',
    message: 'Your session has expired. Please sign in again to continue.',
  },
  403: {
    title: 'Permission required',
    message: 'You do not have permission to perform this action. Please request access.',
  },
};

export function useAuthErrorHandler() {
  const [authError, setAuthError] = useState<AuthError | null>(null);

  const handleAuthError = useCallback((status: AuthErrorStatus) => {
    const config = AUTH_ERROR_MAP[status];
    setAuthError({ status, title: config.title, message: config.message });
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  useEffect(() => {
    setAuthErrorHandler(handleAuthError);
    return () => {
      setAuthErrorHandler(null);
    };
  }, [handleAuthError]);

  return {
    authError,
    clearAuthError,
  };
}
