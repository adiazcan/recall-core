import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { useAccount, useIsAuthenticated, useMsal } from '@azure/msal-react';
import { useCallback, useEffect, useRef } from 'react';
import { apiRequest, loginRequest } from '../lib/authConfig';
import { logAuthEvent } from '../lib/telemetry';

export function useAuth() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const activeAccount = instance.getActiveAccount() ?? accounts[0] ?? null;
  const account = useAccount(activeAccount);
  const authStateRef = useRef(isAuthenticated);

  useEffect(() => {
    if (!instance.getActiveAccount() && accounts.length > 0) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [accounts, instance]);

  useEffect(() => {
    if (!authStateRef.current && isAuthenticated) {
      logAuthEvent('sign-in-completed');
    }

    if (authStateRef.current && !isAuthenticated) {
      logAuthEvent('sign-out-completed');
    }

    authStateRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const signIn = useCallback(() => {
    logAuthEvent('sign-in-requested');
    return instance.loginRedirect(loginRequest);
  }, [instance]);

  const signOut = useCallback(() => {
    const tokenAccount = instance.getActiveAccount() ?? accounts[0];
    logAuthEvent('sign-out-requested');

    return instance.logoutRedirect({
      account: tokenAccount ?? undefined,
    });
  }, [accounts, instance]);

  const getAccessToken = useCallback(async () => {
    const tokenAccount = instance.getActiveAccount() ?? accounts[0];

    if (!tokenAccount) {
      throw new Error('No active account');
    }

    try {
      const response = await instance.acquireTokenSilent({
        ...apiRequest,
        account: tokenAccount,
      });

      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        await instance.acquireTokenRedirect({
          ...loginRequest,
          account: tokenAccount,
        });
      }

      throw error;
    }
  }, [accounts, instance]);

  return {
    account,
    isAuthenticated,
    signIn,
    signOut,
    getAccessToken,
  };
}
