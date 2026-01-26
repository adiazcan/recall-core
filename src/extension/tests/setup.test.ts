import { describe, it, expect, vi } from 'vitest';
import { mocks, setupStorage, resetAllMocks } from './setup';

describe('Test Setup Verification', () => {
  describe('Chrome API Mocks', () => {
    it('should have chrome global available', () => {
      expect(chrome).toBeDefined();
      expect(chrome.storage).toBeDefined();
      expect(chrome.runtime).toBeDefined();
      expect(chrome.identity).toBeDefined();
      expect(chrome.tabs).toBeDefined();
    });

    it('should reset mocks between tests', () => {
      // Verify mocks are clean at start of test
      expect(vi.isMockFunction(chrome.storage.local.get)).toBe(true);
    });
  });

  describe('Storage Mock', () => {
    it('should store and retrieve data', async () => {
      await chrome.storage.local.set({ testKey: 'testValue' });
      const result = await chrome.storage.local.get('testKey');
      expect(result).toEqual({ testKey: 'testValue' });
    });

    it('should clear data between tests', async () => {
      // Data from previous test should not exist
      const result = await chrome.storage.local.get('testKey');
      expect(result).toEqual({});
    });

    it('should support setupStorage helper', async () => {
      setupStorage('local', { presetKey: 'presetValue' });
      const result = await chrome.storage.local.get('presetKey');
      expect(result).toEqual({ presetKey: 'presetValue' });
    });

    it('should handle null to get all items', async () => {
      setupStorage('local', { a: 1, b: 2 });
      const result = await chrome.storage.local.get(null);
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should handle array of keys', async () => {
      setupStorage('local', { a: 1, b: 2, c: 3 });
      const result = await chrome.storage.local.get(['a', 'c']);
      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should remove single key', async () => {
      setupStorage('local', { a: 1, b: 2 });
      await chrome.storage.local.remove('a');
      const result = await chrome.storage.local.get(null);
      expect(result).toEqual({ b: 2 });
    });

    it('should clear all data', async () => {
      setupStorage('local', { a: 1, b: 2 });
      await chrome.storage.local.clear();
      const result = await chrome.storage.local.get(null);
      expect(result).toEqual({});
    });
  });

  describe('Runtime Mock', () => {
    it('should have sendMessage mock', () => {
      expect(vi.isMockFunction(chrome.runtime.sendMessage)).toBe(true);
    });

    it('should generate extension URLs', () => {
      const url = chrome.runtime.getURL('popup.html');
      expect(url).toBe('chrome-extension://mock-extension-id/popup.html');
    });

    it('should have extension ID', () => {
      expect(chrome.runtime.id).toBe('mock-extension-id');
    });
  });

  describe('Identity Mock', () => {
    it('should mock launchWebAuthFlow', async () => {
      const result = await chrome.identity.launchWebAuthFlow({ url: 'https://test.com', interactive: true });
      expect(result).toContain('code=mock-auth-code');
    });

    it('should mock getRedirectURL', () => {
      const url = chrome.identity.getRedirectURL();
      expect(url).toContain('chromiumapp.org');
    });
  });

  describe('Tabs Mock', () => {
    it('should mock tabs.get', async () => {
      const tab = await chrome.tabs.get(1);
      expect(tab).toHaveProperty('id', 1);
      expect(tab).toHaveProperty('url', 'https://example.com');
    });

    it('should mock tabs.query', async () => {
      mocks.tabs.query.mockResolvedValueOnce([
        { id: 1, url: 'https://example.com', title: 'Example' },
        { id: 2, url: 'https://test.com', title: 'Test' },
      ] as chrome.tabs.Tab[]);

      const tabs = await chrome.tabs.query({ currentWindow: true });
      expect(tabs).toHaveLength(2);
    });
  });

  describe('SidePanel Mock', () => {
    it('should have sidePanel.open mock', () => {
      expect(vi.isMockFunction(chrome.sidePanel.open)).toBe(true);
    });
  });

  describe('Mock Exports', () => {
    it('should export mocks object for direct access', () => {
      expect(mocks).toBeDefined();
      expect(mocks.chrome).toBeDefined();
      expect(mocks.storage).toBeDefined();
      expect(mocks.runtime).toBeDefined();
      expect(mocks.identity).toBeDefined();
    });

    it('should export helper functions', () => {
      expect(typeof setupStorage).toBe('function');
      expect(typeof resetAllMocks).toBe('function');
    });
  });
});
