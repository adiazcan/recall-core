import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';
import { loginRequest, msalConfig } from './authConfig';
import { getExtensionToken, isInExtensionFrame } from './extensionAuth';

export const msalInstance = new PublicClientApplication(msalConfig);

export function getActiveAccount(): AccountInfo | null {
  return msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0] ?? null;
}

export async function acquireAccessToken(): Promise<string | null> {
  // If running in extension frame, prefer extension-provided token
  if (isInExtensionFrame()) {
    const extToken = getExtensionToken();
    if (extToken) {
      return extToken;
    }
    // Fall through to MSAL if no extension token available
  }

  const account = getActiveAccount();

  if (!account) {
    return null;
  }

  try {
    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account,
    });

    return response.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      // Don't redirect if in extension frame - extension handles auth
      if (isInExtensionFrame()) {
        return null;
      }
      await msalInstance.acquireTokenRedirect({
        ...loginRequest,
        account,
      });
      return null;
    }

    throw error;
  }
}
