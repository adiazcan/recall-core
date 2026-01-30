# Infrastructure Runbook

## Deploy Infrastructure
### Manual (CLI)
Follow specs/007-infra-azure/quickstart.md for what-if and deployment steps.

### GitHub Actions
Use the Deploy Infrastructure workflow:
- .github/workflows/infra-deploy.yml

## Deploy API
- Build/push image to ACR
- Update Container App image
- Verify `/health`

## Deploy Enrichment Job
- Build/push image to ACR
- Update Container Apps Job image
- Send a test queue message and verify job executions

## Deploy Frontend
- Build the frontend
- Deploy to Static Web Apps using the deployment token
- Validate `/api` routing (prod linked backend)

## Secrets & Configuration
- DocumentDB admin password is supplied at deployment time
- Connection string stored in Key Vault as DocumentDbConnectionString
- App Configuration stores non-secret settings

## Operational Checks
- API health: `GET /health`
- Logs: Container Apps logs in Log Analytics
- Traces: Application Insights within ~5 minutes

## Incident Response
### Rollback API
- Re-deploy the previous image tag to the Container App

### Rollback Enrichment Job
- Re-deploy the previous image tag to the Container Apps Job

### Rollback Frontend
- Re-deploy the prior frontend build to Static Web Apps

## Troubleshooting
- If API won’t start: inspect container logs, verify Key Vault access, check image tag
- If queue jobs don’t run: verify queue trigger config and managed identity roles
- If SWA routing fails: confirm linked backend (prod) or CORS fallback (dev)

## Decommission
- Delete the environment resource group to remove all resources

## References
- specs/007-infra-azure/quickstart.md
- docs/infra/overview.md
- docs/infra/cost.md
