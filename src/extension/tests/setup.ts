import { vi, beforeEach } from 'vitest';

/**
 * Chrome API Mocks for Extension Testing
 *
 * This setup file provides mock implementations of Chrome Extension APIs
 * that are not available in the jsdom test environment.
 */

// Mock chrome.storage API
const storageChangeListeners = new Set<
  (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void
>();
const createStorageArea = () => {
  let store: Record<string, unknown> = {};

  return {
    get: vi.fn((keys: string | string[] | null) => {
      if (keys === null) {
        return Promise.resolve({ ...store });
      }
      const keyArray = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      keyArray.forEach((key) => {
        if (key in store) {
          result[key] = store[key];
        }
      });
      return Promise.resolve(result);
    }),
    set: vi.fn((items: Record<string, unknown>) => {
      store = { ...store, ...items };
      return Promise.resolve();
    }),
    remove: vi.fn((keys: string | string[]) => {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      keyArray.forEach((key) => {
        delete store[key];
      });
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      store = {};
      return Promise.resolve();
    }),
    // Expose internal store for test assertions
    _getStore: () => store,
    _setStore: (newStore: Record<string, unknown>) => {
      store = newStore;
    },
  };
};

const mockStorageLocal = createStorageArea();
const mockStorageSync = createStorageArea();
const mockStorageSession = createStorageArea();

// Mock chrome.runtime API
const mockRuntime = {
  sendMessage: vi.fn(() => Promise.resolve()),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(() => false),
  },
  getURL: vi.fn((path: string) => `chrome-extension://mock-extension-id/${path}`),
  id: 'mock-extension-id',
  lastError: undefined as chrome.runtime.LastError | undefined,
};

// Mock chrome.identity API for auth testing
const mockIdentity = {
  launchWebAuthFlow: vi.fn(() => Promise.resolve('https://redirect.url?code=mock-auth-code')),
  getRedirectURL: vi.fn(() => 'https://mock-extension-id.chromiumapp.org/'),
  clearAllCachedAuthTokens: vi.fn(() => Promise.resolve()),
};

// Mock chrome.tabs API
const mockTabs = {
  query: vi.fn(() => Promise.resolve([] as chrome.tabs.Tab[])),
  get: vi.fn((tabId: number) =>
    Promise.resolve({
      id: tabId,
      url: 'https://example.com',
      title: 'Example Page',
      active: true,
      index: 0,
      pinned: false,
      highlighted: true,
      windowId: 1,
      incognito: false,
      selected: true,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
    })
  ),
  create: vi.fn(() => Promise.resolve({ id: 1 })),
  update: vi.fn(() => Promise.resolve({})),
  remove: vi.fn(() => Promise.resolve()),
  sendMessage: vi.fn(() => Promise.resolve()),
};

// Mock chrome.windows API
const mockWindows = {
  getCurrent: vi.fn(() =>
    Promise.resolve({
      id: 1,
      focused: true,
      incognito: false,
      alwaysOnTop: false,
    })
  ),
  getAll: vi.fn(() => Promise.resolve([])),
  create: vi.fn(() => Promise.resolve({ id: 1 })),
  update: vi.fn(() => Promise.resolve({})),
  remove: vi.fn(() => Promise.resolve()),
};

// Mock chrome.sidePanel API
const mockSidePanel = {
  open: vi.fn(() => Promise.resolve()),
  setOptions: vi.fn(() => Promise.resolve()),
  getOptions: vi.fn(() => Promise.resolve({ enabled: true })),
  setPanelBehavior: vi.fn(() => Promise.resolve()),
};

// Mock chrome.commands API
const mockCommands = {
  getAll: vi.fn(() => Promise.resolve([])),
  onCommand: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(() => false),
  },
};

// Mock chrome.action API (for popup badge, etc.)
const mockAction = {
  setBadgeText: vi.fn(() => Promise.resolve()),
  setBadgeBackgroundColor: vi.fn(() => Promise.resolve()),
  setIcon: vi.fn(() => Promise.resolve()),
  setTitle: vi.fn(() => Promise.resolve()),
  setPopup: vi.fn(() => Promise.resolve()),
  openPopup: vi.fn(() => Promise.resolve()),
};

// Mock chrome.alarms API (for scheduled tasks)
const mockAlarms = {
  create: vi.fn(() => Promise.resolve()),
  get: vi.fn(() => Promise.resolve(undefined)),
  getAll: vi.fn(() => Promise.resolve([])),
  clear: vi.fn(() => Promise.resolve(true)),
  clearAll: vi.fn(() => Promise.resolve(true)),
  onAlarm: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(() => false),
  },
};

// Assemble the complete chrome mock
const chromeMock = {
  storage: {
    local: mockStorageLocal,
    sync: mockStorageSync,
    session: mockStorageSession,
    onChanged: {
      addListener: vi.fn((listener) => {
        storageChangeListeners.add(listener);
      }),
      removeListener: vi.fn((listener) => {
        storageChangeListeners.delete(listener);
      }),
      hasListener: vi.fn((listener) => storageChangeListeners.has(listener)),
    },
  },
  runtime: mockRuntime,
  identity: mockIdentity,
  tabs: mockTabs,
  windows: mockWindows,
  sidePanel: mockSidePanel,
  commands: mockCommands,
  action: mockAction,
  alarms: mockAlarms,
};

// Assign to global
vi.stubGlobal('chrome', chromeMock);

// Export mocks for direct access in tests
export const mocks = {
  chrome: chromeMock,
  storage: {
    local: mockStorageLocal,
    sync: mockStorageSync,
    session: mockStorageSession,
  },
  runtime: mockRuntime,
  identity: mockIdentity,
  tabs: mockTabs,
  windows: mockWindows,
  sidePanel: mockSidePanel,
  commands: mockCommands,
  action: mockAction,
  alarms: mockAlarms,
};

// Helper to reset all mocks between tests
export const resetAllMocks = () => {
  vi.clearAllMocks();
  storageChangeListeners.clear();
  mockStorageLocal._setStore({});
  mockStorageSync._setStore({});
  mockStorageSession._setStore({});
  mockRuntime.lastError = undefined;
};

// Helper to emit chrome.storage.onChanged events
export const emitStorageChange = (
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string = 'local'
) => {
  storageChangeListeners.forEach((listener) => listener(changes, areaName));
};

// Helper to simulate chrome.runtime.lastError
export const setLastError = (message: string | undefined) => {
  mockRuntime.lastError = message ? { message } : undefined;
};

// Helper to set up storage with initial data
export const setupStorage = (
  area: 'local' | 'sync' | 'session',
  data: Record<string, unknown>
) => {
  mocks.storage[area]._setStore(data);
};

// Reset mocks before each test
beforeEach(() => {
  resetAllMocks();
});
