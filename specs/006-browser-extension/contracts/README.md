# Extension Contracts

This directory contains contract definitions for the browser extension.

## Files

### manifest.json

Reference Manifest V3 configuration for the extension. Key sections:

- **permissions**: `activeTab`, `sidePanel`, `storage`, `identity`, `tabs`
- **background**: Service worker configuration (MV3 requirement)
- **action**: Popup and icon configuration
- **side_panel**: Side panel HTML entry point
- **commands**: Keyboard shortcuts

**Note**: The `key` field should be replaced with a generated key to ensure consistent extension ID across installs.

### messages.ts

TypeScript type definitions for all messages exchanged between extension components:

1. **Runtime Messages** (`chrome.runtime.sendMessage`)
   - `SAVE_URL` - Save single URL
   - `SAVE_URLS` - Batch save
   - `GET_AUTH_STATE` - Query auth status
   - `SIGN_IN` / `SIGN_OUT` - Auth actions
   - `REFRESH_TOKEN` - Force token refresh
   - `OPEN_SIDE_PANEL` - Open side panel

2. **PostMessage** (Side Panel ↔ Web App)
   - `RECALL_EXT_AUTH` - Extension sends token to web app
   - `RECALL_REQUEST_TOKEN` - Web app requests token
   - `RECALL_EXT_SIGN_OUT` - Notify sign-out

3. **Storage Schema**
   - `StoredAuth` - Token and user info
   - `StoredSettings` - User preferences

4. **API Types**
   - `CreateItemRequest` - POST /api/v1/items request
   - `ItemDto` - Item response structure

## Usage

These contracts should be copied to `src/extension/src/types/` during implementation and used as the source of truth for type safety across the extension.

## No New API Endpoints

The extension uses the existing backend API:

- `POST /api/v1/items` - Create/dedupe item (existing)

No new API contracts are required.
