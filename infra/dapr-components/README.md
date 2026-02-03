# Dapr Components for Azure Container Apps

This directory contains Dapr component definitions for the recall-core application deployed to Azure Container Apps.

## Overview

The application uses Dapr for asynchronous messaging between the API and Enrichment services. In Azure, these components are deployed as managed Dapr components in the Container Apps Environment.

## Components

### 1. Pub/Sub Component (`pubsub-servicebus.yaml`)

**Component Name**: `enrichment-pubsub`  
**Type**: `pubsub.azure.servicebus.topics`  
**Purpose**: Message broker for enrichment job queuing

**Configuration**:
- **Backing Store**: Azure Service Bus Topics
- **Authentication**: Managed Identity (no connection strings)
- **Topic**: `enrichment-requested`
- **Subscription**: `enrichment-worker`
- **Max Concurrent Handlers**: 5
- **Lock Duration**: 300 seconds
- **Entity Management**: Disabled (topic/subscription pre-created in Bicep)

### 2. Subscription Component (`subscription.yaml`)

**Component Name**: `enrichment-subscription`  
**Purpose**: Dapr subscription routing for the enrichment service  
**Deployment**: Application-level configuration (not deployed as managed component)

**Configuration**:
- **Pub/Sub Name**: `enrichment-pubsub`
- **Topic**: `enrichment.requested`
- **Route**: `/api/enrichment/process`
- **Dead Letter Topic**: `enrichment.deadletter`
- **Scopes**: `enrichment` (only enrichment service receives messages)

**Note**: This component is used for application-level subscription routing and is not deployed as a managed Dapr component in Azure Container Apps. The subscription configuration is handled by the Dapr runtime within the enrichment service container.

### 3. Resiliency Component (`resiliency.yaml`)

**Component Name**: `enrichment-resiliency`  
**Purpose**: Retry, timeout, and circuit breaker policies for pub/sub  
**Deployment**: Application-level configuration (not deployed as managed component)

**Policies**:
- **Retry**: Exponential backoff, max 10 retries, 2s-60s intervals
- **Timeout**: 30s for general operations
- **Circuit Breaker**: Trips after 3 consecutive failures, 60s timeout

**Note**: This component is used for application-level resiliency configuration and is not deployed as a managed Dapr component in Azure Container Apps. The resiliency policies are handled by the Dapr runtime within the application containers.

## Deployment

Dapr components are deployed automatically via the `dapr-components.bicep` module:

```bash
# Components are deployed as part of the main infrastructure
cd infra
./scripts/deploy.sh dev
```

The **pub/sub component** is deployed to the Container Apps Environment as a managed Dapr component **before** the container apps start, ensuring the pub/sub infrastructure is ready. 

The **subscription and resiliency components** are application-level configurations that are used by the Dapr runtime within the application containers and are not deployed as managed Dapr components in Azure Container Apps.

## Local Development

For local development with Aspire, Dapr uses **Redis** as the pub/sub backing store (defined in `src/Recall.Core.AppHost/components/pubsub.yaml`). The component name (`enrichment-pubsub`) remains the same to ensure code compatibility.

## Architecture

```
┌─────────────────┐
│   API Service   │
│   (Dapr: api)   │
└────────┬────────┘
         │ PublishEventAsync
         ▼
┌────────────────────────────┐
│  enrichment-pubsub         │
│  (Azure Service Bus)       │
│  Topic: enrichment.requested
└────────┬───────────────────┘
         │ Dapr Subscription
         ▼
┌─────────────────────────┐
│  Enrichment Service     │
│  (Dapr: enrichment)     │
│  Route: /api/enrichment/process
└─────────────────────────┘
```

## Managed Identity Permissions

The API and Enrichment services are granted minimal required Azure roles on the Service Bus namespace following the principle of least privilege:

- **API Service**: `Azure Service Bus Data Sender` (send-only)
- **Enrichment Service**: `Azure Service Bus Data Receiver` (receive-only)

These roles are assigned in `infra/main.bicep` via the `service-bus-roles.bicep` module.

## Troubleshooting

### Messages not being delivered

1. Check Dapr sidecar logs:
   ```bash
   az containerapp logs show --name aca-recall-enrichment-dev --resource-group rg-recall-dev --type system
   ```

2. Verify Service Bus topic and subscription exist:
   ```bash
   az servicebus topic show --name enrichment-requested --namespace-name sb-recall-dev --resource-group rg-recall-dev
   ```

3. Check managed identity permissions:
   ```bash
   az role assignment list --assignee <enrichment-principal-id> --scope <service-bus-resource-id>
   ```

### Circuit breaker tripped

Check the resiliency policy status in Application Insights. If too many failures occur, the circuit breaker opens for 60 seconds.

To reset:
1. Fix the underlying issue (e.g., enrichment service bug)
2. Wait for circuit breaker timeout (60s)
3. New messages will trigger reconnection

## References

- [Dapr Pub/Sub with Azure Service Bus](https://docs.dapr.io/reference/components-reference/supported-pubsub/setup-azure-servicebus/)
- [Azure Container Apps with Dapr](https://learn.microsoft.com/en-us/azure/container-apps/dapr-overview)
- [Managed Identity for Service Bus](https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-managed-service-identity)

