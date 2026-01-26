# Data Model: Chrome/Edge Browser Extension

**Branch**: `006-browser-extension` | **Date**: 2026-01-26

## Overview

The browser extension does not introduce new backend entities. It consumes the existing `Item` entity via the REST API (`POST /api/v1/items`). This document defines the extension-side data structures: messages exchanged between components, stored data in `chrome.storage`, and TypeScript interfaces.

---

## 1. Backend Entity (Existing)

The extension interacts with the existing `Item` entity. No modifications required.

### Item (Reference)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (MongoDB ObjectId) |
| `url` | string | Saved URL (required) |
| `normalizedUrl` | string | Canonical URL for deduplication |
| `title` | string? | Page title (optional) |
| `status` | string | `inbox` / `archived` |
| `isFavorite` | boolean | Favorite flag |
| `tags` | string[] | User-assigned tags |
| `createdAt` | DateTime | Creation timestamp |
| `userId` | string | Owner's user ID |

**API Endpoint**: `POST /api/v1/items`

**Request**:
```typescript
interface CreateItemRequest {
  url: string;
  title?: string | null;
  tags?: string[] | null;
}
```

**Response Codes**:
- `201 Created`: New item created
- `200 OK`: Existing item returned (deduplicated)
- `401 Unauthorized`: Missing or invalid token
- `400 Bad Request`: Invalid URL

---

## 2. Extension Storage Schema

Data persisted in `chrome.storage.local`.

### StoredAuth

Authentication state and tokens.

```typescript
interface StoredAuth {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;          // Unix timestamp (ms)
  idToken?: string;           // For user info display
  user?: {
    sub: string;              // User ID
    name?: string;
    email?: string;
  };
}
```

**Storage Key**: `auth`

### StoredSettings

User preferences (future use).

```typescript
interface StoredSettings {
  autoOpenSidePanel: boolean; // Open side panel after save
  defaultTags: string[];      // Auto-apply tags on save
}
```

**Storage Key**: `settings`

---

## 3. Runtime Message Types

Messages exchanged between popup, side panel, and service worker via `chrome.runtime.sendMessage`.

### Message Discriminated Union

```typescript
// Request messages (sent to service worker)
type ExtensionMessage =
  | SaveUrlMessage
  | SaveUrlsMessage
  | GetAuthStateMessage
  | SignInMessage
  | SignOutMessage
  | RefreshTokenMessage;

// Save single URL
interface SaveUrlMessage {
  type: 'SAVE_URL';
  payload: {
    url: string;
    title?: string;
  };
}

// Save multiple URLs (batch)
interface SaveUrlsMessage {
  type: 'SAVE_URLS';
  payload: {
    items: Array<{
      url: string;
      title?: string;
    }>;
  };
}

// Get current auth state
interface GetAuthStateMessage {
  type: 'GET_AUTH_STATE';
}

// Initiate sign-in flow
interface SignInMessage {
  type: 'SIGN_IN';
}

// Sign out and clear tokens
interface SignOutMessage {
  type: 'SIGN_OUT';
}

// Force token refresh
interface RefreshTokenMessage {
  type: 'REFRESH_TOKEN';
}
```

### Response Types

```typescript
// Auth state response
interface AuthStateResponse {
  isAuthenticated: boolean;
  user?: {
    sub: string;
    name?: string;
    email?: string;
  };
  expiresAt?: number;
}

// Single save result
interface SaveResult {
  success: boolean;
  isNew: boolean;           // true if created, false if deduplicated
  item?: {
    id: string;
    url: string;
    title?: string;
  };
  error?: string;
}

// Batch save result
interface BatchSaveResult {
  total: number;
  created: number;
  deduplicated: number;
  failed: number;
  results: Array<SaveResult & { index: number }>;
}
```

---

## 4. Web App Token Sharing

Messages exchanged between side panel (extension context) and web app iframe via `window.postMessage`.

### Extension → Web App

```typescript
interface ExtAuthTokenMessage {
  type: 'RECALL_EXT_AUTH';
  accessToken: string;
  expiresAt: number;
}
```

### Web App → Extension

```typescript
interface RequestTokenMessage {
  type: 'RECALL_REQUEST_TOKEN';
}
```

---

## 5. UI State Types

Local state within React components.

### Popup State

```typescript
interface PopupState {
  view: 'main' | 'batch-select';
  isLoading: boolean;
  error: string | null;
  lastSaveResult: SaveResult | null;
}
```

### Batch Selection State

```typescript
interface BatchSelectionState {
  tabs: Array<{
    id: number;
    url: string;
    title: string;
    favIconUrl?: string;
    selected: boolean;
    isRestricted: boolean;  // chrome://, etc.
  }>;
  isSaving: boolean;
  progress: {
    current: number;
    total: number;
  } | null;
  result: BatchSaveResult | null;
}
```

---

## 6. Configuration Types

```typescript
interface ExtensionConfig {
  environment: 'development' | 'production';
  apiBaseUrl: string;
  webAppUrl: string;
  auth: AuthConfig;
}

interface AuthConfig {
  tenantSubdomain: string;  // e.g., 'mycompany'
  tenantId: string;         // GUID
  clientId: string;         // Extension app registration client ID
  apiClientId: string;      // API app registration client ID
  scope: string;            // Full scope string
}
```

---

## 7. Tab Data Types

```typescript
// Minimal tab info for display
interface TabInfo {
  id: number;
  url: string;
  title: string;
  favIconUrl?: string;
}

// Tab with save-ability status
interface SaveableTab extends TabInfo {
  canSave: boolean;
  restrictedReason?: string;
}
```

---

## 8. Error Types

```typescript
// Structured errors for user display
interface ExtensionError {
  code: ExtensionErrorCode;
  message: string;
  details?: string;
}

type ExtensionErrorCode =
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
```

---

## 9. Validation Rules

### URL Validation

| Rule | Constraint |
|------|------------|
| Required | URL must not be empty |
| Format | Must be valid HTTP/HTTPS URL |
| Length | Max 2048 characters |
| Restricted | Must not start with restricted prefixes |

**Restricted URL Prefixes**:
- `chrome://`
- `chrome-extension://`
- `edge://`
- `about:`
- `file://`
- `devtools://`
- `data:`

### Token Validation

| Rule | Constraint |
|------|------------|
| Expiry Buffer | Refresh if expires within 5 minutes |
| Storage | Clear on sign-out |
| Scope | Must include `api://<client-id>/access_as_user` |

---

## 10. State Transitions

### Authentication State Machine

```
┌──────────────┐
│  SIGNED_OUT  │
└──────┬───────┘
       │ signIn()
       ▼
┌──────────────┐
│  SIGNING_IN  │
└──────┬───────┘
       │ success
       ▼
┌──────────────┐     tokenExpired()    ┌─────────────┐
│  SIGNED_IN   │◄─────────────────────►│  REFRESHING │
└──────┬───────┘                       └─────────────┘
       │ signOut()
       ▼
┌──────────────┐
│  SIGNED_OUT  │
└──────────────┘
```

### Save Operation State

```
┌───────┐
│ IDLE  │
└───┬───┘
    │ save()
    ▼
┌─────────┐
│ SAVING  │
└────┬────┘
     │
     ├── success ──► SAVED (isNew: true)
     │
     ├── dedupe ───► SAVED (isNew: false)
     │
     └── error ────► ERROR
```

---

## Summary

| Category | Items |
|----------|-------|
| Backend Entities | None new (uses existing `Item`) |
| Storage Keys | `auth`, `settings` |
| Message Types | 6 request types, 3 response types |
| UI State Types | 2 main states (popup, batch) |
| Error Codes | 7 error codes |
