# Troubleshooting: External ID Authentication

This guide lists common issues encountered with Microsoft Entra External ID integration for the Recall Core API and SPA.

## Common Errors

### AADSTS50011: Reply URL mismatch

**Symptoms**: Sign-in fails with a reply URL mismatch error.

**Fix**:
- Ensure the **SPA registration** includes the exact redirect URI used by the app.
- Verify protocol, hostname, port, and trailing slash.
- Confirm `VITE_ENTRA_REDIRECT_URI` matches the registered URI.

---

### AADSTS700054: response_type 'token' not enabled

**Symptoms**: Redirect fails after sign-in.

**Fix**:
- In the SPA registration → **Authentication** → enable **Access tokens** and **ID tokens**.

---

### 401 Unauthorized from API

**Symptoms**: API endpoints return 401 after sign-in.

**Fix**:
- Ensure the access token is attached as `Authorization: Bearer <token>`.
- Verify the API `AzureAd` settings match the External ID tenant and API client ID.
- Confirm the token is for the correct tenant and audience (`aud`).
- Ensure `AzureAd:Audience` is set to the API client ID value (matches the token `aud`).

---

### IDX10214: Audience validation failed

**Symptoms**: API logs include `IDX10214: Audience validation failed` and authentication fails.

**Fix**:
- Verify the access token `aud` claim matches the API app registration.
- Set `AzureAd:Audience` to the API client ID in `appsettings.Development.json` or user secrets.
- Ensure the SPA is requesting the API scope `api://<api-client-id>/access_as_user`.

---

### 403 Forbidden from API (missing scope)

**Symptoms**: Token is valid but API responds 403.

**Fix**:
- Verify the `scp` claim includes `access_as_user`.
- Confirm the SPA app has permission to the API scope.
- If needed, grant admin consent in the tenant.

---

### Sign-in loop or blank screen

**Symptoms**: The app continuously redirects or shows a blank page.

**Fix**:
- Clear session storage to remove stale MSAL cache.
- Confirm the authority uses the External ID tenant: `https://<tenant>.ciamlogin.com`.
- Ensure `VITE_ENTRA_CLIENT_ID` is the SPA client ID (not API client ID).

---

### No user data appears after sign-in

**Symptoms**: Items/collections list is empty.

**Fix**:
- New users start with no data (expected).
- Verify `userId` is being extracted from the `sub` claim.
- Confirm you are not testing with the auth bypass header in production.

---

## Diagnostics Checklist

- External tenant exists and is active
- User flow is configured and enabled
- API registration exposes `access_as_user`
- SPA registration has correct redirect URIs
- SPA has delegated permission to API scope
- Environment variables are configured (no secrets in repo)
- API logs show auth failures with 401/403 (no tokens logged)

---

## Helpful Links

- https://learn.microsoft.com/entra/external-id/customers/
- https://learn.microsoft.com/en-us/entra/identity-platform/scenario-protected-web-api-app-registration
- https://learn.microsoft.com/en-us/entra/msal/javascript/react/getting-started
