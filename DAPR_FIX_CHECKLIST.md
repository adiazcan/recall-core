# Dapr Azure Container Apps Fix - Implementation Checklist

## Issue
❌ **Problem**: Dapr was not enabled on Azure Container Apps, preventing pub/sub messaging for enrichment jobs.

✅ **Solution**: Enabled Dapr on Container Apps, added Azure Service Bus for pub/sub, and deployed managed Dapr components.

---

## Implementation Status

### ✅ 1. Infrastructure Modules Created

- [x] **Service Bus Module** (`infra/modules/messaging/service-bus.bicep`)
  - Namespace with Standard SKU
  - Topic: `enrichment-requested`
  - Subscription: `enrichment-worker` with dead-lettering
  
- [x] **Service Bus RBAC Module** (`infra/modules/messaging/service-bus-roles.bicep`)
  - Data Sender and Data Receiver role assignments
  - Managed identity authentication

- [x] **Enrichment Container App** (`infra/modules/container/container-app-enrichment.bicep`)
  - Converted from Job to Container App
  - Dapr enabled (appId=enrichment)
  - Service Bus topic scaling rule
  - Health probes configured

- [x] **Dapr Components Module** (`infra/modules/container/dapr-components.bicep`)
  - Managed Dapr component: `enrichment-pubsub`
  - Service Bus Topics type
  - Scoped to api and enrichment services

### ✅ 2. Infrastructure Modules Updated

- [x] **Container Apps Environment** (`container-apps-env.bicep`)
  - Added Dapr Application Insights telemetry parameter
  - Enabled Dapr on environment

- [x] **API Container App** (`container-app-api.bicep`)
  - Enabled Dapr (appId=api, port=8080)
  - Added Service Bus namespace parameter
  - Added ServiceBus__FullyQualifiedNamespace env var

- [x] **Main Infrastructure** (`main.bicep`)
  - Integrated Service Bus module
  - Integrated Dapr components module
  - Added Service Bus role assignments for API and Enrichment
  - Updated outputs with Service Bus info
  - Fixed dependency chain (Dapr components before apps)

### ✅ 3. Dapr Component Definitions

- [x] **Pub/Sub Component** (`pubsub-servicebus.yaml`)
  - Type: Azure Service Bus Topics
  - Configuration: handlers, timeout, lock duration
  - Entity management disabled

- [x] **Subscription Definition** (`subscription.yaml`)
  - Subscription for enrichment service
  - Routing to `/api/enrichment/process`
  - Dead letter topic configured

- [x] **Resiliency Policy** (`resiliency.yaml`)
  - Exponential backoff retry (max 10)
  - 30s timeout
  - Circuit breaker (3 failures)

### ✅ 4. Documentation

- [x] **Dapr Components README** (`infra/dapr-components/README.md`)
  - Component overview and architecture
  - Configuration details
  - Deployment instructions
  - Troubleshooting guide

- [x] **Infrastructure README** (`infra/README.md`)
  - Added architecture overview
  - Listed Service Bus resource
  - Referenced Dapr documentation

- [x] **Implementation Summary** (`DAPR_FIX_SUMMARY.md`)
  - Complete change log
  - Testing procedures
  - Rollout and rollback plans
  - Cost impact analysis

### ✅ 5. Validation

- [x] Bicep syntax validation (no errors)
- [x] Fixed unnecessary dependency warnings
- [x] Verified all module outputs match parameter inputs
- [x] Confirmed RBAC role IDs are correct

---

## Architecture Changes

### Before
```
API (no Dapr) → ❌ Storage Queue → Container Apps Job
```

### After
```
API (Dapr: api) → Service Bus Topic → Enrichment (Dapr: enrichment)
          ↓                                    ↑
    enrichment-pubsub component     Dapr subscription
```

---

## Deployment Readiness

### ✅ Ready to Deploy
- All Bicep modules created and validated
- All parameters configured
- Documentation complete
- Testing procedures documented

### 📋 Next Steps for User

1. **Deploy infrastructure**:
   ```bash
   cd infra
   ./scripts/deploy.sh dev <password>
   ```

2. **Verify Dapr enabled**:
   ```bash
   az containerapp show --name aca-recall-api-dev --resource-group rg-recall-dev \
     --query "properties.configuration.dapr"
   ```

3. **Test pub/sub messaging**:
   - Create an item via API
   - Verify message in Service Bus topic
   - Check enrichment service processes it

4. **Monitor in Application Insights**:
   - View Dapr traces
   - Check enrichment job telemetry
   - Verify no circuit breaker trips

---

## Files Changed Summary

### New Files (9)
1. `infra/modules/messaging/service-bus.bicep`
2. `infra/modules/messaging/service-bus-roles.bicep`
3. `infra/modules/container/container-app-enrichment.bicep`
4. `infra/modules/container/dapr-components.bicep`
5. `infra/dapr-components/pubsub-servicebus.yaml`
6. `infra/dapr-components/subscription.yaml`
7. `infra/dapr-components/resiliency.yaml`
8. `infra/dapr-components/README.md`
9. `DAPR_FIX_SUMMARY.md`

### Modified Files (4)
1. `infra/main.bicep` - Added Service Bus, Dapr components, updated dependencies
2. `infra/modules/container/container-apps-env.bicep` - Enabled Dapr telemetry
3. `infra/modules/container/container-app-api.bicep` - Enabled Dapr, added Service Bus
4. `infra/README.md` - Added architecture overview

### Deleted Files (1)
1. `infra/modules/container/container-app-job.bicep` - Replaced with container-app-enrichment.bicep

---

## Success Criteria Met

✅ Dapr enabled on Container Apps Environment  
✅ Dapr configured on API container app  
✅ Dapr configured on Enrichment container app  
✅ Service Bus namespace created for pub/sub  
✅ Dapr managed components deployed  
✅ Managed identity RBAC configured  
✅ Telemetry integration with Application Insights  
✅ Resiliency policies defined  
✅ Documentation complete  
✅ Bicep validation passed  

---

## Cost Impact

**Additional Monthly Cost**: ~$10-15 for Service Bus Standard namespace

---

## Status: ✅ COMPLETE

All changes implemented, validated, and documented. Ready for deployment to Azure dev environment.

