# Quickstart Validation Checklist

Use this checklist to validate the end-to-end External ID flow locally.

## Preconditions

- External ID tenant created and accessible
- User flow configured and enabled
- API app registration exposes `access_as_user`
- SPA app registration has redirect URIs and delegated API permission
- Local configuration present (not committed)

## Checklist

- [ ] API config set (appsettings.Development.json or user secrets)
  - `AzureAd:Instance` points to `https://<tenant>.ciamlogin.com/`
  - `AzureAd:TenantId` matches external tenant ID
  - `AzureAd:ClientId` matches API client ID
  - `AzureAd:Scopes` includes `access_as_user`
- [ ] SPA config set in `src/web/.env.local`
  - `VITE_TENANT_ID` (External ID tenant ID)
  - `VITE_CLIENT_ID` (SPA client ID)
  - `VITE_API_SCOPE` (`api://<api-client-id>/access_as_user`)
  - `VITE_API_BASE_URL` (`http://localhost:5080`)
- [ ] Start backend: `dotnet run --project src/Recall.Core.AppHost`
- [ ] Start frontend: `pnpm dev` in `src/web`
- [ ] Open `http://localhost:5173`
- [ ] Click **Sign In** and complete the External ID flow
- [ ] Confirm user info renders (UserDisplay shows name/email)
- [ ] Call `GET /api/v1/me` from app or curl and verify:
  - `sub` is present
  - `displayName` is present (if provided by IdP)
  - `email` is present (if provided by IdP)
  - `tenantId` matches External ID tenant
- [ ] Call a protected endpoint (e.g., `GET /api/v1/items`) and verify 200
- [ ] Sign out and verify protected routes require sign-in

## Notes

- If any step fails, check [docs/auth/troubleshooting.md](docs/auth/troubleshooting.md).
- Do not enable test auth bypass in production.
