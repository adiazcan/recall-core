/**
 * Chrome Storage Wrapper Service
 *
 * Provides typed access to chrome.storage.local and chrome.storage.session
 * with async/await support and error handling.
 */

import type { StorageSchema, StoredAuth, StoredSettings } from '../types';

/** Storage keys */
const KEYS = {
  AUTH: 'auth',
  SETTINGS: 'settings',
} as const;

/** Default settings */
const DEFAULT_SETTINGS: StoredSettings = {
  autoOpenSidePanel: false,
  defaultTags: [],
};

/**
 * Generic get operation for chrome.storage.local
 */
async function get<K extends keyof StorageSchema>(
  key: K
): Promise<StorageSchema[K] | undefined> {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key];
  } catch (error) {
    console.error(`[Storage] Failed to get ${key}:`, error);
    throw new StorageError(`Failed to get ${key}`, error);
  }
}

/**
 * Generic set operation for chrome.storage.local
 */
async function set<K extends keyof StorageSchema>(
  key: K,
  value: StorageSchema[K]
): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (error) {
    console.error(`[Storage] Failed to set ${key}:`, error);
    throw new StorageError(`Failed to set ${key}`, error);
  }
}

/**
 * Generic remove operation for chrome.storage.local
 */
async function remove<K extends keyof StorageSchema>(key: K): Promise<void> {
  try {
    await chrome.storage.local.remove(key);
  } catch (error) {
    console.error(`[Storage] Failed to remove ${key}:`, error);
    throw new StorageError(`Failed to remove ${key}`, error);
  }
}

// =============================================================================
// Auth Storage Operations
// =============================================================================

/**
 * Gets stored authentication data
 */
export async function getAuth(): Promise<StoredAuth | undefined> {
  return get(KEYS.AUTH);
}

/**
 * Stores authentication data
 */
export async function setAuth(auth: StoredAuth): Promise<void> {
  return set(KEYS.AUTH, auth);
}

/**
 * Clears stored authentication data
 */
export async function clearAuth(): Promise<void> {
  return remove(KEYS.AUTH);
}

/**
 * Checks if a valid (non-expired) auth token is stored
 *
 * @param bufferMs - Buffer time in ms before actual expiry (default 5 min)
 */
export async function hasValidAuth(bufferMs = 5 * 60 * 1000): Promise<boolean> {
  const auth = await getAuth();
  if (!auth?.accessToken || !auth.expiresAt) {
    return false;
  }
  return auth.expiresAt > Date.now() + bufferMs;
}

/**
 * Gets the current access token if valid
 *
 * @param bufferMs - Buffer time in ms before actual expiry (default 5 min)
 * @returns Access token or null if expired/missing
 */
export async function getAccessToken(
  bufferMs = 5 * 60 * 1000
): Promise<string | null> {
  const auth = await getAuth();
  if (!auth?.accessToken || !auth.expiresAt) {
    return null;
  }
  if (auth.expiresAt <= Date.now() + bufferMs) {
    return null; // Token expired or about to expire
  }
  return auth.accessToken;
}

/**
 * Updates just the access token and expiry (after refresh)
 */
export async function updateAccessToken(
  accessToken: string,
  expiresAt: number
): Promise<void> {
  const auth = await getAuth();
  if (auth) {
    auth.accessToken = accessToken;
    auth.expiresAt = expiresAt;
    await setAuth(auth);
  }
}

// =============================================================================
// Settings Storage Operations
// =============================================================================

/**
 * Gets stored settings with defaults
 */
export async function getSettings(): Promise<StoredSettings> {
  const settings = await get(KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...settings };
}

/**
 * Stores settings
 */
export async function setSettings(settings: StoredSettings): Promise<void> {
  return set(KEYS.SETTINGS, settings);
}

/**
 * Updates specific settings, preserving others
 */
export async function updateSettings(
  updates: Partial<StoredSettings>
): Promise<void> {
  const current = await getSettings();
  await setSettings({ ...current, ...updates });
}

// =============================================================================
// Session Storage (for ephemeral state)
// =============================================================================

/**
 * Stores ephemeral data in session storage (cleared when browser closes)
 */
export async function setSessionData<T>(key: string, value: T): Promise<void> {
  try {
    await chrome.storage.session.set({ [key]: value });
  } catch (error) {
    console.error(`[Storage] Failed to set session data ${key}:`, error);
    throw new StorageError(`Failed to set session data ${key}`, error);
  }
}

/**
 * Gets ephemeral data from session storage
 */
export async function getSessionData<T>(key: string): Promise<T | undefined> {
  try {
    const result = await chrome.storage.session.get(key);
    return result[key] as T | undefined;
  } catch (error) {
    console.error(`[Storage] Failed to get session data ${key}:`, error);
    throw new StorageError(`Failed to get session data ${key}`, error);
  }
}

/**
 * Clears ephemeral data from session storage
 */
export async function clearSessionData(key: string): Promise<void> {
  try {
    await chrome.storage.session.remove(key);
  } catch (error) {
    console.error(`[Storage] Failed to clear session data ${key}:`, error);
    throw new StorageError(`Failed to clear session data ${key}`, error);
  }
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Clears all stored data (for testing or reset)
 */
export async function clearAllData(): Promise<void> {
  try {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
  } catch (error) {
    console.error('[Storage] Failed to clear all data:', error);
    throw new StorageError('Failed to clear all data', error);
  }
}

/**
 * Storage error class for consistent error handling
 */
export class StorageError extends Error {
  public readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}

/**
 * Storage service object for dependency injection
 */
export const storage = {
  // Auth
  getAuth,
  setAuth,
  clearAuth,
  hasValidAuth,
  getAccessToken,
  updateAccessToken,
  // Settings
  getSettings,
  setSettings,
  updateSettings,
  // Session
  setSessionData,
  getSessionData,
  clearSessionData,
  // Utilities
  clearAllData,
};
