# Entra External ID Configuration for Browser Extension

**Version**: 0.1.0 | **Last Updated**: January 2026

This guide explains how to configure Microsoft Entra External ID for the Recall browser extension OAuth authentication.

---

## Overview

The browser extension uses **OAuth 2.0 Authorization Code Flow with PKCE** to authenticate users via Microsoft Entra External ID. This requires:

1. An app registration in Entra for the extension
2. A redirect URI using the extension's unique ID
3. API permissions to access the Recall API

---

## Prerequisites

- Microsoft Entra admin center access
- Existing Recall API app registration (for API permissions)
- Extension loaded in browser to get extension ID

---

## Getting Extension ID

Before configuring Entra, you need your extension's ID:

1. Load the extension in Chrome/Edge (see [setup.md](setup.md))
2. Go to `chrome://extensions` or `edge://extensions`
3. Find "Recall - Save & Organize"
4. Copy the **ID** (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

> **Note**: The extension ID changes each time you load an unpacked extension unless you use a stable key. See [Generating a Stable Extension Key](#generating-a-stable-extension-key) below.

---

## App Registration Setup

### Option A: Use Existing Web App Registration

If you already have a Recall web app registration, you can add the extension redirect URI:

1. Navigate to [Entra admin center](https://entra.microsoft.com)
2. Go to **Identity** → **Applications** → **App registrations**
3. Select your existing Recall app
4. Go to **Authentication** → **Add a platform**
5. Select **Single-page application**
6. Add redirect URI: `https://{extension-id}.chromiumapp.org/oauth2`
7. Click **Configure**

### Option B: Create New Registration (Recommended for Production)

For production, create a separate registration:

1. Navigate to [Entra admin center](https://entra.microsoft.com)
2. Go to **Identity** → **Applications** → **App registrations**
3. Click **New registration**

**Configure the registration:**

| Field | Value |
|-------|-------|
| Name | `Recall Browser Extension` |
| Supported account types | Accounts in any organizational directory and personal Microsoft accounts |
| Redirect URI | Skip for now |

4. Click **Register**
5. Note the **Application (client) ID** - this is your `VITE_AUTH_CLIENT_ID`

### Add Redirect URI

1. Go to **Authentication** → **Add a platform** → **Single-page application**
2. Add redirect URI: `https://{extension-id}.chromiumapp.org/oauth2`
3. Enable **Access tokens** and **ID tokens** under Implicit grant
4. Click **Configure**

### Configure API Permissions

1. Go to **API permissions** → **Add a permission**
2. Select **My APIs** tab
3. Select your Recall API registration
4. Select **Delegated permissions**
5. Check `access_as_user`
6. Click **Add permissions**
7. Click **Grant admin consent for {tenant}** (requires admin)

---

## Environment Configuration

Update your `.env.development` with the values from Entra:

```env
# Entra External ID Configuration
VITE_AUTH_TENANT_SUBDOMAIN=your-tenant-name
VITE_AUTH_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_AUTH_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_AUTH_API_CLIENT_ID=yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
VITE_AUTH_SCOPE=openid profile email api://yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy/access_as_user
```

**Where to find these values:**

| Variable | Location |
|----------|----------|
| `VITE_AUTH_TENANT_SUBDOMAIN` | Entra admin center → Tenant overview → Primary domain (before `.ciamlogin.com`) |
| `VITE_AUTH_TENANT_ID` | Entra admin center → Tenant overview → Tenant ID |
| `VITE_AUTH_CLIENT_ID` | Extension app registration → Overview → Application (client) ID |
| `VITE_AUTH_API_CLIENT_ID` | API app registration → Overview → Application (client) ID |
| `VITE_AUTH_SCOPE` | API app registration → Expose an API → Application ID URI + scope |

---

## Generating a Stable Extension Key

By default, Chrome assigns a new ID each time you load an unpacked extension. To keep a consistent ID:

### Generate the Key

```bash
# Generate a 2048-bit RSA key
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out extension.pem

# Generate the public key in CRX format
openssl rsa -in extension.pem -pubout -outform DER | openssl base64 -A
```

### Add to manifest.json

Add the base64 output as the `key` field in `manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Recall - Save & Organize",
  "key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A..."
}
```

### Calculate the Extension ID

The extension ID is derived from the key. You can verify it:

```bash
# Calculate extension ID from the key
openssl rsa -in extension.pem -pubout -outform DER 2>/dev/null | openssl dgst -sha256 -binary | head -c 16 | xxd -p | tr '0-9a-f' 'a-p'
```

### Security Note

- **Never commit** `extension.pem` to version control
- Store securely (e.g., secrets manager, secure file storage)
- The `key` field in manifest is public and safe to commit

---

## Authority URL Format

For Entra External ID (CIAM), the authority URL format is:

```
https://{tenant-subdomain}.ciamlogin.com/{tenant-id}
```

This differs from standard Entra ID which uses `login.microsoftonline.com`.

**Example:**
- Tenant subdomain: `recall-dev`
- Tenant ID: `12345678-1234-1234-1234-123456789012`
- Authority: `https://recall-dev.ciamlogin.com/12345678-1234-1234-1234-123456789012`

---

## Token Flow

The extension authentication flow:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Browser Extension                             │
├─────────────────────────────────────────────────────────────────┤
│ 1. User clicks "Sign In"                                        │
│ 2. Extension generates PKCE code_verifier and code_challenge    │
│ 3. Extension calls chrome.identity.launchWebAuthFlow            │
│    with authorization URL                                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Entra External ID                             │
├─────────────────────────────────────────────────────────────────┤
│ 4. User sees sign-in page in popup window                       │
│ 5. User authenticates (username/password, MFA, etc.)            │
│ 6. Entra redirects to extension redirect URI with auth code     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Browser Extension                             │
├─────────────────────────────────────────────────────────────────┤
│ 7. Extension extracts auth code from redirect URL               │
│ 8. Extension exchanges code for tokens (with code_verifier)     │
│ 9. Extension stores tokens in chrome.storage.local              │
│ 10. Extension uses access_token for API calls                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Token Refresh

The extension automatically refreshes tokens:

1. Before each API call, check if token expires within 5 minutes
2. If expiring, use refresh_token to get new access_token
3. If refresh fails (e.g., refresh token expired), prompt user to sign in again

---

## Troubleshooting

### "Invalid redirect_uri" Error

**Cause**: Entra doesn't recognize the redirect URI.

**Solutions**:
1. Verify the extension ID matches the redirect URI
2. Wait 3-5 minutes after adding redirect URI (propagation delay)
3. Check for typos in the URI format
4. Ensure platform is "Single-page application" not "Web"

### "AADSTS50011: Reply URL mismatch"

**Cause**: The redirect URI in the auth request doesn't match Entra configuration.

**Solutions**:
1. Check `chrome.identity.getRedirectURL()` returns correct URL
2. Update Entra redirect URI to match
3. Use stable extension key for consistent ID

### "AADSTS65001: Consent required"

**Cause**: Admin consent not granted for API permissions.

**Solutions**:
1. Go to API permissions in Entra
2. Click "Grant admin consent for {tenant}"
3. Or have tenant admin grant consent

### "Token refresh failed"

**Cause**: Refresh token expired or revoked.

**Solutions**:
1. User must sign in again
2. Refresh tokens typically expire after 90 days of inactivity
3. Check if user's session was terminated in Entra

### Cross-Origin Issues

**Cause**: CORS blocking token endpoint requests.

**Note**: Extensions make requests from the service worker, which isn't subject to CORS. If you see CORS errors:
1. Ensure requests go through service worker, not content scripts
2. Check `host_permissions` in manifest.json includes Entra domains

---

## Security Best Practices

1. **Use PKCE**: Always use code_challenge/code_verifier (extension does this automatically)
2. **No client secrets**: Browser extensions cannot securely store secrets; use public client flow
3. **Minimum scopes**: Only request necessary permissions
4. **Token storage**: Use `chrome.storage.local` (not localStorage)
5. **Token logging**: Never log tokens; use sanitized logging
6. **HTTPS only**: All auth endpoints use HTTPS

---

## Production Checklist

Before publishing to Chrome Web Store:

- [ ] Use stable extension key for consistent ID
- [ ] Create production app registration (separate from dev)
- [ ] Configure production redirect URI
- [ ] Set up `.env.production` with production values
- [ ] Test full auth flow with production configuration
- [ ] Review API permissions (minimum required)
- [ ] Verify consent is granted for production tenant
