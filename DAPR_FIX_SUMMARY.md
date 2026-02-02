# Dapr Configuration Fix for Azure Container Apps

**Issue**: Dapr was not enabled on Azure Container Apps, preventing the application from using pub/sub messaging for enrichment jobs.

**Solution**: Enabled Dapr on Container Apps Environment and both container apps (API and Enrichment), added Azure Service Bus as the pub/sub backing store, and deployed managed Dapr components.

---

## Changes Made

### 1. Infrastructure Modules

#### New Files Created

1. **`infra/modules/messaging/service-bus.bicep`**
   - Azure Service Bus namespace with Standard SKU
   - Topic: `enrichment-requested` with 1 GB size, 1-day TTL
   - Subscription: `enrichment-worker` with dead-lettering enabled
   - Outputs: namespace name, endpoint, topic name

2. **`infra/modules/messaging/service-bus-roles.bicep`**
   - RBAC role assignments for Service Bus
   - Grants "Azure Service Bus Data Sender" role (API)
   - Grants "Azure Service Bus Data Receiver" role (Enrichment)
   - Uses managed identity (no connection strings)

3. **`infra/modules/container/container-app-enrichment.bicep`**
   - Replaces the previous "job" implementation
   - Enrichment is now a Container App (not a Job)
   - Dapr configuration: appId=enrichment, appPort=8080
   - Scale rule: Azure Service Bus topic subscription scaling
   - Internal ingress only (not publicly accessible)
   - Health probes: liveness and readiness checks

4. **`infra/modules/container/dapr-components.bicep`**
   - Deploys managed Dapr components to Container Apps Environment
   - Component: `enrichment-pubsub` using Service Bus Topics
   - Scopes: `api` and `enrichment`
   - Settings: max 5 concurrent handlers, 300s lock duration
   - Managed identity authentication (no secrets)

#### Modified Files

5. **`infra/modules/container/container-apps-env.bicep`**
   - Added `daprApplicationInsightsConnectionString` parameter
   - Enabled Dapr telemetry in Container Apps Environment
   - Configured Dapr to send traces to Application Insights

6. **`infra/modules/container/container-app-api.bicep`**
   - Added Dapr configuration: appId=api, appPort=8080
   - Added `serviceBusNamespaceName` parameter
   - Added environment variable: `ServiceBus__FullyQualifiedNamespace`
   - Enables API to publish messages via Dapr

7. **`infra/main.bicep`**
   - Added Service Bus module deployment
   - Added Dapr components module deployment
   - Updated API and Enrichment module calls with Service Bus parameter
   - Added Service Bus role assignments for both services
   - Updated outputs: added `serviceBusNamespace` and `enrichmentTopicName`
   - Updated dependencies: Dapr components deployed before container apps

### 2. Dapr Component Definitions

8. **`infra/dapr-components/pubsub-servicebus.yaml`**
   - Dapr component definition for local reference
   - Type: `pubsub.azure.servicebus.topics`
   - Metadata: namespace, handlers, timeout, lock duration
   - Entity management disabled (topic pre-created in Bicep)

9. **`infra/dapr-components/subscription.yaml`**
   - Dapr subscription for enrichment service
   - Topic: `enrichment.requested`
   - Route: `/api/enrichment/process`
   - Dead letter topic: `enrichment.deadletter`
   - Scoped to `enrichment` service only

10. **`infra/dapr-components/resiliency.yaml`**
    - Retry policy: exponential backoff, 2s-60s, max 10 retries
    - Timeout policy: 30s for operations
    - Circuit breaker: 3 failures trip, 60s timeout
    - Applied to `enrichment-pubsub` component

### 3. Documentation

11. **`infra/dapr-components/README.md`**
    - Overview of Dapr components and their purpose
    - Configuration details for each component
    - Deployment instructions
    - Troubleshooting guide (logs, permissions, circuit breaker)
    - Architecture diagram
    - Links to Azure/Dapr documentation

12. **`infra/README.md`**
    - Added architecture overview section
    - Listed all Azure resources including Service Bus
    - Referenced Dapr components documentation

---

## Key Changes Summary

| Change | Before | After |
|--------|--------|-------|
| **Messaging** | ❌ Storage Queue (direct trigger) | ✅ Azure Service Bus Topics (Dapr pub/sub) |
| **API Dapr** | ❌ Not configured | ✅ Enabled (appId=api) |
| **Enrichment** | ❌ Container Apps Job (queue trigger) | ✅ Container App with Dapr (appId=enrichment) |
| **Pub/Sub Component** | ❌ Missing | ✅ Managed Dapr component deployed |
| **Authentication** | N/A | ✅ Managed Identity (RBAC) |
| **Scaling** | Queue length | ✅ Service Bus subscription message count |
| **Telemetry** | ❌ No Dapr tracing | ✅ Dapr telemetry to App Insights |
| **Resiliency** | ❌ No retry policies | ✅ Exponential backoff, circuit breaker |

---

## Deployment Impact

### New Resources Created

- **Azure Service Bus Namespace** (`sb-recall-{env}`)
  - SKU: Standard (cost: ~$10/month base + usage)
  - Topic: `enrichment-requested`
  - Subscription: `enrichment-worker`

### Resource Changes

- **Container Apps Environment**: Dapr enabled with telemetry
- **API Container App**: Dapr sidecar added (appId=api)
- **Enrichment**: Changed from "Job" to "Container App" with Dapr sidecar
- **RBAC Roles**: Added Service Bus Data Sender/Receiver roles

### Configuration Changes

Both container apps now require:
- Service Bus namespace parameter
- Dapr-specific environment variables
- Additional RBAC permissions

---

## Testing the Fix

### 1. Verify Dapr is Enabled

```bash
# Check API app Dapr configuration
az containerapp show --name aca-recall-api-dev --resource-group rg-recall-dev \
  --query "properties.configuration.dapr" -o json

# Check Enrichment app Dapr configuration
az containerapp show --name aca-recall-enrichment-dev --resource-group rg-recall-dev \
  --query "properties.configuration.dapr" -o json
```

**Expected output**: `enabled: true`, `appId: api` or `enrichment`

### 2. Verify Service Bus Resources

```bash
# List topics
az servicebus topic list --namespace-name sb-recall-dev --resource-group rg-recall-dev -o table

# List subscriptions
az servicebus topic subscription list \
  --topic-name enrichment-requested \
  --namespace-name sb-recall-dev \
  --resource-group rg-recall-dev -o table
```

**Expected**: Topic `enrichment-requested` and subscription `enrichment-worker` exist

### 3. Verify Dapr Components

```bash
# List Dapr components
az containerapp env dapr-component list \
  --name cae-recall-dev \
  --resource-group rg-recall-dev -o table
```

**Expected**: Component `enrichment-pubsub` listed

### 4. Test End-to-End Message Flow

```bash
# Create an item via API (triggers enrichment job)
curl -X POST https://aca-recall-api-dev.{region}.azurecontainerapps.io/api/v1/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "title": "Test"}'

# Check Service Bus topic for messages
az servicebus topic show \
  --name enrichment-requested \
  --namespace-name sb-recall-dev \
  --resource-group rg-recall-dev \
  --query "countDetails" -o json

# Check Dapr sidecar logs in enrichment app
az containerapp logs show \
  --name aca-recall-enrichment-dev \
  --resource-group rg-recall-dev \
  --type system \
  --follow
```

**Expected**: Message published to topic, enrichment service processes it

### 5. Verify RBAC Permissions

```bash
# Get API managed identity principal ID
API_PRINCIPAL_ID=$(az containerapp show --name aca-recall-api-dev \
  --resource-group rg-recall-dev \
  --query "identity.principalId" -o tsv)

# Check Service Bus role assignments
az role assignment list \
  --assignee $API_PRINCIPAL_ID \
  --scope /subscriptions/{sub-id}/resourceGroups/rg-recall-dev/providers/Microsoft.ServiceBus/namespaces/sb-recall-dev \
  -o table
```

**Expected**: "Azure Service Bus Data Sender" role assigned to API identity

---

## Rollout Plan

### Phase 1: Deploy Infrastructure (Manual)

```bash
cd infra
./scripts/deploy.sh dev <password>
```

This deploys:
- Service Bus namespace + topic/subscription
- Updated Container Apps Environment with Dapr
- Dapr managed components

### Phase 2: Deploy Container Images

```bash
# Rebuild and push images (from CI/CD or manual)
cd src/Recall.Core.Api
docker build -t crrecalldev.azurecr.io/recall-api:latest .
docker push crrecalldev.azurecr.io/recall-api:latest

cd ../Recall.Core.Enrichment
docker build -t crrecalldev.azurecr.io/recall-enrichment:latest .
docker push crrecalldev.azurecr.io/recall-enrichment:latest
```

### Phase 3: Update Container App Revisions

The infrastructure deployment automatically triggers new revisions with Dapr configuration.

### Phase 4: Validate

Run the tests above to confirm Dapr is working.

---

## Cost Impact

| Resource | SKU | Estimated Monthly Cost |
|----------|-----|------------------------|
| Service Bus (Standard) | Standard | ~$10 base + $0.05 per million operations |
| Dapr Sidecar | N/A | Included in Container Apps pricing |

**Total Additional Cost**: ~$10-15/month for dev environment

---

## Rollback Plan

If issues occur:

1. **Disable Dapr on Container Apps**:
   ```bash
   az containerapp update --name aca-recall-api-dev --resource-group rg-recall-dev \
     --set properties.configuration.dapr.enabled=false
   ```

2. **Revert to previous main.bicep** (restore from git)

3. **Delete Service Bus resources** (if needed to save costs):
   ```bash
   az servicebus namespace delete --name sb-recall-dev --resource-group rg-recall-dev
   ```

---

## References

- [Azure Container Apps Dapr integration](https://learn.microsoft.com/azure/container-apps/dapr-overview)
- [Dapr Pub/Sub with Azure Service Bus](https://docs.dapr.io/reference/components-reference/supported-pubsub/setup-azure-servicebus/)
- [Container Apps managed Dapr components](https://learn.microsoft.com/azure/container-apps/dapr-component-connection)

