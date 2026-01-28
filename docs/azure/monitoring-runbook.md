# Azure Monitoring Runbook

**Feature**: 007-azure-infra  
**Scope**: Application Insights + Log Analytics observability for API and enrichment services

## Overview

This runbook describes how to verify telemetry is flowing to Application Insights and how to run common queries for the recall-core services deployed to Azure Container Apps.

## Prerequisites

- Azure Portal access to the target environment resource group (e.g., `recall-dev-rg`)
- Deployment completed and API reachable

## Resources

- Log Analytics Workspace: `recall-{env}-law`
- Application Insights: `recall-{env}-ai`
- Container Apps:
  - `recall-api-{env}`
  - `recall-enrichment-{env}`

## Verification Checklist

1. **Confirm App Insights is workspace-based**
   - Open Application Insights → **Properties**
   - Verify **Workspace** is set to `recall-{env}-law`

2. **Verify connection string wiring**
   - Open Container Apps → `recall-api-{env}` → **Configuration** → **Environment variables**
   - Confirm `APPLICATIONINSIGHTS_CONNECTION_STRING` is present
   - Repeat for `recall-enrichment-{env}`

3. **Generate telemetry**
   - Call the API health endpoint: `https://<api-fqdn>/health`
   - Trigger an enrichment flow (publish `enrichment.requested` via Dapr or API path)

4. **Check telemetry in App Insights**
   - Open Application Insights → **Transaction search**
   - Verify recent requests and dependencies appear within 5 minutes

## Common Queries (Kusto)

Open **Logs** in Application Insights and run the following:

### Recent API requests
```kusto
requests
| where cloud_RoleName has "recall-api"
| order by timestamp desc
| take 20
```

### Recent enrichment requests
```kusto
requests
| where cloud_RoleName has "recall-enrichment"
| order by timestamp desc
| take 20
```

### Exceptions (last 24 hours)
```kusto
exceptions
| where timestamp > ago(24h)
| order by timestamp desc
```

### Dependency failures
```kusto
dependencies
| where success == false
| order by timestamp desc
```

## Notes

- The OpenTelemetry Azure Monitor exporter uses `APPLICATIONINSIGHTS_CONNECTION_STRING` by default.
- If traces are missing, verify container revision status and check ACA logs for startup errors.
- For log volume control, adjust sampling in the API/Enrichment configuration if needed.
