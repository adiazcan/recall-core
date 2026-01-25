# Microsoft Entra External ID Setup Guide

This guide explains how to configure Microsoft Entra External ID for the Recall Core API and SPA in **development** and **production** environments.

> **Security reminder**: Never commit secrets or environment-specific values to source control.

## Prerequisites

- Azure subscription with permissions to create Entra tenants and app registrations
- Access to at least one social identity provider (Microsoft Account recommended)
- .NET 10 SDK and Node.js 22+ for local development

---

## 1) Create an External ID (Customer) Tenant

1. Open the **Azure Portal** and search for **Microsoft Entra External ID**.
2. Select **Create a new tenant** → **Customer** tenant type.
3. Provide:
   - **Organization name**
   - **Initial domain name** (e.g., `recallcoredev`)
   - **Location**
4. Create the tenant and **record the tenant domain** (e.g., `recallcoredev.onmicrosoft.com`).

---

## 2) Configure Identity Providers

### Microsoft Account (recommended)

1. In the external tenant, go to **External Identities** → **All identity providers**.
2. Enable **Microsoft Account**.

### Optional providers (Google, Facebook, Apple)

Add providers as needed. Each provider requires credentials created in their respective portals.

---

## 3) Create a Sign-up and Sign-in User Flow

1. Go to **External Identities** → **User flows** → **New user flow**.
2. Choose **Sign up and sign in**.
3. Set identity providers (Microsoft Account at minimum).
4. Select attributes to collect (recommended: **Display name**, **Email**).
5. Create the flow (e.g., `signupsignin1`).

---

## 4) Register Applications

### 4.1 API App Registration

1. **App registrations** → **New registration**.
2. Name: `Recall Core API`.
3. Supported account types: **Accounts in this organizational directory only**.
4. Register and record:
   - **API client ID**

#### Expose the API scope

1. In the API registration: **Expose an API** → **Add a scope**.
2. Use default **Application ID URI** (`api://<api-client-id>`).
3. Add scope:
   - **Scope name**: `access_as_user`
   - **Admin/User consent**: enabled

Resulting scope: `api://<api-client-id>/access_as_user`.

### 4.2 SPA App Registration

1. **App registrations** → **New registration**.
2. Name: `Recall Core SPA`.
3. Supported account types: **Accounts in this organizational directory only**.
4. **Redirect URI** (SPA):
   - Dev: `http://localhost:5173`
5. Register and record:
   - **SPA client ID**

#### Configure SPA authentication

1. In the SPA registration: **Authentication**.
2. Add redirect URIs:
   - Dev: `http://localhost:5173`
   - Optional callback route: `http://localhost:5173/auth/callback`
3. Enable **Access tokens** and **ID tokens**.
4. (Optional) Set **Front-channel logout URL** to your SPA origin.

#### Add API permissions

1. **API permissions** → **Add a permission** → **My APIs**.
2. Select **Recall Core API** → `access_as_user`.
3. (Optional) Grant admin consent.

#### Associate the SPA with the user flow

1. **External Identities** → **User flows** → select your flow.
2. **Applications** → **Add application** → select `Recall Core SPA`.

---

## 5) Local Development Configuration

### 5.1 API configuration

Use `src/Recall.Core.Api/appsettings.Development.json` **or** user secrets. Example:

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

### 5.2 SPA configuration

Create `src/web/.env.local` (do not commit):

```bash
VITE_AUTHORITY=https://<tenant-subdomain>.ciamlogin.com
VITE_CLIENT_ID=<spa-client-id>
VITE_API_SCOPE=api://<api-client-id>/access_as_user
VITE_API_BASE_URL=http://localhost:5080
```

---

## 6) Production Additions

### 6.1 Custom domain (recommended)

Set up a custom domain for your External ID tenant to avoid `ciamlogin.com` in production URLs. Follow Microsoft’s External ID guidance for custom domain setup and certificates.

### 6.2 Production redirect URIs

Add your production SPA URL(s) to the SPA registration:

- `https://app.yourdomain.com`
- `https://app.yourdomain.com/auth/callback` (if used)

### 6.3 Production configuration

Provide environment variables via your hosting platform:

- API environment:
  - `AzureAd__Instance`
  - `AzureAd__TenantId`
  - `AzureAd__ClientId`
  - `AzureAd__Scopes`

- SPA environment:
   - `VITE_AUTHORITY`
   - `VITE_CLIENT_ID`
   - `VITE_API_SCOPE`
  - `VITE_API_BASE_URL`

> Store values in a secure secrets store (CI/CD secrets, platform vaults). Never commit them to Git.

### 6.4 Consent and user flow validation

- Ensure the SPA has delegated permission to `access_as_user`.
- If you skip admin consent, validate the end-user consent prompt.

### 6.5 Monitoring

- Enable API logging and review auth failures (401/403).
- Monitor sign-in activity in Entra audit logs.

---

## 7) Smoke Test

1. Start the backend and frontend.
2. Sign in with Microsoft Account.
3. Call `GET /api/v1/me` and verify the response.

If issues occur, see the troubleshooting guide in [docs/auth/troubleshooting.md](docs/auth/troubleshooting.md).
