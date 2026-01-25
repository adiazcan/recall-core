import type { Configuration, RedirectRequest } from '@azure/msal-browser';

const authority = import.meta.env.VITE_AUTHORITY;
const clientId = import.meta.env.VITE_CLIENT_ID;
const apiScope = import.meta.env.VITE_API_SCOPE;

if (!authority || !clientId || !apiScope) {
  throw new Error(
    'Required environment variables are missing: VITE_AUTHORITY, VITE_CLIENT_ID, VITE_API_SCOPE',
  );
}

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

export const loginRequest: RedirectRequest = {
  scopes: [apiScope],
};
