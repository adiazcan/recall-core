/**
 * Auth Service Unit Tests
 *
 * Tests for OAuth 2.0 PKCE authentication flow with Entra External ID.
 * Uses mocked chrome.identity APIs from tests/setup.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mocks, resetAllMocks, setupStorage } from '../setup';
import type { StoredAuth } from '../../src/types';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock crypto.subtle for PKCE
const mockSubtle = {
  digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
};
vi.stubGlobal('crypto', {
  getRandomValues: vi.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
  subtle: mockSubtle,
});

// Mock the config module to simulate auth being configured
vi.mock('../../src/config', () => ({
  config: {
    apiBaseUrl: 'http://localhost:5080/api/v1/',
    webAppUrl: 'http://localhost:5173',
    entraAuthority: 'https://test-tenant.ciamlogin.com/test-tenant-id',
    entraClientId: 'test-client-id',
    entraRedirectUrl: 'https://mock-extension-id.chromiumapp.org/oauth2',
    apiScope: 'api://test-api-id/access_as_user',
    isDevelopment: true,
  },
  isAuthConfigured: () => true,
  buildAuthorizationUrl: (codeChallenge: string, state: string) => {
    const params = new URLSearchParams({
      client_id: 'test-client-id',
      response_type: 'code',
      redirect_uri: 'https://mock-extension-id.chromiumapp.org/oauth2',
      scope: 'openid profile email offline_access api://test-api-id/access_as_user',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      response_mode: 'query',
    });
    return `https://test-tenant.ciamlogin.com/test-tenant-id/oauth2/v2.0/authorize?${params.toString()}`;
  },
  getTokenEndpoint: () => 'https://test-tenant.ciamlogin.com/test-tenant-id/oauth2/v2.0/token',
}));

// Import auth module after mocking config
import {
  signIn,
  signOut,
  refreshAccessToken,
  getValidAccessToken,
  getAuthState,
  isAuthenticated,
  AuthError,
} from '../../src/services/auth';

describe('Auth Service', () => {
  beforeEach(() => {
    resetAllMocks();
    mockFetch.mockReset();
  });

  // Create a valid auth token response
  const createTokenResponse = (overrides: Partial<TokenResponse> = {}) => ({
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    id_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyIsIm5hbWUiOiJUZXN0IFVzZXIiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.signature',
    expires_in: 3600,
    token_type: 'Bearer',
    ...overrides,
  });

  // Create stored auth data
  const createStoredAuth = (overrides: Partial<StoredAuth> = {}): StoredAuth => ({
    accessToken: 'stored-access-token',
    refreshToken: 'stored-refresh-token',
    expiresAt: Date.now() + 3600 * 1000,
    idToken: 'stored-id-token',
    user: {
      sub: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
    },
    ...overrides,
  });

  interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    expires_in: number;
    token_type: string;
  }

  // ===========================================================================
  // Sign In
  // ===========================================================================

  describe('signIn', () => {
    it('completes OAuth flow and returns auth data', async () => {
      // Mock launchWebAuthFlow to return redirect URL with code
      mocks.identity.launchWebAuthFlow.mockImplementation(
        (options: { url: string; interactive: boolean }, callback: (url?: string) => void) => {
          // Extract state from the auth URL
          const authUrl = new URL(options.url);
          const state = authUrl.searchParams.get('state');

          // Simulate successful auth redirect
          callback(`https://mock-extension-id.chromiumapp.org/oauth2?code=test-auth-code&state=${state}`);
        }
      );

      // Mock token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createTokenResponse(),
      });

      const result = await signIn();

      expect(result).toMatchObject({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(mocks.storage.local.set).toHaveBeenCalled();
    });

    it('throws AUTH_CANCELLED when user cancels', async () => {
      mocks.identity.launchWebAuthFlow.mockImplementation(
        (_options: unknown, callback: (url?: string) => void) => {
          // Simulate runtime error from user cancel
          (chrome.runtime as { lastError?: { message: string } }).lastError = { message: 'The user cancelled the request' };
          callback(undefined);
          (chrome.runtime as { lastError?: { message: string } }).lastError = undefined;
        }
      );

      await expect(signIn()).rejects.toThrow(AuthError);
      await expect(signIn()).rejects.toMatchObject({
        code: 'AUTH_CANCELLED',
      });
    });

    it('throws AUTH_FAILED when OAuth returns error', async () => {
      mocks.identity.launchWebAuthFlow.mockImplementation(
        (_options: unknown, callback: (url?: string) => void) => {
          callback('https://mock-extension-id.chromiumapp.org/oauth2?error=access_denied&error_description=User%20denied');
        }
      );

      await expect(signIn()).rejects.toThrow(AuthError);
      await expect(signIn()).rejects.toMatchObject({
        code: 'AUTH_CANCELLED',
      });
    });

    it('throws AUTH_FAILED on state mismatch', async () => {
      mocks.identity.launchWebAuthFlow.mockImplementation(
        (_options: unknown, callback: (url?: string) => void) => {
          // Return a different state than what was sent
          callback('https://mock-extension-id.chromiumapp.org/oauth2?code=test-code&state=wrong-state');
        }
      );

      await expect(signIn()).rejects.toThrow(AuthError);
      await expect(signIn()).rejects.toMatchObject({
        code: 'AUTH_FAILED',
        message: expect.stringContaining('State parameter mismatch'),
      });
    });

    it('throws AUTH_FAILED when token exchange fails', async () => {
      mocks.identity.launchWebAuthFlow.mockImplementation(
        (options: { url: string }, callback: (url?: string) => void) => {
          const authUrl = new URL(options.url);
          const state = authUrl.searchParams.get('state');
          callback(`https://mock-extension-id.chromiumapp.org/oauth2?code=test-code&state=${state}`);
        }
      );

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_grant', error_description: 'Code expired' }),
      });

      await expect(signIn()).rejects.toThrow(AuthError);
      await expect(signIn()).rejects.toMatchObject({
        code: 'AUTH_FAILED',
      });
    });

    it('clears PKCE data on failure', async () => {
      mocks.identity.launchWebAuthFlow.mockImplementation(
        (_options: unknown, callback: (url?: string) => void) => {
          callback('https://mock-extension-id.chromiumapp.org/oauth2?error=server_error');
        }
      );

      await expect(signIn()).rejects.toThrow();

      // PKCE session data should be cleared
      expect(mocks.storage.session.remove).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Sign Out
  // ===========================================================================

  describe('signOut', () => {
    it('clears auth data from storage', async () => {
      setupStorage('local', { auth: createStoredAuth() });

      await signOut();

      expect(mocks.storage.local.remove).toHaveBeenCalledWith('auth');
    });

    it('clears PKCE session data', async () => {
      await signOut();

      expect(mocks.storage.session.remove).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Token Refresh
  // ===========================================================================

  describe('refreshAccessToken', () => {
    it('refreshes token using refresh token', async () => {
      setupStorage('local', { auth: createStoredAuth() });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createTokenResponse({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
        }),
      });

      const result = await refreshAccessToken();

      expect(result.accessToken).toBe('new-access-token');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('token'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('grant_type=refresh_token'),
        })
      );
    });

    it('throws TOKEN_REFRESH_FAILED when no refresh token', async () => {
      setupStorage('local', {
        auth: createStoredAuth({ refreshToken: undefined }),
      });

      await expect(refreshAccessToken()).rejects.toThrow(AuthError);
      await expect(refreshAccessToken()).rejects.toMatchObject({
        code: 'TOKEN_REFRESH_FAILED',
      });
    });

    it('clears auth and throws on 401 response', async () => {
      setupStorage('local', { auth: createStoredAuth() });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'invalid_grant' }),
      });

      await expect(refreshAccessToken()).rejects.toThrow(AuthError);
      expect(mocks.storage.local.remove).toHaveBeenCalledWith('auth');
    });

    it('preserves existing refresh token if not returned', async () => {
      const existingAuth = createStoredAuth();
      setupStorage('local', { auth: existingAuth });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          expires_in: 3600,
          token_type: 'Bearer',
          // No refresh_token in response
        }),
      });

      const result = await refreshAccessToken();

      expect(result.refreshToken).toBe(existingAuth.refreshToken);
    });
  });

  // ===========================================================================
  // Get Valid Access Token
  // ===========================================================================

  describe('getValidAccessToken', () => {
    it('returns existing token if valid', async () => {
      setupStorage('local', { auth: createStoredAuth() });

      const token = await getValidAccessToken();

      expect(token).toBe('stored-access-token');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('refreshes token if expired', async () => {
      setupStorage('local', {
        auth: createStoredAuth({
          expiresAt: Date.now() - 1000, // Expired
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createTokenResponse({ access_token: 'refreshed-token' }),
      });

      const token = await getValidAccessToken();

      expect(token).toBe('refreshed-token');
    });

    it('refreshes token if expiring within buffer', async () => {
      setupStorage('local', {
        auth: createStoredAuth({
          expiresAt: Date.now() + 60 * 1000, // 1 minute (within 5 min buffer)
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createTokenResponse({ access_token: 'refreshed-token' }),
      });

      const token = await getValidAccessToken();

      expect(token).toBe('refreshed-token');
    });

    it('throws AUTH_REQUIRED when no auth and no refresh token', async () => {
      // No auth stored
      await expect(getValidAccessToken()).rejects.toThrow(AuthError);
      await expect(getValidAccessToken()).rejects.toMatchObject({
        code: 'AUTH_REQUIRED',
      });
    });
  });

  // ===========================================================================
  // Get Auth State
  // ===========================================================================

  describe('getAuthState', () => {
    it('returns not authenticated when no auth stored', async () => {
      const state = await getAuthState();

      expect(state).toEqual({ isAuthenticated: false });
    });

    it('returns not authenticated when token expired', async () => {
      setupStorage('local', {
        auth: createStoredAuth({
          expiresAt: Date.now() - 1000,
        }),
      });

      const state = await getAuthState();

      expect(state.isAuthenticated).toBe(false);
    });

    it('returns authenticated with user info when valid', async () => {
      const storedAuth = createStoredAuth();
      setupStorage('local', { auth: storedAuth });

      const state = await getAuthState();

      expect(state).toEqual({
        isAuthenticated: true,
        user: storedAuth.user,
        expiresAt: storedAuth.expiresAt,
      });
    });
  });

  // ===========================================================================
  // Is Authenticated
  // ===========================================================================

  describe('isAuthenticated', () => {
    it('returns false when no auth stored', async () => {
      const result = await isAuthenticated();
      expect(result).toBe(false);
    });

    it('returns false when token expired', async () => {
      setupStorage('local', {
        auth: createStoredAuth({
          expiresAt: Date.now() - 1000,
        }),
      });

      const result = await isAuthenticated();
      expect(result).toBe(false);
    });

    it('returns true when token is valid', async () => {
      setupStorage('local', { auth: createStoredAuth() });

      const result = await isAuthenticated();
      expect(result).toBe(true);
    });
  });

  // ===========================================================================
  // AuthError Class
  // ===========================================================================

  describe('AuthError', () => {
    it('has correct name, code, and message', () => {
      const error = new AuthError('AUTH_FAILED', 'Test error message');

      expect(error.name).toBe('AuthError');
      expect(error.code).toBe('AUTH_FAILED');
      expect(error.message).toBe('Test error message');
      expect(error).toBeInstanceOf(Error);
    });

    it('supports all error codes', () => {
      const codes = [
        'AUTH_REQUIRED',
        'AUTH_FAILED',
        'AUTH_CANCELLED',
        'TOKEN_REFRESH_FAILED',
      ] as const;

      for (const code of codes) {
        const error = new AuthError(code, 'Test');
        expect(error.code).toBe(code);
      }
    });
  });
});
