# Research: Chrome/Edge Browser Extension

**Branch**: `006-browser-extension` | **Date**: 2026-01-26  
**Status**: Complete

## Summary

This document captures research findings and technical decisions for building a Manifest V3 browser extension for Chrome and Edge. Key areas investigated: side panel API, authentication via Entra External ID, build tooling, and permission minimization.

---

## 1. Side Panel API

### Decision: Use `chrome.sidePanel` API

**Rationale**: The chrome.sidePanel API (Chrome 114+, Edge 114+) provides a native way to display persistent UI alongside web content. Both Chrome and Edge support the same API surface.

**Alternatives Considered**:
- **DevTools Panel**: Limited to developer use; not suitable for general users
- **Browser Action Popup**: Ephemeral; closes when user clicks elsewhere
- **New Tab Page Override**: Too invasive; changes browser behavior

### Key Implementation Details

**Manifest Configuration**:
```json
{
  "manifest_version": 3,
  "permissions": ["sidePanel"],
  "side_panel": {
    "default_path": "src/sidepanel/index.html"
  },
  "action": {
    "default_title": "Recall"
  }
}
```

**Opening Side Panel from Popup** (Chrome 116+):
```typescript
// In popup script - open side panel on button click
async function openSidePanel() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.sidePanel.open({ windowId: tab.windowId });
  window.close(); // Close popup after opening side panel
}
```

**Side Panel Behavior**:
- Remains open across tab navigation (if global)
- Can be tab-specific via `setOptions({ tabId, path, enabled })`
- User can pin extension to keep side panel easily accessible

**Cross-Browser Compatibility**:
- Chrome: Full support since 114
- Edge: Full support since 114 (same Chromium base)
- Firefox: Not supported (out of scope)

**Citations**:
- https://developer.chrome.com/docs/extensions/reference/api/sidePanel
- https://github.com/nickel-lang/nickel/blob/master/notes/side-panel-migration.md

---

## 2. Authentication with Entra External ID

### Decision: Use `chrome.identity.launchWebAuthFlow` with PKCE

**Rationale**: The `launchWebAuthFlow` API enables OAuth2 flows with non-Google identity providers. It launches a popup window for user authentication and captures the redirect URL with tokens. PKCE (Proof Key for Code Exchange) is required for public clients (extensions have no secure backend).

**Alternatives Considered**:
- **MSAL.js in extension**: Complex; MSAL expects browser context, not service worker
- **chrome.identity.getAuthToken**: Only works with Google accounts
- **Content script injection**: Security risk; violates MV3 best practices

### Implementation Details

**Redirect URI Format**:
```
https://<extension-id>.chromiumapp.org/oauth2
```

The extension ID is deterministic based on the extension's public key. Use `chrome.identity.getRedirectURL()` to generate the correct URI.

**PKCE Flow Implementation**:
```typescript
// Generate PKCE code verifier and challenge
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

// Launch auth flow
async function authenticate(): Promise<string> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const redirectUri = chrome.identity.getRedirectURL('oauth2');
  
  const authUrl = new URL(`https://${TENANT_SUBDOMAIN}.ciamlogin.com/${TENANT_ID}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', `openid profile email api://${API_CLIENT_ID}/access_as_user`);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('prompt', 'select_account');
  
  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true
  });
  
  const code = new URL(responseUrl).searchParams.get('code');
  return exchangeCodeForToken(code, codeVerifier, redirectUri);
}
```

**Token Exchange**:
```typescript
async function exchangeCodeForToken(
  code: string, 
  codeVerifier: string, 
  redirectUri: string
): Promise<TokenResponse> {
  const tokenUrl = `https://${TENANT_SUBDOMAIN}.ciamlogin.com/${TENANT_ID}/oauth2/v2.0/token`;
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    })
  });
  
  return response.json();
}
```

### Entra App Registration Requirements

In the Microsoft Entra admin center:

1. **Platform**: Add "Single-page application" platform
2. **Redirect URI**: Add `https://<extension-id>.chromiumapp.org/oauth2`
3. **Implicit grant**: Disable (not needed with PKCE)
4. **API permissions**: Add `api://<api-client-id>/access_as_user` (delegated)
5. **Supported account types**: Match existing web app configuration

**Important**: The extension ID is derived from the extension's public key. For development, the ID changes each time the extension is loaded unpacked. For production, generate a stable key:

```bash
# Generate extension key pair (one-time setup)
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem
```

Add to manifest.json for consistent ID:
```json
{
  "key": "MIIBIjANBgkq... (public key in base64)"
}
```

**Citations**:
- https://developer.chrome.com/docs/extensions/reference/api/identity
- https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow

---

## 3. Token Sharing with Side Panel Web App

### Decision: Use `postMessage` API for SSO

**Rationale**: The side panel loads the Recall web app in an iframe-like context. To avoid double sign-in, the extension shares access tokens with the web app via `postMessage`. The web app listens for token messages and uses them for API calls.

**Alternatives Considered**:
- **Shared cookie**: Not reliable across extension/web contexts
- **URL parameter token**: Security risk; token visible in history
- **Web app independent auth**: Poor UX; user signs in twice

### Implementation Details

**Extension Side (side panel script)**:
```typescript
// When side panel loads, get token from extension storage and send to iframe
async function shareTenantWithWebApp() {
  const token = await chrome.storage.local.get('accessToken');
  if (!token.accessToken) return;
  
  const iframe = document.getElementById('recall-webapp') as HTMLIFrameElement;
  iframe.contentWindow?.postMessage({
    type: 'RECALL_EXT_AUTH',
    accessToken: token.accessToken,
    expiresAt: token.expiresAt
  }, config.webAppOrigin);
}

// Listen for token requests from web app
window.addEventListener('message', async (event) => {
  if (event.origin !== config.webAppOrigin) return;
  if (event.data.type === 'RECALL_REQUEST_TOKEN') {
    shareTenantWithWebApp();
  }
});
```

**Web App Side (requires modification)**:
```typescript
// In web app, listen for extension token
window.addEventListener('message', (event) => {
  // Validate origin is extension
  if (!event.origin.startsWith('chrome-extension://')) return;
  if (event.data.type === 'RECALL_EXT_AUTH') {
    useExtensionToken(event.data.accessToken, event.data.expiresAt);
  }
});

// Request token on load if in extension context
if (window.parent !== window) {
  window.parent.postMessage({ type: 'RECALL_REQUEST_TOKEN' }, '*');
}
```

**Security Considerations**:
- Validate message origin on both sides
- Token should have short expiry; extension handles refresh
- Web app falls back to regular MSAL auth if not in extension context

---

## 4. Build Tooling

### Decision: CRXJS Vite Plugin

**Rationale**: CRXJS provides first-class Vite integration for MV3 extensions with HMR support during development, automatic manifest handling, and TypeScript support out of the box.

**Alternatives Considered**:
- **Webpack**: Works but requires more configuration
- **Rollup**: No HMR support for extensions
- **Plasmo**: Higher-level abstraction; less control

### Configuration

**vite.config.ts**:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest })
  ],
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup/index.html',
        sidepanel: 'src/sidepanel/index.html'
      }
    }
  }
});
```

**Alternative: TypeScript Manifest**:
```typescript
// manifest.config.ts
import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'Recall',
  version: packageJson.version,
  permissions: ['activeTab', 'sidePanel', 'storage', 'identity', 'tabs'],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module'
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'assets/icon-16.png',
      48: 'assets/icon-48.png',
      128: 'assets/icon-128.png'
    }
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html'
  },
  commands: {
    '_execute_action': {
      suggested_key: {
        default: 'Ctrl+Shift+S',
        mac: 'Command+Shift+S'
      },
      description: 'Save current tab'
    }
  }
});
```

**Development Workflow**:
```bash
# Development with HMR
pnpm dev

# Build for production
pnpm build

# Load unpacked extension from dist/ folder
```

**Citations**:
- https://github.com/crxjs/chrome-extension-tools
- https://crxjs.dev/vite-plugin

---

## 5. Permission Minimization

### Decision: Use `activeTab` for single saves; `tabs` only for batch selection

**Rationale**: Minimal permissions improve user trust and pass Chrome Web Store review more easily.

| Permission | When Needed | Why |
|------------|-------------|-----|
| `activeTab` | Always | Get current tab URL/title on user interaction |
| `sidePanel` | Always | Required for side panel API |
| `storage` | Always | Store tokens, settings |
| `identity` | Always | OAuth2 authentication flow |
| `tabs` | Batch selection only | List all tabs in current window |

**Implementation Strategy**:

**Single Tab Save** (only `activeTab`):
```typescript
// This works because user clicked extension icon (user gesture)
async function saveCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // activeTab permission grants access to tab.url and tab.title
  return { url: tab.url, title: tab.title };
}
```

**Batch Tab Save** (requires `tabs` permission):
```typescript
// Need tabs permission to query all tabs
async function listAllTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs.map(tab => ({
    id: tab.id,
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl
  }));
}
```

**Restricted URLs Handling**:
```typescript
const RESTRICTED_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'file://',
  'devtools://',
  'data:'
];

function isRestrictedUrl(url: string): boolean {
  return RESTRICTED_PREFIXES.some(prefix => url.startsWith(prefix));
}
```

---

## 6. Configuration Strategy

### Decision: Environment-based configuration with single module

**Rationale**: Centralize all environment-specific values (URLs, client IDs, scopes) in one place. Use Vite's `import.meta.env` for build-time substitution.

**config/index.ts**:
```typescript
interface ExtensionConfig {
  environment: 'development' | 'production';
  apiBaseUrl: string;
  webAppUrl: string;
  auth: {
    tenantSubdomain: string;
    tenantId: string;
    clientId: string;
    apiClientId: string;
    scope: string;
  };
}

const config: ExtensionConfig = {
  environment: import.meta.env.MODE as 'development' | 'production',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5080',
  webAppUrl: import.meta.env.VITE_WEB_APP_URL || 'http://localhost:5173',
  auth: {
    tenantSubdomain: import.meta.env.VITE_AUTH_TENANT_SUBDOMAIN || '',
    tenantId: import.meta.env.VITE_AUTH_TENANT_ID || '',
    clientId: import.meta.env.VITE_AUTH_CLIENT_ID || '',
    apiClientId: import.meta.env.VITE_AUTH_API_CLIENT_ID || '',
    scope: import.meta.env.VITE_AUTH_SCOPE || 'openid profile email'
  }
};

export default config;
```

**.env.development**:
```
VITE_API_BASE_URL=http://localhost:5080
VITE_WEB_APP_URL=http://localhost:5173
VITE_AUTH_TENANT_SUBDOMAIN=your-tenant
VITE_AUTH_TENANT_ID=your-tenant-id
VITE_AUTH_CLIENT_ID=extension-client-id
VITE_AUTH_API_CLIENT_ID=api-client-id
VITE_AUTH_SCOPE=openid profile email api://api-client-id/access_as_user
```

**.env.production**:
```
VITE_API_BASE_URL=https://api.recall.example.com
VITE_WEB_APP_URL=https://app.recall.example.com
VITE_AUTH_TENANT_SUBDOMAIN=your-tenant
VITE_AUTH_TENANT_ID=your-tenant-id
VITE_AUTH_CLIENT_ID=extension-client-id-prod
VITE_AUTH_API_CLIENT_ID=api-client-id-prod
VITE_AUTH_SCOPE=openid profile email api://api-client-id-prod/access_as_user
```

---

## 7. API Integration Pattern

### Decision: Service worker handles all API calls; popup/sidepanel use messaging

**Rationale**: Centralizing API calls in the service worker ensures consistent token handling, retry logic, and avoids duplicating authentication code across contexts.

**Message-based API**:
```typescript
// Types
type MessageType = 
  | { type: 'SAVE_URL'; url: string; title?: string }
  | { type: 'SAVE_URLS'; items: Array<{ url: string; title?: string }> }
  | { type: 'GET_AUTH_STATE' }
  | { type: 'SIGN_IN' }
  | { type: 'SIGN_OUT' };

// Popup sends message
async function saveCurrentTab(url: string, title?: string): Promise<SaveResult> {
  return chrome.runtime.sendMessage({ type: 'SAVE_URL', url, title });
}

// Service worker handles message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_URL') {
    handleSaveUrl(message.url, message.title)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // Keep channel open for async response
  }
});
```

---

## Decisions Summary

| Topic | Decision | Key Reason |
|-------|----------|------------|
| Side Panel | `chrome.sidePanel` API | Native browser support; persistent UI |
| Authentication | `chrome.identity.launchWebAuthFlow` + PKCE | Works with Entra External ID; no backend secrets |
| Token Sharing | `postMessage` to web app iframe | SSO experience; no double sign-in |
| Build Tooling | CRXJS Vite Plugin | HMR support; TypeScript; minimal config |
| Permissions | `activeTab` + `tabs` (batch only) | Minimal footprint; user trust |
| Configuration | Single module + `.env` files | Centralized; environment-aware |
| API Calls | Service worker + messaging | Consistent auth; single token cache |

---

## Open Items Resolved

All NEEDS CLARIFICATION items from Technical Context have been resolved:

1. ✅ Side panel approach: `chrome.sidePanel` API
2. ✅ Auth approach: `chrome.identity.launchWebAuthFlow` with PKCE
3. ✅ Build tooling: CRXJS Vite Plugin
4. ✅ Token sharing: `postMessage` between extension and web app
5. ✅ Permission strategy: `activeTab` for single save; `tabs` for batch
6. ✅ Configuration strategy: Environment files + single config module
