# Research: Microsoft Entra External ID Authentication

**Feature**: 004-entra-external-auth  
**Date**: 2026-01-24

## Overview

This document consolidates research findings for implementing Microsoft Entra External ID authentication with social-only providers, JWT Bearer API protection, and per-user data partitioning.

---

## Decision 1: External ID Tenant Type

**Decision**: Use Microsoft Entra External ID in an **external tenant** (Customers configuration)

**Rationale**:
- External tenants are designed specifically for customer-facing applications (CIAM)
- Supports self-service sign-up with customizable user flows
- Enables social identity provider federation (Microsoft Account, Google, Facebook, Apple)
- Separate from workforce tenant, isolating customer identities
- Uses dedicated authority endpoint: `https://<tenant-subdomain>.ciamlogin.com/`

**Alternatives Considered**:
- **Azure AD B2C**: More complex setup, being superseded by External ID for new projects
- **Workforce tenant with guest accounts**: Not suitable for customer scenarios; designed for B2B collaboration

**References**:
- [External ID Overview](https://learn.microsoft.com/en-us/entra/external-id/external-identities-overview)
- [External ID for Customers](https://learn.microsoft.com/en-us/entra/external-id/customers/overview-customers-ciam)

---

## Decision 2: User Flow Configuration

**Decision**: Create a "Sign-up and Sign-in" user flow with social-only authentication

**Rationale**:
- Combined user flow handles both new user registration and returning user sign-in
- Social-only configuration satisfies FR-003 (no local accounts/passwords)
- Microsoft Account enabled as the primary social provider (FR-004)
- Additional social providers (Google, Facebook) can be added later (FR-005)
- User flow can collect custom attributes during sign-up if needed

**Configuration Details**:
- User flow type: "Sign up and sign in"
- Identity providers: Microsoft Account only (disable Email accounts)
- Attributes to collect: Display name (built-in), Email (from social provider)
- Token configuration: Include `sub`, `name`, `email` claims in access token

**Alternatives Considered**:
- **Email with password**: Violates social-only requirement
- **Email one-time passcode**: Violates social-only requirement; still requires email input

**References**:
- [Create Sign-up and Sign-in User Flow](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-user-flow-sign-up-sign-in-customers)
- [Identity Providers for External Tenants](https://learn.microsoft.com/en-us/entra/external-id/customers/concept-authentication-methods-customers)

---

## Decision 3: App Registrations

**Decision**: Two separate app registrations - one for the API, one for the SPA

**Rationale**:
- Separation of concerns: API exposed as resource, SPA as client
- API registration exposes delegated scope (`access_as_user`) for permission model
- SPA registration configured with SPA platform redirect URI for MSAL
- Follows OAuth 2.0 best practices for resource/client separation

**API Registration**:
- Application ID URI: `api://<api-client-id>`
- Exposed scopes: `api://<api-client-id>/access_as_user` (delegated)
- No redirect URIs needed

**SPA Registration**:
- Platform: Single-page application
- Redirect URIs: `http://localhost:5173` (development), production URI later
- API permissions: Request `api://<api-client-id>/access_as_user`
- Grant admin consent for the delegated scope

**Alternatives Considered**:
- **Single app registration**: More complex configuration; harder to manage permissions; not recommended for resource/client split

**References**:
- [Register Web API](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-protected-web-api-app-registration)
- [Register SPA](https://learn.microsoft.com/en-us/entra/identity-platform/tutorial-single-page-app-react-prepare-app)

---

## Decision 4: Backend JWT Validation Library

**Decision**: Use `Microsoft.Identity.Web` with `AddMicrosoftIdentityWebApi`

**Rationale**:
- Official Microsoft library for validating tokens from Microsoft identity platform
- Integrates seamlessly with ASP.NET Core authentication pipeline
- Handles token validation, issuer verification, and audience checking
- Supports External ID tenant configuration
- Built-in support for scope validation via `RequireScope` or policy-based authorization

**Implementation Pattern**:
```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("RequireApiScope", policy =>
        policy.RequireClaim("scp", "access_as_user"));

// In endpoints:
app.MapGet("/api/v1/items", ...).RequireAuthorization("RequireApiScope");
```

**Configuration** (`appsettings.json`):
```json
{
  "AzureAd": {
    "Instance": "https://<tenant-subdomain>.ciamlogin.com/",
    "TenantId": "<external-tenant-id>",
    "ClientId": "<api-client-id>",
    "Audience": "api://<api-client-id>"
  }
}
```

**Alternatives Considered**:
- **Plain JwtBearer with manual configuration**: Requires manual issuer/audience setup; more error-prone
- **IdentityServer**: Overkill for External ID; not needed when using Microsoft identity platform

**References**:
- [Protected Web API Configuration](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-protected-web-api-app-configuration)
- [Microsoft.Identity.Web](https://learn.microsoft.com/en-us/entra/msal/javascript/)

---

## Decision 5: Scope Enforcement Strategy

**Decision**: Policy-based authorization with `scp` claim validation

**Rationale**:
- External ID tokens include scopes in the `scp` claim (space-delimited string)
- Policy-based approach centralizes authorization logic
- `RequireClaim("scp", "access_as_user")` validates presence of required scope
- Returns 401 for missing/invalid token, 403 for valid token without required scope

**Implementation**:
```csharp
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("ApiScope", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireClaim("scp", "access_as_user");
    });

// Apply to all protected endpoints
app.MapGroup("/api/v1")
    .RequireAuthorization("ApiScope");
```

**Alternatives Considered**:
- **Per-endpoint manual checks**: More repetitive; easier to miss enforcement
- **RequireScope extension**: Works but policy-based is more explicit and testable

---

## Decision 6: User Identity Claim Source

**Decision**: Use `sub` (subject) claim as stable user identifier

**Rationale**:
- The `sub` claim is a stable, unique identifier for the user within the tenant
- Persists across token refreshes and sign-in sessions
- Recommended by Microsoft for user identification
- Format: GUID string (e.g., `aaaabbbb-cccc-dddd-1111-222233334444`)

**Claim Extraction**:
```csharp
string userId = User.FindFirstValue(ClaimTypes.NameIdentifier) 
    ?? User.FindFirstValue("sub") 
    ?? throw new UnauthorizedException();
```

**Alternatives Considered**:
- **oid (object ID)**: Also stable but `sub` is more portable across token types
- **email**: Not stable; users can change email; null for some social providers
- **name**: Definitely not unique

**References**:
- [ID Token Claims](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference)

---

## Decision 7: Frontend Authentication Library

**Decision**: Use `@azure/msal-react` with `@azure/msal-browser`

**Rationale**:
- Official MSAL library for React applications
- Provides React-specific hooks (`useMsal`, `useAccount`, `useIsAuthenticated`)
- Supports External ID authority format (`ciamlogin.com`)
- Handles silent token refresh automatically
- Provides `MsalProvider` for context and `AuthenticatedTemplate`/`UnauthenticatedTemplate` components

**Configuration** (`authConfig.ts`):
```typescript
import { LogLevel, PublicClientApplication } from '@azure/msal-browser';

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID,
    authority: `https://${import.meta.env.VITE_TENANT_SUBDOMAIN}.ciamlogin.com/`,
    redirectUri: '/',
    postLogoutRedirectUri: '/',
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: [`api://${import.meta.env.VITE_API_CLIENT_ID}/access_as_user`],
};
```

**Token Acquisition Pattern**:
```typescript
const { instance, accounts } = useMsal();

const getAccessToken = async () => {
  try {
    const response = await instance.acquireTokenSilent({
      scopes: [`api://${API_CLIENT_ID}/access_as_user`],
      account: accounts[0],
    });
    return response.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await instance.acquireTokenRedirect({ scopes: [...] });
    }
    throw error;
  }
};
```

**Alternatives Considered**:
- **react-aad-msal**: Deprecated; migration to `@azure/msal-react` recommended
- **Custom OAuth implementation**: Unnecessary complexity; MSAL handles edge cases

**References**:
- [MSAL React Getting Started](https://learn.microsoft.com/en-us/entra/msal/javascript/react/getting-started)
- [MSAL React Hooks](https://learn.microsoft.com/en-us/entra/msal/javascript/react/hooks)

---

## Decision 8: Data Partitioning Strategy

**Decision**: Add `userId` field to all user-owned entities; filter all queries by userId

**Rationale**:
- Simple, effective approach for user isolation
- No schema migration needed; add field to existing entities
- MongoDB supports adding fields without downtime
- Compound indexes enable efficient userId-scoped queries
- Pre-existing records without userId treated as orphaned (FR-022a)

**Entity Changes**:
```csharp
// Item.cs, Collection.cs
[BsonElement("userId")]
public string? UserId { get; set; }
```

**Index Strategy**:
```javascript
// Replace existing indexes with userId-prefixed compound indexes
{ "userId": 1, "normalizedUrl": 1 }  // unique per user for dedup
{ "userId": 1, "createdAt": -1, "_id": -1 }  // pagination
{ "userId": 1, "status": 1, "createdAt": -1 }  // filter by status
```

**Query Pattern**:
```csharp
// All reads filter by userId
var items = await collection.Find(x => x.UserId == userId && x.Status == status);

// All creates set userId
item.UserId = userId;

// All updates/deletes include userId in filter (returns 404 if not found)
var result = await collection.UpdateOneAsync(
    x => x.Id == id && x.UserId == userId, update);
```

**Alternatives Considered**:
- **Separate collections per user**: Complex; would require dynamic collection names
- **Row-level security at DB level**: MongoDB doesn't support RLS natively
- **Encryption per user**: Adds complexity without isolation benefit for single-tenant MongoDB

---

## Decision 9: Test Authentication Bypass

**Decision**: Environment-based test bypass controlled via configuration

**Rationale**:
- FR-036a requires automated tests to bypass auth without manual token acquisition
- Test-only configuration that MUST NOT be available in production
- Use a separate authentication scheme for tests that accepts a test header

**Implementation**:
```csharp
// In Program.cs
if (builder.Environment.IsDevelopment() && builder.Configuration.GetValue<bool>("Auth:AllowTestBypass"))
{
    builder.Services.AddAuthentication()
        .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("Test", null);
}

// TestAuthHandler creates ClaimsPrincipal from X-Test-UserId header
```

**Alternatives Considered**:
- **Mock IAuthenticationService**: More invasive; harder to maintain
- **Test tokens from External ID**: Requires network calls; flaky in CI
- **Disable auth entirely in tests**: Loses ability to test userId behavior

---

## Decision 10: Refresh Token Lifetime

**Decision**: Configure 7-day refresh token lifetime (FR-004a)

**Rationale**:
- Maximizes user convenience for consumer app
- Standard for consumer-facing applications
- Reduces sign-in friction for returning users
- Configured in External ID tenant token settings

**Configuration** (External ID Admin Center):
- Browse to App registrations → Token configuration
- Set refresh token inactivity timeout to 7 days
- Access token lifetime: 1 hour (default, cannot be extended)

**Alternatives Considered**:
- **Default settings (90 days)**: Too long; potential security concern
- **24 hours**: Too short; users would need to re-authenticate frequently

---

## Security Considerations

### Token Validation
- Validate issuer against External ID tenant
- Validate audience matches API registration
- Allow 5-minute clock skew tolerance (standard)
- Reject expired tokens

### CORS
- Continue restricting to localhost origins in development
- Production will need explicit allowed origins

### Secrets Management
- No client secrets for SPA (public client)
- API client ID not sensitive (public)
- External ID tenant subdomain not sensitive (public)
- Social provider credentials configured in External ID admin center (not in app code)

### Logging
- Log auth failures (401/403) for security monitoring
- Log sign-in/sign-out events
- Never log tokens or claims values containing PII

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Pre-existing records without userId? | Orphaned; inaccessible until manually migrated (FR-022a) |
| Token refresh strategy? | Silent refresh in background; prompt only when interaction required (FR-031a) |
| Session lifetime? | 7-day refresh token (FR-004a) |
| Auth event logging? | Log failures + sign-in/sign-out only (FR-014a) |
| Test authentication? | Test-only bypass via configuration (FR-036a) |
