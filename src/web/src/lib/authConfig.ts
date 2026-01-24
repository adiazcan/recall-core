import type { Configuration, RedirectRequest } from '@azure/msal-browser';

const tenantId = import.meta.env.VITE_TENANT_ID;
const clientId = import.meta.env.VITE_CLIENT_ID;
const apiScope = import.meta.env.VITE_API_SCOPE;

if (!tenantId || !clientId || !apiScope) {
  throw new Error(
    'Required environment variables are missing: VITE_TENANT_ID, VITE_CLIENT_ID, VITE_API_SCOPE',
  );
}

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://${tenantId}.ciamlogin.com`,
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
