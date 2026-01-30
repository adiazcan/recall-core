# Static Web Apps CORS Fallback (Dev)

## Why this is needed

The dev environment uses the **Free** Static Web Apps SKU, which does **not** support linked backends. That means `/api/*` calls from the frontend are sent directly to the API Container App and must pass CORS.

## Recommended dev approach

1. **Use the direct API URL in the frontend**
   - Set `VITE_API_BASE_URL` to the API HTTPS endpoint (the Container App FQDN).

2. **Allow the SWA hostname in API CORS (dev only)**
   - The API CORS policy is intentionally restricted to loopback origins by default.
   - For dev testing, temporarily add the SWA hostname (e.g., `https://swa-recall-dev.azurestaticapps.net`) to the allowed origins.
   - Keep this dev-only and remove it for production.

## Notes

- This fallback is only for **dev**. Production uses Standard SWA with a linked backend, so CORS is not required for `/api/*` calls.
- If you don’t want to loosen CORS, an alternative is to run the frontend locally and call the API using a loopback origin.
