/**
 * API Service Unit Tests
 *
 * Tests for Recall API client with Bearer token attachment.
 * Tests URL validation and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetAllMocks, setupStorage } from '../setup';
import type { StoredAuth, ItemDto } from '../../src/types';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock the config module
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
  getTokenEndpoint: () => 'https://test-tenant.ciamlogin.com/test-tenant-id/oauth2/v2.0/token',
}));

// Import after mocking
import {
  isValidUrl,
  isRestrictedUrl,
  getRestrictedReason,
  validateUrl,
  createItem,
  saveItem,
  getItems,
  ApiError,
} from '../../src/services/api';

describe('API Service', () => {
  beforeEach(() => {
    resetAllMocks();
    mockFetch.mockReset();
  });

  // Helper to set up authenticated state
  const setupAuth = () => {
    const auth: StoredAuth = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: Date.now() + 3600 * 1000, // 1 hour from now
      user: { sub: 'user-123' },
    };
    setupStorage('local', { auth });
    return auth;
  };

  // Helper to create mock item response
  const createMockItem = (overrides: Partial<ItemDto> = {}): ItemDto => ({
    id: 'item-123',
    url: 'https://example.com/page',
    normalizedUrl: 'example.com/page',
    title: 'Example Page',
    status: 'inbox',
    isFavorite: false,
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  // ===========================================================================
  // URL Validation
  // ===========================================================================

  describe('isValidUrl', () => {
    it('returns true for http URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
    });

    it('returns true for https URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('https://example.com/path?query=1')).toBe(true);
    });

    it('returns false for non-http/https URLs', () => {
      expect(isValidUrl('ftp://example.com')).toBe(false);
      expect(isValidUrl('file:///path/to/file')).toBe(false);
      expect(isValidUrl('chrome://extensions')).toBe(false);
    });

    it('returns false for invalid URLs', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('example.com')).toBe(false); // Missing protocol
    });
  });

  describe('isRestrictedUrl', () => {
    it('returns true for chrome:// URLs', () => {
      expect(isRestrictedUrl('chrome://extensions')).toBe(true);
      expect(isRestrictedUrl('chrome://settings')).toBe(true);
      expect(isRestrictedUrl('chrome-extension://abc123/popup.html')).toBe(true);
    });

    it('returns true for edge:// URLs', () => {
      expect(isRestrictedUrl('edge://extensions')).toBe(true);
      expect(isRestrictedUrl('edge://settings')).toBe(true);
    });

    it('returns true for about: URLs', () => {
      expect(isRestrictedUrl('about:blank')).toBe(true);
      expect(isRestrictedUrl('about:newtab')).toBe(true);
    });

    it('returns true for file: URLs', () => {
      expect(isRestrictedUrl('file:///path/to/file.html')).toBe(true);
    });

    it('returns true for data: and blob: URLs', () => {
      expect(isRestrictedUrl('data:text/html,<h1>Test</h1>')).toBe(true);
      expect(isRestrictedUrl('blob:https://example.com/abc123')).toBe(true);
    });

    it('returns true for javascript: URLs', () => {
      expect(isRestrictedUrl('javascript:alert(1)')).toBe(true);
    });

    it('returns true for Chrome Web Store', () => {
      expect(isRestrictedUrl('https://chrome.google.com/webstore/detail/abc')).toBe(true);
    });

    it('returns true for Edge Add-ons', () => {
      expect(isRestrictedUrl('https://microsoftedge.microsoft.com/addons/detail/abc')).toBe(true);
    });

    it('returns false for regular http/https URLs', () => {
      expect(isRestrictedUrl('https://example.com')).toBe(false);
      expect(isRestrictedUrl('https://github.com')).toBe(false);
      expect(isRestrictedUrl('http://localhost:3000')).toBe(false);
    });
  });

  describe('getRestrictedReason', () => {
    it('returns reason for chrome URLs', () => {
      expect(getRestrictedReason('chrome://extensions')).toContain('Chrome internal');
    });

    it('returns reason for edge URLs', () => {
      expect(getRestrictedReason('edge://settings')).toContain('Edge internal');
    });

    it('returns reason for about URLs', () => {
      expect(getRestrictedReason('about:blank')).toContain('about pages');
    });

    it('returns reason for file URLs', () => {
      expect(getRestrictedReason('file:///path')).toContain('Local files');
    });

    it('returns reason for Chrome Web Store', () => {
      expect(getRestrictedReason('https://chrome.google.com/webstore/detail/abc')).toContain('Chrome Web Store');
    });

    it('returns undefined for non-restricted URLs', () => {
      expect(getRestrictedReason('https://example.com')).toBeUndefined();
    });
  });

  describe('validateUrl', () => {
    it('returns valid: true for valid URLs', () => {
      expect(validateUrl('https://example.com')).toEqual({ valid: true });
    });

    it('returns error for empty URL', () => {
      const result = validateUrl('');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('INVALID_URL');
      }
    });

    it('returns error for non-string URL', () => {
      const result = validateUrl(null as unknown as string);
      expect(result.valid).toBe(false);
    });

    it('returns error for invalid URL format', () => {
      const result = validateUrl('not-a-url');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('INVALID_URL');
      }
    });

    it('returns error for restricted URLs', () => {
      // Use a valid https URL that is restricted (Chrome Web Store)
      const result = validateUrl('https://chrome.google.com/webstore/detail/abc');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('RESTRICTED_URL');
      }
    });
  });

  // ===========================================================================
  // API Methods
  // ===========================================================================

  describe('createItem', () => {
    it('creates a new item and returns isNew: true for 201', async () => {
      setupAuth();
      const mockItem = createMockItem();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockItem,
      });

      const result = await createItem({ url: 'https://example.com/page' });

      expect(result.item).toEqual(mockItem);
      expect(result.isNew).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('items'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('returns isNew: false for 200 (deduplicated)', async () => {
      setupAuth();
      const mockItem = createMockItem();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockItem,
      });

      const result = await createItem({ url: 'https://example.com/page' });

      expect(result.isNew).toBe(false);
    });

    it('includes title and tags in request', async () => {
      setupAuth();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createMockItem(),
      });

      await createItem({
        url: 'https://example.com',
        title: 'Custom Title',
        tags: ['tag1', 'tag2'],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            url: 'https://example.com',
            title: 'Custom Title',
            tags: ['tag1', 'tag2'],
          }),
        })
      );
    });

    it('throws ApiError for invalid URL', async () => {
      setupAuth();

      await expect(createItem({ url: 'not-a-url' })).rejects.toThrow(ApiError);
      await expect(createItem({ url: 'not-a-url' })).rejects.toMatchObject({
        code: 'INVALID_URL',
      });
    });

    it('throws ApiError for restricted URL', async () => {
      setupAuth();

      // Use a valid https URL that is restricted (Chrome Web Store)
      await expect(createItem({ url: 'https://chrome.google.com/webstore/detail/abc' })).rejects.toThrow(ApiError);
      await expect(createItem({ url: 'https://chrome.google.com/webstore/detail/abc' })).rejects.toMatchObject({
        code: 'RESTRICTED_URL',
      });
    });

    it('throws ApiError on 401 response', async () => {
      setupAuth();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Unauthorized' } }),
      });

      await expect(createItem({ url: 'https://example.com' })).rejects.toMatchObject({
        code: 'AUTH_REQUIRED',
      });
    });

    it('throws ApiError on 403 response', async () => {
      setupAuth();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'Forbidden' } }),
      });

      await expect(createItem({ url: 'https://example.com' })).rejects.toMatchObject({
        code: 'AUTH_FAILED',
      });
    });

    it('throws ApiError on network error', async () => {
      setupAuth();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(createItem({ url: 'https://example.com' })).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    });
  });

  describe('saveItem', () => {
    it('returns success result for new item', async () => {
      setupAuth();
      const mockItem = createMockItem();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockItem,
      });

      const result = await saveItem('https://example.com', 'My Title');

      expect(result).toEqual({
        success: true,
        isNew: true,
        item: {
          id: mockItem.id,
          url: mockItem.url,
          title: mockItem.title,
        },
      });
    });

    it('returns success result for deduplicated item', async () => {
      setupAuth();
      const mockItem = createMockItem();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockItem,
      });

      const result = await saveItem('https://example.com');

      expect(result.success).toBe(true);
      expect(result.isNew).toBe(false);
    });

    it('returns failure result for invalid URL without throwing', async () => {
      setupAuth();

      const result = await saveItem('not-a-url');

      expect(result.success).toBe(false);
      expect(result.isNew).toBe(false);
      expect(result.errorCode).toBe('INVALID_URL');
      expect(result.error).toBeDefined();
    });

    it('returns failure result for restricted URL without throwing', async () => {
      setupAuth();

      // Use a valid https URL that is restricted (Chrome Web Store)
      const result = await saveItem('https://chrome.google.com/webstore/detail/abc');

      expect(result.success).toBe(false);
      expect(result.isNew).toBe(false);
      expect(result.errorCode).toBe('RESTRICTED_URL');
      expect(result.error).toBeDefined();
    });

    it('returns failure result for API errors without throwing', async () => {
      setupAuth();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Server error' } }),
      });

      const result = await saveItem('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('passes tags to createItem', async () => {
      setupAuth();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createMockItem(),
      });

      await saveItem('https://example.com', 'Title', ['tag1', 'tag2']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"tags":["tag1","tag2"]'),
        })
      );
    });
  });

  describe('getItems', () => {
    it('fetches items without parameters', async () => {
      setupAuth();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [createMockItem()],
          nextCursor: undefined,
        }),
      });

      const result = await getItems();

      expect(result.items).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/items$/),
        expect.any(Object)
      );
    });

    it('includes limit and cursor parameters', async () => {
      setupAuth();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
          nextCursor: 'next-page',
        }),
      });

      await getItems({ limit: 10, cursor: 'abc123' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('cursor=abc123'),
        expect.any(Object)
      );
    });
  });

  // ===========================================================================
  // ApiError Class
  // ===========================================================================

  describe('ApiError', () => {
    it('has correct name, code, and message', () => {
      const error = new ApiError('API_ERROR', 'Test message', 500);

      expect(error.name).toBe('ApiError');
      expect(error.code).toBe('API_ERROR');
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(500);
      expect(error).toBeInstanceOf(Error);
    });

    it('works without status code', () => {
      const error = new ApiError('NETWORK_ERROR', 'Connection failed');

      expect(error.statusCode).toBeUndefined();
    });

    it('supports all error codes', () => {
      const codes = [
        'AUTH_REQUIRED',
        'AUTH_FAILED',
        'NETWORK_ERROR',
        'API_ERROR',
        'RESTRICTED_URL',
        'INVALID_URL',
        'UNKNOWN',
      ] as const;

      for (const code of codes) {
        const error = new ApiError(code, 'Test');
        expect(error.code).toBe(code);
      }
    });
  });
});
