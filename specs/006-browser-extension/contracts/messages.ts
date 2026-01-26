/**
 * Extension Message Contracts
 * 
 * Type definitions for messages exchanged between extension components:
 * - Service Worker ↔ Popup
 * - Service Worker ↔ Side Panel
 * - Side Panel ↔ Web App (postMessage)
 */

// =============================================================================
// Runtime Messages (chrome.runtime.sendMessage)
// =============================================================================

/**
 * Messages sent from popup/sidepanel to service worker
 */
export type ExtensionMessage =
  | SaveUrlMessage
  | SaveUrlsMessage
  | GetAuthStateMessage
  | SignInMessage
  | SignOutMessage
  | RefreshTokenMessage
  | OpenSidePanelMessage;

/** Save a single URL to Recall */
export interface SaveUrlMessage {
  type: 'SAVE_URL';
  payload: {
    url: string;
    title?: string;
    tags?: string[];
  };
}

/** Save multiple URLs (batch operation) */
export interface SaveUrlsMessage {
  type: 'SAVE_URLS';
  payload: {
    items: Array<{
      url: string;
      title?: string;
    }>;
  };
}

/** Request current authentication state */
export interface GetAuthStateMessage {
  type: 'GET_AUTH_STATE';
}

/** Initiate OAuth sign-in flow */
export interface SignInMessage {
  type: 'SIGN_IN';
}

/** Sign out and clear stored tokens */
export interface SignOutMessage {
  type: 'SIGN_OUT';
}

/** Force refresh access token */
export interface RefreshTokenMessage {
  type: 'REFRESH_TOKEN';
}

/** Open the side panel */
export interface OpenSidePanelMessage {
  type: 'OPEN_SIDE_PANEL';
  payload: {
    windowId: number;
  };
}

// =============================================================================
// Response Types
// =============================================================================

/** Authentication state */
export interface AuthStateResponse {
  isAuthenticated: boolean;
  user?: {
    sub: string;
    name?: string;
    email?: string;
  };
  expiresAt?: number;
}

/** Result of saving a single URL */
export interface SaveResult {
  success: boolean;
  /** true if newly created, false if already existed (deduplicated) */
  isNew: boolean;
  item?: {
    id: string;
    url: string;
    title?: string;
  };
  error?: string;
  errorCode?: ExtensionErrorCode;
}

/** Result of batch save operation */
export interface BatchSaveResult {
  total: number;
  created: number;
  deduplicated: number;
  failed: number;
  results: Array<SaveResult & { 
    index: number;
    url: string;
  }>;
}

/** Generic message response wrapper */
export type MessageResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: string; errorCode: ExtensionErrorCode };

// =============================================================================
// PostMessage Contracts (Side Panel ↔ Web App)
// =============================================================================

/**
 * Message sent from extension to web app with auth token
 */
export interface ExtAuthTokenMessage {
  type: 'RECALL_EXT_AUTH';
  accessToken: string;
  expiresAt: number;
}

/**
 * Message sent from web app requesting auth token
 */
export interface RequestTokenMessage {
  type: 'RECALL_REQUEST_TOKEN';
}

/**
 * Message sent from extension to notify sign-out
 */
export interface ExtSignOutMessage {
  type: 'RECALL_EXT_SIGN_OUT';
}

/** Union of all postMessage types */
export type WebAppMessage = 
  | ExtAuthTokenMessage 
  | RequestTokenMessage 
  | ExtSignOutMessage;

// =============================================================================
// Error Codes
// =============================================================================

export type ExtensionErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_FAILED'
  | 'AUTH_CANCELLED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REFRESH_FAILED'
  | 'NETWORK_ERROR'
  | 'API_ERROR'
  | 'RESTRICTED_URL'
  | 'INVALID_URL'
  | 'STORAGE_ERROR'
  | 'UNKNOWN';

export interface ExtensionError {
  code: ExtensionErrorCode;
  message: string;
  details?: string;
}

// =============================================================================
// Storage Contracts
// =============================================================================

/** Keys used in chrome.storage.local */
export interface StorageSchema {
  auth?: StoredAuth;
  settings?: StoredSettings;
}

/** Authentication data stored locally */
export interface StoredAuth {
  accessToken: string;
  refreshToken?: string;
  /** Unix timestamp in milliseconds */
  expiresAt: number;
  idToken?: string;
  user?: {
    sub: string;
    name?: string;
    email?: string;
  };
}

/** User settings stored locally */
export interface StoredSettings {
  /** Automatically open side panel after saving */
  autoOpenSidePanel: boolean;
  /** Tags to auto-apply when saving */
  defaultTags: string[];
}

// =============================================================================
// Tab Types
// =============================================================================

/** Minimal tab information for display */
export interface TabInfo {
  id: number;
  url: string;
  title: string;
  favIconUrl?: string;
}

/** Tab with save-ability status */
export interface SaveableTab extends TabInfo {
  canSave: boolean;
  restrictedReason?: string;
}

// =============================================================================
// API Request/Response Types (mirrors backend contracts)
// =============================================================================

/** Request to create a new item - POST /api/v1/items */
export interface CreateItemRequest {
  url: string;
  title?: string | null;
  tags?: string[] | null;
}

/** Item returned from API */
export interface ItemDto {
  id: string;
  url: string;
  normalizedUrl: string;
  title?: string;
  excerpt?: string;
  thumbnailUrl?: string;
  status: 'inbox' | 'archived';
  isFavorite: boolean;
  tags: string[];
  collectionId?: string;
  enrichmentStatus?: 'pending' | 'succeeded' | 'failed';
  createdAt: string;
  updatedAt: string;
}

/** API error response format */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
