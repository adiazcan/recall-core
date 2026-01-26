# Quickstart: Browser Extension Development

**Branch**: `006-browser-extension` | **Date**: 2026-01-26

Get the Recall browser extension running locally in under 10 minutes.

---

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 20+ | JavaScript runtime |
| pnpm | 9+ | Package manager |
| Chrome or Edge | 114+ | Browser with sidePanel support |
| Recall API | Running | Backend for saving items |
| Recall Web App | Running | Side panel content |

---

## 1. Clone and Setup

```bash
# Navigate to extension directory
cd src/extension

# Install dependencies
pnpm install
```

---

## 2. Configure Environment

Create `.env.development`:

```bash
# API and Web App URLs (adjust if different)
VITE_API_BASE_URL=http://localhost:5080
VITE_WEB_APP_URL=http://localhost:5173

# Entra External ID configuration
# Get these from your Azure portal app registration
VITE_AUTH_TENANT_SUBDOMAIN=your-tenant
VITE_AUTH_TENANT_ID=your-tenant-id
VITE_AUTH_CLIENT_ID=extension-client-id
VITE_AUTH_API_CLIENT_ID=api-client-id
VITE_AUTH_SCOPE=openid profile email api://api-client-id/access_as_user
```

---

## 3. Configure Entra App Registration

In Microsoft Entra admin center:

### Option A: Use Existing App Registration

1. Navigate to **Identity** → **Applications** → **App registrations**
2. Select your existing Recall web app registration
3. Go to **Authentication** → **Add a platform** → **Single-page application**
4. Add redirect URI: `https://[extension-id].chromiumapp.org/oauth2`

**Note**: Extension ID is unknown until first load. Use `chrome://extensions` to find it after step 4.

### Option B: Create New Registration (Recommended for Production)

1. Navigate to **Identity** → **Applications** → **App registrations**
2. Click **New registration**
3. Name: `Recall Browser Extension`
4. Supported account types: Same as web app
5. Redirect URI: Skip for now (add after getting extension ID)
6. After creation, note the **Application (client) ID**
7. Go to **API permissions** → **Add a permission** → **My APIs**
8. Select your Recall API → Select `access_as_user` scope
9. Grant admin consent

---

## 4. Build and Load Extension

```bash
# Build extension in development mode
pnpm dev

# This outputs to dist/ folder
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select `src/extension/dist` folder

### Load in Edge

1. Open `edge://extensions`
2. Enable **Developer mode** (left sidebar)
3. Click **Load unpacked**
4. Select `src/extension/dist` folder

---

## 5. Get Extension ID and Update Entra

1. After loading, find the extension in `chrome://extensions`
2. Copy the **ID** (e.g., `abcdefghijklmnopqrstuvwxyz123456`)
3. In Entra admin center, add redirect URI:
   ```
   https://abcdefghijklmnopqrstuvwxyz123456.chromiumapp.org/oauth2
   ```

---

## 6. Start Backend Services

In a separate terminal:

```bash
# From repo root
cd src
dotnet run --project Recall.Core.AppHost
```

Wait for:
- API running at `http://localhost:5080`
- Web app running at `http://localhost:5173`

---

## 7. Test the Extension

### Test Authentication

1. Click the Recall extension icon in toolbar
2. Click **Sign In**
3. Complete Entra sign-in flow in popup window
4. Popup should show your name/email

### Test Save Current Tab

1. Navigate to any webpage (not chrome:// pages)
2. Click extension icon
3. Click **Save current tab**
4. Should see success message

### Test Side Panel

1. Click extension icon
2. Click **Open Side Panel**
3. Side panel opens with Recall web app
4. Should be signed in (SSO via token sharing)

### Test Batch Save

1. Open multiple tabs
2. Click extension icon
3. Click **Save selected tabs**
4. Select tabs with checkboxes
5. Click **Save Selected**
6. Should see summary (created/deduplicated/failed)

---

## Development Workflow

### Hot Module Replacement

CRXJS provides HMR for extension development:

```bash
pnpm dev
```

Changes to popup and side panel React components reload automatically. Changes to service worker require extension reload.

### Manual Reload

After changing `manifest.json` or service worker:

1. Go to `chrome://extensions`
2. Click the reload icon on your extension

### View Service Worker Logs

1. Go to `chrome://extensions`
2. Click **Inspect views: service worker**
3. Opens DevTools for background script

### View Popup DevTools

1. Open popup
2. Right-click → **Inspect**

---

## Production Build

```bash
# Build for production
pnpm build

# Output in dist/ folder
# Zip dist/ for Chrome Web Store submission
```

---

## Troubleshooting

### "Extension ID changed"

- Occurs when reloading unpacked extension
- Update Entra redirect URI with new ID
- Add `key` to manifest.json for stable ID (see research.md)

### "Invalid redirect URI"

- Ensure Entra app has SPA platform with correct URI
- URI format: `https://[id].chromiumapp.org/oauth2`
- Wait 3-5 minutes after adding URI for propagation

### "Cannot access chrome:// pages"

- Expected behavior; browser internal pages are restricted
- Extension shows "Cannot save this page" message

### "Network error" on save

- Verify API is running at configured URL
- Check browser DevTools Network tab
- Verify token is attached to requests

### "Token expired"

- Extension should auto-refresh; if not, sign out and back in
- Check refresh token is stored (may need to re-consent)

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+S` (Win/Linux) | Open popup |
| `Cmd+Shift+S` (Mac) | Open popup |
| `Alt+Shift+S` (Win/Linux) | Quick save current tab |
| `Option+Shift+S` (Mac) | Quick save current tab |

Configure in `chrome://extensions/shortcuts`.

---

## Directory Structure

```
src/extension/
├── dist/                    # Build output (load this)
├── src/
│   ├── background/          # Service worker
│   ├── popup/               # Popup React app
│   ├── sidepanel/           # Side panel React app
│   ├── services/            # Shared services (auth, api)
│   ├── config/              # Environment config
│   └── types/               # TypeScript types
├── manifest.json            # Extension manifest
├── vite.config.ts           # Vite + CRXJS config
└── .env.development         # Dev environment variables
```

---

## Next Steps

After basic setup works:

1. [ ] Generate stable extension key for consistent ID
2. [ ] Create `.env.production` with production URLs
3. [ ] Test in Edge browser
4. [ ] Review Chrome Web Store requirements
5. [ ] Create extension icons (16, 32, 48, 128px)
