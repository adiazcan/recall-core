/**
 * Storage Service Unit Tests
 *
 * Tests for chrome.storage wrapper service.
 * Uses mocked chrome.storage APIs from tests/setup.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mocks, resetAllMocks, setupStorage } from '../setup';
import {
  getAuth,
  setAuth,
  clearAuth,
  hasValidAuth,
  getAccessToken,
  updateAccessToken,
  getSettings,
  setSettings,
  updateSettings,
  setSessionData,
  getSessionData,
  clearSessionData,
  clearAllData,
  StorageError,
} from '../../src/services/storage';
import type { StoredAuth, StoredSettings } from '../../src/types';

describe('Storage Service', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  // ===========================================================================
  // Auth Storage Operations
  // ===========================================================================

  describe('Auth Storage', () => {
    const mockAuth: StoredAuth = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: Date.now() + 3600 * 1000, // 1 hour from now
      idToken: 'test-id-token',
      user: {
        sub: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
      },
    };

    describe('getAuth', () => {
      it('returns undefined when no auth is stored', async () => {
        const result = await getAuth();
        expect(result).toBeUndefined();
      });

      it('returns stored auth data', async () => {
        setupStorage('local', { auth: mockAuth });

        const result = await getAuth();
        expect(result).toEqual(mockAuth);
      });

      it('throws StorageError on failure', async () => {
        mocks.storage.local.get.mockRejectedValueOnce(new Error('Storage error'));

        await expect(getAuth()).rejects.toThrow(StorageError);
      });
    });

    describe('setAuth', () => {
      it('stores auth data', async () => {
        await setAuth(mockAuth);

        expect(mocks.storage.local.set).toHaveBeenCalledWith({ auth: mockAuth });
      });

      it('throws StorageError on failure', async () => {
        mocks.storage.local.set.mockRejectedValueOnce(new Error('Storage error'));

        await expect(setAuth(mockAuth)).rejects.toThrow(StorageError);
      });
    });

    describe('clearAuth', () => {
      it('removes auth data', async () => {
        setupStorage('local', { auth: mockAuth });

        await clearAuth();

        expect(mocks.storage.local.remove).toHaveBeenCalledWith('auth');
      });

      it('throws StorageError on failure', async () => {
        mocks.storage.local.remove.mockRejectedValueOnce(new Error('Storage error'));

        await expect(clearAuth()).rejects.toThrow(StorageError);
      });
    });

    describe('hasValidAuth', () => {
      it('returns false when no auth is stored', async () => {
        const result = await hasValidAuth();
        expect(result).toBe(false);
      });

      it('returns false when access token is missing', async () => {
        setupStorage('local', {
          auth: { ...mockAuth, accessToken: '' },
        });

        const result = await hasValidAuth();
        expect(result).toBe(false);
      });

      it('returns false when token is expired', async () => {
        setupStorage('local', {
          auth: { ...mockAuth, expiresAt: Date.now() - 1000 },
        });

        const result = await hasValidAuth();
        expect(result).toBe(false);
      });

      it('returns false when token expires within buffer', async () => {
        const bufferMs = 5 * 60 * 1000; // 5 minutes
        setupStorage('local', {
          auth: { ...mockAuth, expiresAt: Date.now() + bufferMs - 1000 },
        });

        const result = await hasValidAuth(bufferMs);
        expect(result).toBe(false);
      });

      it('returns true when token is valid and not expiring within buffer', async () => {
        const bufferMs = 5 * 60 * 1000;
        setupStorage('local', {
          auth: { ...mockAuth, expiresAt: Date.now() + bufferMs + 60000 },
        });

        const result = await hasValidAuth(bufferMs);
        expect(result).toBe(true);
      });

      it('uses default buffer of 5 minutes', async () => {
        const fiveMinutes = 5 * 60 * 1000;
        setupStorage('local', {
          auth: { ...mockAuth, expiresAt: Date.now() + fiveMinutes + 1000 },
        });

        const result = await hasValidAuth();
        expect(result).toBe(true);
      });
    });

    describe('getAccessToken', () => {
      it('returns null when no auth is stored', async () => {
        const result = await getAccessToken();
        expect(result).toBeNull();
      });

      it('returns null when token is expired', async () => {
        setupStorage('local', {
          auth: { ...mockAuth, expiresAt: Date.now() - 1000 },
        });

        const result = await getAccessToken();
        expect(result).toBeNull();
      });

      it('returns token when valid', async () => {
        setupStorage('local', { auth: mockAuth });

        const result = await getAccessToken();
        expect(result).toBe(mockAuth.accessToken);
      });

      it('respects custom buffer time', async () => {
        const customBuffer = 10000; // 10 seconds
        setupStorage('local', {
          auth: { ...mockAuth, expiresAt: Date.now() + customBuffer - 1000 },
        });

        const result = await getAccessToken(customBuffer);
        expect(result).toBeNull();
      });
    });

    describe('updateAccessToken', () => {
      it('updates access token and expiry', async () => {
        setupStorage('local', { auth: mockAuth });

        const newToken = 'new-access-token';
        const newExpiry = Date.now() + 7200 * 1000;

        await updateAccessToken(newToken, newExpiry);

        expect(mocks.storage.local.set).toHaveBeenCalledWith({
          auth: expect.objectContaining({
            accessToken: newToken,
            expiresAt: newExpiry,
            refreshToken: mockAuth.refreshToken,
            user: mockAuth.user,
          }),
        });
      });

      it('does nothing when no auth is stored', async () => {
        await updateAccessToken('new-token', Date.now());

        // Should not call set if no existing auth
        expect(mocks.storage.local.set).not.toHaveBeenCalled();
      });
    });
  });

  // ===========================================================================
  // Settings Storage Operations
  // ===========================================================================

  describe('Settings Storage', () => {
    const mockSettings: StoredSettings = {
      autoOpenSidePanel: true,
      defaultTags: ['test', 'bookmark'],
    };

    describe('getSettings', () => {
      it('returns default settings when none stored', async () => {
        const result = await getSettings();

        expect(result).toEqual({
          autoOpenSidePanel: false,
          defaultTags: [],
        });
      });

      it('returns stored settings merged with defaults', async () => {
        setupStorage('local', {
          settings: { autoOpenSidePanel: true } as StoredSettings,
        });

        const result = await getSettings();

        expect(result).toEqual({
          autoOpenSidePanel: true,
          defaultTags: [], // default value
        });
      });

      it('returns full stored settings', async () => {
        setupStorage('local', { settings: mockSettings });

        const result = await getSettings();
        expect(result).toEqual(mockSettings);
      });
    });

    describe('setSettings', () => {
      it('stores settings', async () => {
        await setSettings(mockSettings);

        expect(mocks.storage.local.set).toHaveBeenCalledWith({
          settings: mockSettings,
        });
      });
    });

    describe('updateSettings', () => {
      it('merges partial updates with existing settings', async () => {
        setupStorage('local', { settings: mockSettings });

        await updateSettings({ autoOpenSidePanel: false });

        expect(mocks.storage.local.set).toHaveBeenCalledWith({
          settings: {
            autoOpenSidePanel: false,
            defaultTags: mockSettings.defaultTags,
          },
        });
      });

      it('merges with defaults when no settings exist', async () => {
        await updateSettings({ autoOpenSidePanel: true });

        expect(mocks.storage.local.set).toHaveBeenCalledWith({
          settings: {
            autoOpenSidePanel: true,
            defaultTags: [],
          },
        });
      });
    });
  });

  // ===========================================================================
  // Session Storage Operations
  // ===========================================================================

  describe('Session Storage', () => {
    describe('setSessionData', () => {
      it('stores data in session storage', async () => {
        const key = 'testKey';
        const value = { foo: 'bar' };

        await setSessionData(key, value);

        expect(mocks.storage.session.set).toHaveBeenCalledWith({
          [key]: value,
        });
      });

      it('throws StorageError on failure', async () => {
        mocks.storage.session.set.mockRejectedValueOnce(new Error('Session error'));

        await expect(setSessionData('key', 'value')).rejects.toThrow(StorageError);
      });
    });

    describe('getSessionData', () => {
      it('returns undefined when key does not exist', async () => {
        const result = await getSessionData<string>('nonexistent');
        expect(result).toBeUndefined();
      });

      it('returns stored session data', async () => {
        const key = 'myKey';
        const value = { test: true };
        mocks.storage.session._setStore({ [key]: value });

        const result = await getSessionData<typeof value>(key);
        expect(result).toEqual(value);
      });

      it('throws StorageError on failure', async () => {
        mocks.storage.session.get.mockRejectedValueOnce(new Error('Session error'));

        await expect(getSessionData('key')).rejects.toThrow(StorageError);
      });
    });

    describe('clearSessionData', () => {
      it('removes key from session storage', async () => {
        const key = 'toRemove';
        mocks.storage.session._setStore({ [key]: 'value' });

        await clearSessionData(key);

        expect(mocks.storage.session.remove).toHaveBeenCalledWith(key);
      });

      it('throws StorageError on failure', async () => {
        mocks.storage.session.remove.mockRejectedValueOnce(new Error('Session error'));

        await expect(clearSessionData('key')).rejects.toThrow(StorageError);
      });
    });
  });

  // ===========================================================================
  // Utilities
  // ===========================================================================

  describe('Utilities', () => {
    describe('clearAllData', () => {
      it('clears both local and session storage', async () => {
        await clearAllData();

        expect(mocks.storage.local.clear).toHaveBeenCalled();
        expect(mocks.storage.session.clear).toHaveBeenCalled();
      });

      it('throws StorageError on failure', async () => {
        mocks.storage.local.clear.mockRejectedValueOnce(new Error('Clear error'));

        await expect(clearAllData()).rejects.toThrow(StorageError);
      });
    });
  });

  // ===========================================================================
  // StorageError Class
  // ===========================================================================

  describe('StorageError', () => {
    it('has correct name and message', () => {
      const error = new StorageError('Test message');

      expect(error.name).toBe('StorageError');
      expect(error.message).toBe('Test message');
      expect(error).toBeInstanceOf(Error);
    });

    it('preserves cause', () => {
      const cause = new Error('Original error');
      const error = new StorageError('Wrapped error', cause);

      expect(error.cause).toBe(cause);
    });
  });
});
