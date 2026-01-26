# Browser Extension Development Setup

**Version**: 0.1.0 | **Last Updated**: January 2026

This guide walks you through setting up the Recall browser extension for local development.

---

## Prerequisites

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| Node.js | 20+ | JavaScript runtime | [nodejs.org](https://nodejs.org) |
| pnpm | 9+ | Package manager | `npm install -g pnpm` |
| Chrome or Edge | 116+ | Browser with MV3 sidePanel support | [chrome.com](https://chrome.com) or [edge.com](https://www.microsoft.com/edge) |
| Recall API | Running | Backend for saving items | See main project setup |
| Recall Web App | Running | Side panel content | See main project setup |

### Browser Version Requirements

The extension uses the `sidePanel.open()` API which requires:
- Chrome 116 or later
- Microsoft Edge 116 or later

Check your browser version at `chrome://version` or `edge://version`.

---

## Quick Start

### 1. Install Dependencies

```bash
cd src/extension
pnpm install
```

### 2. Configure Environment

Create `.env.development` from the example:

```bash
cp .env.example .env.development
```

Edit `.env.development` with your values:

```env
# API and Web App URLs
VITE_API_BASE_URL=http://localhost:5080/api/v1/
VITE_WEB_APP_URL=http://localhost:5173

# Entra External ID Configuration
# Get these from Azure portal or your team
VITE_AUTH_TENANT_SUBDOMAIN=your-tenant
VITE_AUTH_TENANT_ID=your-tenant-id
VITE_AUTH_CLIENT_ID=extension-client-id
VITE_AUTH_API_CLIENT_ID=api-client-id
VITE_AUTH_SCOPE=openid profile email api://api-client-id/access_as_user
```

> **Note**: Contact your team lead for auth configuration values or see [entra-configuration.md](entra-configuration.md).

### 3. Start Development Server

```bash
pnpm dev
```

This builds the extension to `dist/` with hot module replacement enabled.

### 4. Load Extension in Browser

**Chrome:**
1. Navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select `src/extension/dist`

**Edge:**
1. Navigate to `edge://extensions`
2. Enable **Developer mode** (toggle in left sidebar)
3. Click **Load unpacked**
4. Select `src/extension/dist`

### 5. Start Backend Services

In a separate terminal:

```bash
cd src
dotnet run --project Recall.Core.AppHost
```

Wait for:
- API at `http://localhost:5080`
- Web app at `http://localhost:5173`

---

## Development Workflow

### Hot Module Replacement

CRXJS provides HMR for extension development:
- **Popup & Side Panel**: Changes reload automatically
- **Service Worker**: Requires manual extension reload
- **Manifest.json**: Requires manual extension reload

### Viewing Logs

**Service Worker Logs:**
1. Go to `chrome://extensions`
2. Find Recall extension
3. Click **Inspect views: service worker**

**Popup DevTools:**
1. Open the popup
2. Right-click anywhere → **Inspect**

**Side Panel DevTools:**
1. Open the side panel
2. Right-click → **Inspect**

### Reloading the Extension

After changing `manifest.json` or service worker:
1. Go to `chrome://extensions`
2. Click the refresh icon (↻) on your extension

---

## Project Structure

```
src/extension/
├── dist/                    # Build output (load this in browser)
├── src/
│   ├── background/          # Service worker
│   │   └── service-worker.ts
│   ├── popup/               # Popup UI (React)
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── Popup.tsx
│   │   └── components/
│   ├── sidepanel/           # Side panel UI (React)
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── SidePanel.tsx
│   ├── services/            # Shared services
│   │   ├── auth.ts          # Authentication
│   │   ├── api.ts           # API client
│   │   ├── storage.ts       # Chrome storage
│   │   └── messaging.ts     # Runtime messaging
│   ├── config/              # Environment config
│   │   └── index.ts
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   └── assets/              # Icons
├── tests/                   # Unit tests
│   ├── setup.ts             # Chrome API mocks
│   └── services/
├── manifest.json            # Extension manifest (MV3)
├── vite.config.ts           # Vite + CRXJS config
├── vitest.config.ts         # Test config
├── tsconfig.json            # TypeScript config
├── .env.development         # Dev environment
├── .env.production          # Production environment
└── package.json
```

---

## Build Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Development build with HMR |
| `pnpm build` | Production build |
| `pnpm test` | Run unit tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | Lint code |
| `pnpm type-check` | TypeScript type checking |

---

## Production Build

```bash
pnpm build
```

The production build outputs to `dist/`. To submit to the Chrome Web Store:

1. Zip the `dist/` folder
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Upload the zip file

---

## Troubleshooting

### Extension ID Changes

**Problem**: Extension ID changes when reloading unpacked extension.

**Solution**: Add a stable key to `manifest.json`:

```json
{
  "key": "YOUR_STABLE_KEY_HERE"
}
```

See [entra-configuration.md](entra-configuration.md) for generating a stable key.

### "Cannot read manifest" Error

**Problem**: Chrome shows error loading extension.

**Solution**: Ensure you're loading the `dist/` folder, not the root `src/extension/` folder.

### Authentication Not Working

**Problem**: Sign-in fails or token errors.

**Checklist**:
1. Verify `.env.development` has correct values
2. Check extension ID in `chrome://extensions`
3. Verify Entra app has redirect URI: `https://{extension-id}.chromiumapp.org/oauth2`
4. Wait 3-5 minutes after adding redirect URI

### API Requests Failing

**Problem**: Network errors when saving items.

**Checklist**:
1. Verify API is running at `http://localhost:5080`
2. Check browser DevTools Network tab
3. Verify token is attached (Authorization header)
4. Check CORS settings in API

### Side Panel Not Opening

**Problem**: "Open Side Panel" does nothing.

**Solution**: The browser may require user interaction first. Try clicking the extension icon, then the button.

---

## Keyboard Shortcuts

Default shortcuts (configurable in `chrome://extensions/shortcuts`):

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+S` | Quick save current tab |
| Click extension icon | Open popup |

---

## Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# With coverage
pnpm test:coverage
```

### Manual Testing

See [testing-checklist.md](testing-checklist.md) for the manual testing checklist.

---

## Additional Resources

- [Entra App Registration Guide](entra-configuration.md)
- [Manual Testing Checklist](testing-checklist.md)
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [CRXJS Vite Plugin](https://crxjs.dev/vite-plugin)
