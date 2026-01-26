/**
 * Authentication Service
 *
 * Handles OAuth 2.0 PKCE authentication flow with Entra External ID
 * using chrome.identity.launchWebAuthFlow.
 *
 * Features:
 * - PKCE code challenge generation
 * - OAuth authorization flow via launchWebAuthFlow
 * - Token exchange for authorization code
 * - Silent token refresh with expiry check
 * - Re-authentication prompt on refresh failure
 */

import {
  config,
  buildAuthorizationUrl,
  getTokenEndpoint,
  isAuthConfigured,
} from '../config';
import {
  getAuth,
  setAuth,
  clearAuth,
  hasValidAuth,
  setSessionData,
  getSessionData,
  clearSessionData,
} from './storage';
import type {
  AuthStateResponse,
  StoredAuth,
  ExtensionErrorCode,
} from '../types';

/** Session storage key for PKCE code verifier */
const CODE_VERIFIER_KEY = 'pkce_code_verifier';

/** Session storage key for OAuth state */
const OAUTH_STATE_KEY = 'oauth_state';

/** Buffer time before token expiry to trigger refresh (5 minutes) */
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

// =============================================================================
// PKCE Utilities
// =============================================================================

/**
 * Generates a cryptographically random code verifier for PKCE
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generates a code challenge from a code verifier using SHA-256
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Base64 URL encode (RFC 4648)
 */
function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (const byte of buffer) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generates a random state parameter
 */
function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

// =============================================================================
// Token Parsing
// =============================================================================

/**
 * Decodes a JWT token and extracts claims (without verification)
 */
function decodeJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Extracts user info from ID token claims
 */
function extractUserFromIdToken(
  idToken: string
): StoredAuth['user'] | undefined {
  const claims = decodeJwtClaims(idToken);
  if (!claims) return undefined;

  return {
    sub: (claims.sub as string) ?? '',
    name: (claims.name as string) ?? undefined,
    email: (claims.email as string) ?? undefined,
  };
}

// =============================================================================
// Authentication Flow
// =============================================================================

/**
 * Initiates the OAuth sign-in flow using chrome.identity.launchWebAuthFlow
 *
 * @throws AuthError if authentication fails or is cancelled
 */
export async function signIn(): Promise<StoredAuth> {
  if (!isAuthConfigured()) {
    throw new AuthError(
      'AUTH_FAILED',
      'Authentication is not configured. Check environment variables.'
    );
  }

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();

  // Store PKCE parameters in session storage
  await setSessionData(CODE_VERIFIER_KEY, codeVerifier);
  await setSessionData(OAUTH_STATE_KEY, state);

  // Build authorization URL
  const authUrl = buildAuthorizationUrl(codeChallenge, state);

  try {
    // Launch the auth flow
    const redirectUrl = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl,
          interactive: true,
        },
        (responseUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!responseUrl) {
            reject(new Error('No response URL received'));
            return;
          }
          resolve(responseUrl);
        }
      );
    });

    // Parse the redirect URL
    const url = new URL(redirectUrl);
    const error = url.searchParams.get('error');

    if (error) {
      const errorDescription = url.searchParams.get('error_description');
      await clearPkceData();

      if (error === 'access_denied' || error === 'user_cancelled') {
        throw new AuthError('AUTH_CANCELLED', errorDescription ?? 'User cancelled authentication');
      }
      throw new AuthError('AUTH_FAILED', errorDescription ?? error);
    }

    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');

    // Validate state parameter
    const storedState = await getSessionData<string>(OAUTH_STATE_KEY);
    if (returnedState !== storedState) {
      await clearPkceData();
      throw new AuthError('AUTH_FAILED', 'State parameter mismatch - possible CSRF attack');
    }

    if (!code) {
      await clearPkceData();
      throw new AuthError('AUTH_FAILED', 'No authorization code received');
    }

    // Exchange authorization code for tokens
    const auth = await exchangeCodeForTokens(code, codeVerifier);

    // Clear PKCE data
    await clearPkceData();

    // Store authentication data
    await setAuth(auth);

    return auth;
  } catch (error) {
    await clearPkceData();

    if (error instanceof AuthError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Authentication failed';

    if (message.includes('canceled') || message.includes('cancelled') || message.includes('closed')) {
      throw new AuthError('AUTH_CANCELLED', 'Sign-in was cancelled');
    }

    throw new AuthError('AUTH_FAILED', message);
  }
}

/**
 * Exchanges authorization code for access and refresh tokens
 */
async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<StoredAuth> {
  const tokenEndpoint = getTokenEndpoint();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.entraRedirectUrl,
    client_id: config.entraClientId,
    code_verifier: codeVerifier,
    scope: `openid profile email offline_access ${config.apiScope}`,
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage =
      (errorData as { error_description?: string }).error_description ??
      (errorData as { error?: string }).error ??
      `Token exchange failed: ${response.status}`;
    throw new AuthError('AUTH_FAILED', errorMessage);
  }

  const data = (await response.json()) as TokenResponse;

  const expiresAt = Date.now() + data.expires_in * 1000;
  const user = data.id_token ? extractUserFromIdToken(data.id_token) : undefined;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    idToken: data.id_token,
    user,
  };
}

/**
 * Refreshes the access token using the refresh token
 *
 * @throws AuthError if refresh fails
 */
export async function refreshAccessToken(): Promise<StoredAuth> {
  const auth = await getAuth();

  if (!auth?.refreshToken) {
    throw new AuthError('TOKEN_REFRESH_FAILED', 'No refresh token available');
  }

  const tokenEndpoint = getTokenEndpoint();

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: auth.refreshToken,
    client_id: config.entraClientId,
    scope: `openid profile email offline_access ${config.apiScope}`,
  });

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        (errorData as { error_description?: string }).error_description ??
        (errorData as { error?: string }).error ??
        `Token refresh failed: ${response.status}`;

      // If refresh token is invalid/expired, clear auth and require re-sign-in
      if (response.status === 400 || response.status === 401) {
        await clearAuth();
        throw new AuthError('TOKEN_REFRESH_FAILED', 'Session expired. Please sign in again.');
      }

      throw new AuthError('TOKEN_REFRESH_FAILED', errorMessage);
    }

    const data = (await response.json()) as TokenResponse;

    const expiresAt = Date.now() + data.expires_in * 1000;
    const user = data.id_token
      ? extractUserFromIdToken(data.id_token)
      : auth.user;

    const updatedAuth: StoredAuth = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? auth.refreshToken,
      expiresAt,
      idToken: data.id_token ?? auth.idToken,
      user,
    };

    await setAuth(updatedAuth);

    return updatedAuth;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Token refresh failed';
    throw new AuthError('TOKEN_REFRESH_FAILED', message);
  }
}

/**
 * Signs out and clears all authentication data
 */
export async function signOut(): Promise<void> {
  await clearAuth();
  await clearPkceData();
}

/**
 * Gets valid access token, refreshing if necessary
 *
 * This is the primary method for getting a token for API calls.
 * It handles silent refresh automatically.
 *
 * @throws AuthError if no valid token and refresh fails
 */
export async function getValidAccessToken(): Promise<string> {
  // Check if we have a valid token
  if (await hasValidAuth(TOKEN_EXPIRY_BUFFER_MS)) {
    const auth = await getAuth();
    if (auth?.accessToken) {
      return auth.accessToken;
    }
  }

  // Try to refresh
  const auth = await getAuth();
  if (auth?.refreshToken) {
    const refreshed = await refreshAccessToken();
    return refreshed.accessToken;
  }

  throw new AuthError('AUTH_REQUIRED', 'Please sign in to continue');
}

/**
 * Gets the current authentication state
 */
export async function getAuthState(): Promise<AuthStateResponse> {
  const auth = await getAuth();

  if (!auth?.accessToken) {
    return { isAuthenticated: false };
  }

  const isValid = await hasValidAuth(TOKEN_EXPIRY_BUFFER_MS);

  return {
    isAuthenticated: isValid,
    user: auth.user,
    expiresAt: auth.expiresAt,
  };
}

/**
 * Checks if user is currently authenticated with valid token
 */
export async function isAuthenticated(): Promise<boolean> {
  return hasValidAuth(TOKEN_EXPIRY_BUFFER_MS);
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Clears PKCE-related session data
 */
async function clearPkceData(): Promise<void> {
  await clearSessionData(CODE_VERIFIER_KEY);
  await clearSessionData(OAUTH_STATE_KEY);
}

/**
 * Token response from Entra ID token endpoint
 */
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

/**
 * Authentication error class
 */
export class AuthError extends Error {
  public readonly code: ExtensionErrorCode;

  constructor(code: ExtensionErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/**
 * Auth service object for dependency injection
 */
export const auth = {
  signIn,
  signOut,
  refreshAccessToken,
  getValidAccessToken,
  getAuthState,
  isAuthenticated,
};
