# Quickstart: Microsoft Entra External ID Setup

**Feature**: 004-entra-external-auth  
**Date**: 2026-01-24

This guide walks through setting up Microsoft Entra External ID for customer self-service authentication with social providers.

## Prerequisites

- Azure subscription with ability to create Entra tenants
- Admin access to create app registrations
- Local development environment with .NET 10 SDK and Node.js 22+
- Access to at least one social identity provider (Microsoft Account recommended for testing)

---

## Part 1: Create External ID Tenant

### 1.1 Create the External Tenant

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Search for **Microsoft Entra External ID**
3. Select **Overview** → **Create a new tenant**
4. Choose **Customer** tenant type (External ID)
5. Fill in:
   - **Organization name**: `Recall Dev` (or your org name)
   - **Initial domain name**: `recalldev` (must be globally unique)
   - **Location**: Select your region (cannot be changed later)
6. Click **Create**

**Important**: Note your tenant domain: `recalldev.onmicrosoft.com`

### 1.2 Configure the External Tenant

1. Switch to the new external tenant (click your profile → Switch directory)
2. Navigate to **External Identities** → **External collaboration settings**
3. Under **Guest user access**, configure as appropriate for your scenario

---

## Part 2: Configure Social Identity Providers

### 2.1 Enable Microsoft Account (Recommended for Testing)

1. In your external tenant, go to **External Identities** → **All identity providers**
2. Select **Microsoft Account**
3. Toggle **Enabled** to On
4. Save

> **Note**: Microsoft Account is built-in and requires no additional configuration.

### 2.2 (Optional) Add Additional Providers

For Google:
1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com)
2. In External ID tenant, go to **External Identities** → **All identity providers**
3. Select **Google**
4. Enter Client ID and Client Secret
5. Save

For GitHub, Facebook, or Apple - follow similar pattern with respective developer portals.

---

## Part 3: Create User Flow

### 3.1 Create Sign-up and Sign-in User Flow

1. In your external tenant, go to **External Identities** → **User flows**
2. Click **+ New user flow**
3. Select **Sign up and sign in**
4. Name: `signupsignin1` (or descriptive name)
5. Configure:
   - **Identity providers**: Select your enabled providers (e.g., Microsoft Account)
   - **User attributes**: Select attributes to collect (recommended: Display Name, Email Address)
6. Click **Create**

### 3.2 Configure Branding (Optional)

1. Go to **Company branding** in your external tenant
2. Configure logo, background, and colors as desired

---

## Part 4: Register Applications

### 4.1 Register the API Application

1. In your external tenant, go to **App registrations** → **+ New registration**
2. Fill in:
   - **Name**: `Recall Core API`
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: Leave blank (API doesn't need redirect)
3. Click **Register**

**Note the Application (client) ID**: `<api-client-id>`

#### 4.1.1 Expose an API Scope

1. In the API app registration, go to **Expose an API**
2. Click **+ Add a scope**
3. Set **Application ID URI** if prompted (accept default: `api://<api-client-id>`)
4. Configure the scope:
   - **Scope name**: `access_as_user`
   - **Who can consent**: Admins and users
   - **Admin consent display name**: Access Recall API as user
   - **Admin consent description**: Allows the app to access the Recall API on behalf of the signed-in user.
   - **User consent display name**: Access your Recall data
   - **User consent description**: Allow the application to access your saved items and collections.
   - **State**: Enabled
5. Click **Add scope**

**Full scope URI**: `api://<api-client-id>/access_as_user`

### 4.2 Register the SPA Application

1. Go to **App registrations** → **+ New registration**
2. Fill in:
   - **Name**: `Recall Core SPA`
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: 
     - Platform: **Single-page application (SPA)**
     - URI: `http://localhost:5173` (Vite dev server)
3. Click **Register**

**Note the Application (client) ID**: `<spa-client-id>`

#### 4.2.1 Add Additional Redirect URIs

1. In the SPA app registration, go to **Authentication**
2. Under **Single-page application** redirect URIs, add:
   - `http://localhost:5173/auth/callback` (if using callback route)
3. Under **Front-channel logout URL**, optionally add: `http://localhost:5173`
4. Ensure **Access tokens** and **ID tokens** checkboxes are selected
5. Click **Save**

#### 4.2.2 Configure API Permissions

1. Go to **API permissions** → **+ Add a permission**
2. Select **My APIs** tab
3. Select **Recall Core API**
4. Check `access_as_user` under Delegated permissions
5. Click **Add permissions**
6. (Optional) Click **Grant admin consent for [tenant]** if you want pre-consent

#### 4.2.3 Associate with User Flow

1. In the SPA app registration, go to **Authentication**
2. Under **Advanced settings**, find **Enable the following mobile and desktop flows** - leave as No
3. Go to **External Identities** → **User flows**
4. Select your user flow (`signupsignin1`)
5. Under **Applications**, click **+ Add application**
6. Select `Recall Core SPA`
7. Click **Select**

---

## Part 5: Local Development Configuration

### 5.1 API Configuration (appsettings.Development.json)

Add the following to `src/Recall.Core.Api/appsettings.Development.json`:

```json
{
  "AzureAd": {
    "Instance": "https://<tenant-name>.ciamlogin.com/",
    "TenantId": "<external-tenant-id>",
    "ClientId": "<api-client-id>",
    "Scopes": "access_as_user"
  }
}
```

Replace:
- `<tenant-name>`: Your external tenant name (e.g., `recallcoredev`)
- `<external-tenant-id>`: Your external tenant ID (GUID from Azure Portal → Overview)
- `<api-client-id>`: The API app registration client ID

**Example** (with placeholder values):
```json
{
  "AzureAd": {
    "Instance": "https://recallcoredev.ciamlogin.com/",
    "TenantId": "11112222-3333-4444-5555-666677778888",
    "ClientId": "aaaabbbb-cccc-dddd-eeee-ffffffffffff",
    "Scopes": "access_as_user"
  }
}
```

### 5.2 SPA Configuration (.env.local)

Create `src/web/.env.local` with:

```bash
# Microsoft Entra External ID Configuration
VITE_ENTRA_CLIENT_ID=<spa-client-id>
VITE_ENTRA_AUTHORITY=https://<tenant-name>.ciamlogin.com
VITE_ENTRA_REDIRECT_URI=http://localhost:5173
VITE_ENTRA_API_SCOPE=api://<api-client-id>/access_as_user

# API Base URL (from existing config)
VITE_API_BASE_URL=http://localhost:5080
```

Replace placeholders with your values from app registrations.

**Example** (with placeholder values):
```bash
VITE_ENTRA_CLIENT_ID=99998888-7777-6666-5555-444433332222
VITE_ENTRA_AUTHORITY=https://recallcoredev.ciamlogin.com
VITE_ENTRA_REDIRECT_URI=http://localhost:5173
VITE_ENTRA_API_SCOPE=api://aaaabbbb-cccc-dddd-eeee-ffffffffffff/access_as_user
VITE_API_BASE_URL=http://localhost:5080
```

> **Important**: Never commit `.env.local` to source control. It should be in `.gitignore`.

### 5.3 User Secrets (Alternative for API)

For additional security, use .NET User Secrets instead of appsettings:

```bash
cd src/Recall.Core.Api
dotnet user-secrets init
dotnet user-secrets set "AzureAd:Instance" "https://recallcoredev.ciamlogin.com/"
dotnet user-secrets set "AzureAd:TenantId" "<external-tenant-id>"
dotnet user-secrets set "AzureAd:ClientId" "<api-client-id>"
dotnet user-secrets set "AzureAd:Scopes" "access_as_user"
```

---

## Part 6: Running Locally

### 6.1 Start the Backend

```bash
# From repository root
cd src
dotnet run --project Recall.Core.AppHost
```

The API will be available at `http://localhost:5080`.

### 6.2 Start the Frontend

```bash
cd src/web
pnpm install
pnpm dev
```

The SPA will be available at `http://localhost:5173`.

### 6.3 Test Authentication Flow

1. Open `http://localhost:5173` in your browser
2. Click **Sign In**
3. You should be redirected to the External ID sign-in page
4. Sign in with Microsoft Account (or other configured provider)
5. After successful authentication, you should be redirected back to the app
6. The app should now be able to call authenticated API endpoints

---

## Part 7: Testing with cURL

### 7.1 Get a Test Token

For testing API endpoints directly, you can obtain a token using the browser developer tools:

1. Sign in to the SPA
2. Open browser DevTools → Application → Session Storage
3. Find the MSAL token cache entry
4. Copy the `access_token` value

### 7.2 Call Authenticated Endpoints

```bash
# Get current user info
curl -H "Authorization: Bearer <access_token>" \
  http://localhost:5080/api/v1/me

# List items
curl -H "Authorization: Bearer <access_token>" \
  http://localhost:5080/api/v1/items

# Create an item
curl -X POST \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article"}' \
  http://localhost:5080/api/v1/items
```

### 7.3 Test Bypass for Unit Tests

For integration tests, configure test bypass mode. In test configuration:

```json
{
  "Authentication": {
    "TestMode": true
  }
}
```

Then use the `X-Test-UserId` header:

```bash
curl -H "X-Test-UserId: test-user-123" \
  http://localhost:5080/api/v1/items
```

> **Warning**: Test mode should NEVER be enabled in production.

---

## Part 8: Troubleshooting

### Common Issues

#### "AADSTS50011: The reply URL specified in the request does not match"
- Verify redirect URI in Azure Portal matches exactly (including trailing slash if any)
- Check that you're using `http://localhost:5173` not `https://`

#### "AADSTS700054: response_type 'token' is not enabled"
- Go to SPA app registration → Authentication
- Ensure "Access tokens" and "ID tokens" are checked

#### "401 Unauthorized" on API calls
- Verify the access token includes the `scp` claim with `access_as_user`
- Check that the API app registration has the scope exposed
- Verify tenant ID and client ID match in API configuration

#### "User not found" or empty results
- New users won't have existing data
- Check that userId is being correctly extracted from the `sub` claim
- Verify the user completed sign-up flow (not just sign-in attempt)

### Useful Links

- [External ID Documentation](https://learn.microsoft.com/entra/external-id/customers/)
- [MSAL React Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-react)
- [Microsoft.Identity.Web Documentation](https://github.com/AzureAD/microsoft-identity-web)

---

## Checklist Before Implementation

- [ ] External tenant created and accessible
- [ ] At least one social provider enabled (Microsoft Account)
- [ ] User flow created and tested in Azure Portal
- [ ] API app registered with `access_as_user` scope exposed
- [ ] SPA app registered with correct redirect URIs
- [ ] SPA app has API permission for the scope
- [ ] API appsettings.Development.json configured (not committed)
- [ ] SPA .env.local created (not committed)
- [ ] Both apps run locally without errors
- [ ] Test sign-in flow works end-to-end
