````markdown
# Research: Azure Infrastructure Landing Zone

**Feature Branch**: `007-infra-azure`  
**Research Date**: 2026-01-30  
**Status**: Complete

---

## Overview

This document captures research findings for implementing Azure infrastructure for recall-core. Topics include: Bicep module design, Container Apps configuration, Static Web Apps linked backend, DocumentDB provisioning, Storage Queue-triggered jobs, observability setup, managed identity strategy, and CI/CD with OIDC federation.

---

## 1. Bicep Module Architecture

### Decision: Modular Bicep with Subscription-Level Entry Point

**Rationale**: Modular approach enables reuse, testing in isolation, and clear separation of concerns. Azure Verified Modules (AVM) patterns provide production-ready templates for common resources.

**Alternatives Considered**:
- **Terraform**: Multi-cloud support not needed; Bicep is Azure-native with better ARM integration.
- **ARM Templates (JSON)**: Verbose, harder to maintain; Bicep compiles to ARM.
- **Pulumi/CDK**: Overkill for single-cloud, small team.

### Module Structure Pattern

```bicep
// modules/core/key-vault.bicep
@description('Environment name for resource naming')
param environmentName string

@description('Azure region for deployment')
param location string = resourceGroup().location

@description('Tags to apply to all resources')
param tags object = {}

@description('Principal IDs to grant Key Vault Secrets User role')
param secretsUserPrincipalIds array = []

var keyVaultName = 'kv-recall-${environmentName}'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enablePurgeProtection: false // Disabled for dev; enable for prod
  }
}

// RBAC role assignments
resource secretsUserRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for principalId in secretsUserPrincipalIds: {
  name: guid(keyVault.id, principalId, 'KeyVaultSecretsUser')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}]

output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
```

### Main Entry Point Pattern

```bicep
// main.bicep
targetScope = 'subscription'

@description('Environment name')
@allowed(['dev', 'prod'])
param environmentName string

@description('Azure region')
param location string = 'westeurope'

@description('Tags for all resources')
param tags object = {
  environment: environmentName
  project: 'recall-core'
  managedBy: 'bicep'
}

// Resource Group
module rg './modules/core/resource-group.bicep' = {
  name: 'rg-${environmentName}'
  params: {
    name: 'rg-recall-${environmentName}'
    location: location
    tags: tags
  }
}

// Deploy modules to resource group scope
module keyVault './modules/core/key-vault.bicep' = {
  name: 'kv-${environmentName}'
  scope: resourceGroup(rg.outputs.name)
  params: {
    environmentName: environmentName
    location: location
    tags: tags
  }
}

// ... other modules
```

---

## 2. Container Apps Environment & API

### Decision: Consumption Plan with Log Analytics Integration

**Rationale**: Consumption plan (serverless) is cost-effective for variable workloads. Log Analytics integration provides container logs and metrics in a unified workspace.

**Alternatives Considered**:
- **Workload Profiles plan**: More expensive, for predictable high workloads.
- **AKS**: Over-engineered for single-app deployment.

### Container Apps Environment Configuration

```bicep
// modules/container/container-apps-env.bicep
param environmentName string
param location string = resourceGroup().location
param tags object = {}
param logAnalyticsWorkspaceId string

var envName = 'cae-recall-${environmentName}'

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: reference(logAnalyticsWorkspaceId, '2022-10-01').customerId
        sharedKey: listKeys(logAnalyticsWorkspaceId, '2022-10-01').primarySharedKey
      }
    }
    zoneRedundant: false  // Enable for prod if needed
  }
}

output environmentId string = containerAppsEnvironment.id
output environmentName string = containerAppsEnvironment.name
output defaultDomain string = containerAppsEnvironment.properties.defaultDomain
```

### API Container App Configuration

```bicep
// modules/container/container-app-api.bicep
param environmentName string
param location string = resourceGroup().location
param tags object = {}
param containerAppsEnvironmentId string
param containerRegistryName string
param containerImageTag string = 'latest'
param keyVaultName string
param appConfigurationName string
param appInsightsConnectionString string

// System-assigned managed identity
var apiAppName = 'aca-recall-api-${environmentName}'

resource apiContainerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: apiAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'http'
        allowInsecure: false  // HTTPS only
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          server: '${containerRegistryName}.azurecr.io'
          identity: 'system'
        }
      ]
      secrets: [
        {
          name: 'documentdb-connection-string'
          keyVaultUrl: 'https://${keyVaultName}.vault.azure.net/secrets/DocumentDbConnectionString'
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: '${containerRegistryName}.azurecr.io/recall-api:${containerImageTag}'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'ASPNETCORE_ENVIRONMENT'
              value: environmentName == 'prod' ? 'Production' : 'Development'
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: appInsightsConnectionString
            }
            {
              name: 'ConnectionStrings__recalldb'
              secretRef: 'documentdb-connection-string'
            }
            {
              name: 'AzureAppConfiguration__Endpoint'
              value: 'https://${appConfigurationName}.azconfig.io'
            }
          ]
          probes: [
            {
              type: 'Startup'
              httpGet: {
                path: '/health'
                port: 8080
                scheme: 'HTTP'
              }
              initialDelaySeconds: 5
              periodSeconds: 10
              failureThreshold: 3
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8080
                scheme: 'HTTP'
              }
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 8080
                scheme: 'HTTP'
              }
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: environmentName == 'prod' ? 1 : 0
        maxReplicas: environmentName == 'prod' ? 10 : 3
        rules: [
          {
            name: 'http-scale'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}

output apiAppId string = apiContainerApp.id
output apiAppName string = apiContainerApp.name
output apiAppFqdn string = apiContainerApp.properties.configuration.ingress.fqdn
output apiPrincipalId string = apiContainerApp.identity.principalId
```

---

## 3. Static Web Apps with Linked Backend

### Decision: SWA with Linked Backend to Container App

**Rationale**: Linked backend enables `/api/*` routing to ACA without CORS configuration. SWA handles SSL termination, CDN, and GitHub deployment integration.

**Alternatives Considered**:
- **CORS fallback**: More configuration, cross-origin complexity.
- **Azure Front Door**: Overkill for single-region deployment.

### SWA Configuration with Linked Backend

```bicep
// modules/web/static-web-app.bicep
param environmentName string
param location string = resourceGroup().location
param tags object = {}
param repositoryUrl string
param branch string = 'main'
param apiContainerAppResourceId string

var swaName = 'swa-recall-${environmentName}'

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: swaName
  location: location
  tags: tags
  sku: {
    name: environmentName == 'prod' ? 'Standard' : 'Free'
    tier: environmentName == 'prod' ? 'Standard' : 'Free'
  }
  properties: {
    repositoryUrl: repositoryUrl
    branch: branch
    buildProperties: {
      appLocation: 'src/web'
      outputLocation: 'dist'
      appBuildCommand: 'pnpm run build'
    }
  }
}

// Linked backend to Container App (requires Standard SKU for custom functions)
resource linkedBackend 'Microsoft.Web/staticSites/linkedBackends@2023-12-01' = if (environmentName == 'prod') {
  parent: staticWebApp
  name: 'api-backend'
  properties: {
    backendResourceId: apiContainerAppResourceId
    region: location
  }
}

output swaId string = staticWebApp.id
output swaName string = staticWebApp.name
output swaDefaultHostname string = staticWebApp.properties.defaultHostname
output swaDeploymentToken string = listSecrets(staticWebApp.id, staticWebApp.apiVersion).properties.apiKey
```

### SWA Configuration File (staticwebapp.config.json)

```json
{
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["authenticated"],
      "headers": {
        "X-Forwarded-Host": "{request.host}"
      }
    }
  ],
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/api/*"]
  },
  "responseOverrides": {
    "401": {
      "redirect": "/.auth/login/aad?post_login_redirect_uri=/",
      "statusCode": 302
    }
  },
  "platform": {
    "apiRuntime": "node:20"
  }
}
```

**Note**: For dev environment (Free SKU), linked backend is not available. Fallback to CORS configuration on the API:

```csharp
// Program.cs - Add SWA hostname to allowed origins for dev
var swaHostname = builder.Configuration["Cors:SwaHostname"];
if (!string.IsNullOrEmpty(swaHostname))
{
    allowedOriginSet.Add($"https://{swaHostname}");
}
```

---

## 4. Azure DocumentDB (Cosmos DB for MongoDB vCore)

### Decision: Azure Cosmos DB for MongoDB vCore (M25 for dev, M40 for prod)

**Rationale**: vCore-based Azure Cosmos DB for MongoDB provides MongoDB wire protocol compatibility with Azure-managed infrastructure. Predictable pricing compared to RU-based model.

**Alternatives Considered**:
- **Cosmos DB RU-based MongoDB API**: Variable costs, complex capacity planning.
- **Atlas MongoDB**: External dependency, additional networking complexity.
- **Azure Database for PostgreSQL**: Would require application changes from MongoDB.

### DocumentDB Configuration

```bicep
// modules/database/documentdb.bicep
param environmentName string
param location string = resourceGroup().location
param tags object = {}
param administratorLogin string = 'recallAdmin'
@secure()
param administratorPassword string
param keyVaultName string

var cosmosName = 'cosmos-recall-${environmentName}'
var tier = environmentName == 'prod' ? 'M40' : 'M25'

resource cosmosDbMongo 'Microsoft.DocumentDB/mongoClusters@2024-02-15-preview' = {
  name: cosmosName
  location: location
  tags: tags
  properties: {
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    nodeGroupSpecs: [
      {
        kind: 'Shard'
        nodeCount: 1
        sku: tier
        diskSizeGB: 32
        enableHa: environmentName == 'prod'
      }
    ]
    publicNetworkAccess: 'Enabled'  // Restrict with firewall rules
  }
}

// Firewall rules - allow Azure services
resource firewallRule 'Microsoft.DocumentDB/mongoClusters/firewallRules@2024-02-15-preview' = {
  parent: cosmosDbMongo
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Store connection string in Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource connectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'DocumentDbConnectionString'
  properties: {
    value: 'mongodb+srv://${administratorLogin}:${administratorPassword}@${cosmosDbMongo.properties.connectionString}/recall?retryWrites=true&w=majority'
  }
}

output cosmosDbId string = cosmosDbMongo.id
output cosmosDbName string = cosmosDbMongo.name
output cosmosDbEndpoint string = cosmosDbMongo.properties.connectionString
```

**Security Notes**:
- Connection string stored in Key Vault, never in app settings directly.
- Firewall rule `0.0.0.0-0.0.0.0` allows Azure services only.
- For production hardening: VNet integration with Private Link (out of scope for MVP).

---

## 5. Storage Account (Blob + Queue)

### Decision: Single Storage Account with Blob Container and Queue

**Rationale**: Simplified management with single account. Both thumbnails (blob) and enrichment jobs (queue) are low-volume for personal use.

### Storage Account Configuration

```bicep
// modules/storage/storage-account.bicep
param environmentName string
param location string = resourceGroup().location
param tags object = {}

var storageName = 'strecall${environmentName}'
var skuName = environmentName == 'prod' ? 'Standard_GRS' : 'Standard_LRS'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-04-01' = {
  name: storageName
  location: location
  tags: tags
  sku: {
    name: skuName
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false  // Force Entra ID auth via managed identity
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      defaultAction: 'Allow'  // Restrict in prod with VNet rules
      bypass: 'AzureServices'
    }
  }
}

// Blob container for thumbnails
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-04-01' = {
  parent: storageAccount
  name: 'default'
}

resource thumbnailsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-04-01' = {
  parent: blobService
  name: 'thumbnails'
  properties: {
    publicAccess: 'None'
  }
}

// Queue for enrichment jobs
resource queueService 'Microsoft.Storage/storageAccounts/queueServices@2023-04-01' = {
  parent: storageAccount
  name: 'default'
}

resource enrichmentQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-04-01' = {
  parent: queueService
  name: 'enrichment-queue'
}

output storageAccountId string = storageAccount.id
output storageAccountName string = storageAccount.name
output blobEndpoint string = storageAccount.properties.primaryEndpoints.blob
output queueEndpoint string = storageAccount.properties.primaryEndpoints.queue
```

### RBAC Role Assignments for Managed Identity

```bicep
// modules/storage/storage-roles.bicep
param storageAccountName string
param principalId string
param principalType string = 'ServicePrincipal'

// Built-in role IDs
var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var storageQueueDataContributorRoleId = '974c5e8b-45b9-4653-ba55-5f855dd0fb88'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-04-01' existing = {
  name: storageAccountName
}

resource blobContributorRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, principalId, storageBlobDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: principalId
    principalType: principalType
  }
}

resource queueContributorRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, principalId, storageQueueDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageQueueDataContributorRoleId)
    principalId: principalId
    principalType: principalType
  }
}
```

---

## 6. Container Apps Job (Queue-Triggered Enrichment)

### Decision: Event-Driven ACA Job with Storage Queue Trigger

**Rationale**: ACA Jobs scale to zero when no messages, reducing costs. Event-driven mode processes messages immediately without polling loop in application code.

**Alternatives Considered**:
- **Always-on Container App**: Wasteful for low-volume queue.
- **Azure Functions**: Different deployment model, less container control.

### ACA Job Configuration

```bicep
// modules/container/container-app-job.bicep
param environmentName string
param location string = resourceGroup().location
param tags object = {}
param containerAppsEnvironmentId string
param containerRegistryName string
param containerImageTag string = 'latest'
param keyVaultName string
param appInsightsConnectionString string
param storageAccountName string
param queueName string = 'enrichment-queue'

var jobName = 'acj-recall-enrichment-${environmentName}'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-04-01' existing = {
  name: storageAccountName
}

resource enrichmentJob 'Microsoft.App/jobs@2024-03-01' = {
  name: jobName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: containerAppsEnvironmentId
    configuration: {
      triggerType: 'Event'
      replicaTimeout: 300  // 5 minutes max per message
      replicaRetryLimit: 3
      eventTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
        scale: {
          minExecutions: 0
          maxExecutions: 5
          pollingInterval: 30
          rules: [
            {
              name: 'queue-trigger'
              type: 'azure-queue'
              metadata: {
                queueName: queueName
                queueLength: '1'
                accountName: storageAccountName
              }
              auth: [
                {
                  secretRef: 'storage-connection'
                  triggerParameter: 'connection'
                }
              ]
            }
          ]
        }
      }
      registries: [
        {
          server: '${containerRegistryName}.azurecr.io'
          identity: 'system'
        }
      ]
      secrets: [
        {
          name: 'documentdb-connection-string'
          keyVaultUrl: 'https://${keyVaultName}.vault.azure.net/secrets/DocumentDbConnectionString'
          identity: 'system'
        }
        {
          name: 'storage-connection'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};EndpointSuffix=core.windows.net;AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'enrichment'
          image: '${containerRegistryName}.azurecr.io/recall-enrichment:${containerImageTag}'
          resources: {
            cpu: json('1.0')
            memory: '2Gi'  // Playwright needs more memory
          }
          env: [
            {
              name: 'ASPNETCORE_ENVIRONMENT'
              value: environmentName == 'prod' ? 'Production' : 'Development'
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: appInsightsConnectionString
            }
            {
              name: 'ConnectionStrings__recalldb'
              secretRef: 'documentdb-connection-string'
            }
            {
              name: 'Storage__AccountName'
              value: storageAccountName
            }
            {
              name: 'Storage__QueueName'
              value: queueName
            }
          ]
        }
      ]
    }
  }
}

output jobId string = enrichmentJob.id
output jobName string = enrichmentJob.name
output jobPrincipalId string = enrichmentJob.identity.principalId
```

**Worker Image Adaptation**:
The existing enrichment service (Dapr subscriber) needs adaptation for ACA Job mode:
- Entry point processes single message from queue (not HTTP subscription)
- Exit after processing (job execution model)
- Container must install Playwright browsers during build

---

## 7. Application Insights & OpenTelemetry

### Decision: Workspace-Based Application Insights with OpenTelemetry SDK

**Rationale**: Workspace-based App Insights provides unified logging with Log Analytics. OpenTelemetry SDK (already in ServiceDefaults) exports to Azure Monitor.

### Application Insights Configuration

```bicep
// modules/core/app-insights.bicep
param environmentName string
param location string = resourceGroup().location
param tags object = {}
param logAnalyticsWorkspaceId string

var appInsightsName = 'appi-recall-${environmentName}'

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspaceId
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    RetentionInDays: environmentName == 'prod' ? 90 : 30
  }
}

output appInsightsId string = appInsights.id
output appInsightsName string = appInsights.name
output connectionString string = appInsights.properties.ConnectionString
output instrumentationKey string = appInsights.properties.InstrumentationKey
```

### OpenTelemetry Configuration in API

The existing ServiceDefaults already configure OpenTelemetry. For Azure Monitor export:

```csharp
// Extensions.cs - Already in ServiceDefaults, verify OTLP exporter config
public static IHostApplicationBuilder AddServiceDefaults(this IHostApplicationBuilder builder)
{
    builder.Services.AddOpenTelemetry()
        .WithTracing(tracing =>
        {
            tracing.AddAspNetCoreInstrumentation()
                   .AddHttpClientInstrumentation();
        })
        .WithMetrics(metrics =>
        {
            metrics.AddAspNetCoreInstrumentation()
                   .AddRuntimeInstrumentation();
        });

    // Azure Monitor exporter (reads APPLICATIONINSIGHTS_CONNECTION_STRING)
    builder.Services.AddOpenTelemetry()
        .UseOtlpExporter();
    
    // Add Azure Monitor exporter
    if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING")))
    {
        builder.Services.AddOpenTelemetry()
            .UseAzureMonitor();
    }

    return builder;
}
```

**Package Reference**:
```xml
<PackageReference Include="Azure.Monitor.OpenTelemetry.AspNetCore" Version="1.2.0" />
```

---

## 8. Managed Identity Strategy

### Decision: System-Assigned Managed Identity per Resource

**Rationale**: System-assigned identities are simpler to manage (lifecycle tied to resource). Each container app gets its own identity with least-privilege RBAC roles.

**Identity Matrix**:

| Resource | Identity Type | RBAC Roles |
|----------|---------------|------------|
| aca-recall-api-{env} | System-assigned | Key Vault Secrets User, Storage Blob Data Contributor, Storage Queue Data Contributor, App Configuration Data Reader, AcrPull |
| acj-recall-enrichment-{env} | System-assigned | Key Vault Secrets User, Storage Blob Data Contributor, Storage Queue Data Contributor, AcrPull |

**Role Assignment Pattern**:

```bicep
// Assign Key Vault Secrets User to API managed identity
resource kvSecretsUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, apiPrincipalId, '4633458b-17de-408a-b874-0445c86b69e6')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: apiPrincipalId
    principalType: 'ServicePrincipal'
  }
}
```

---

## 9. GitHub Actions CI/CD with OIDC

### Decision: OIDC Workload Identity Federation

**Rationale**: OIDC federation eliminates long-lived secrets. GitHub Actions assumes Azure identity via federation, not stored credentials.

**Setup Steps**:

1. **Create App Registration in Entra ID**:
```bash
az ad app create --display-name "recall-github-actions"
```

2. **Create Federated Credential**:
```bash
az ad app federated-credential create \
  --id <app-id> \
  --parameters '{
    "name": "github-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:adiazcan/recall-core:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

3. **Create Service Principal and Assign Roles**:
```bash
az ad sp create --id <app-id>
az role assignment create \
  --assignee <app-id> \
  --role "Contributor" \
  --scope "/subscriptions/<sub-id>/resourceGroups/rg-recall-dev"
```

### Infrastructure Deployment Workflow

```yaml
# .github/workflows/infra-deploy.yml
name: Deploy Infrastructure

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options:
          - dev
          - prod

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Azure Login (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
      
      - name: Deploy Bicep
        uses: azure/arm-deploy@v2
        with:
          scope: subscription
          region: westeurope
          template: ./infra/main.bicep
          parameters: ./infra/parameters/${{ inputs.environment }}.bicepparam
          deploymentName: recall-${{ inputs.environment }}-${{ github.run_number }}
```

### API Deployment Workflow

```yaml
# .github/workflows/api-deploy.yml
name: Deploy API

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options:
          - dev
          - prod

permissions:
  id-token: write
  contents: read
  packages: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Azure Login
        uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
      
      - name: Login to ACR
        run: |
          az acr login --name crrecall${{ inputs.environment }}
      
      - name: Build and Push Image
        run: |
          docker build -t crrecall${{ inputs.environment }}.azurecr.io/recall-api:${{ github.sha }} \
            -f src/Recall.Core.Api/Dockerfile src/
          docker push crrecall${{ inputs.environment }}.azurecr.io/recall-api:${{ github.sha }}
      
      - name: Deploy to ACA
        run: |
          az containerapp update \
            --name aca-recall-api-${{ inputs.environment }} \
            --resource-group rg-recall-${{ inputs.environment }} \
            --image crrecall${{ inputs.environment }}.azurecr.io/recall-api:${{ github.sha }}
```

---

## 10. Alerts Configuration (Prod Only)

### Decision: Azure Monitor Alerts for Critical Metrics

**Rationale**: Alerts provide proactive notification of service degradation. Focus on availability and error rates for MVP.

### Alert Rules

```bicep
// modules/core/alerts.bicep (prod only)
param appInsightsId string
param actionGroupId string

// API Availability Alert (< 99% over 5 minutes)
resource availabilityAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-api-availability'
  location: 'global'
  properties: {
    severity: 1
    enabled: true
    scopes: [appInsightsId]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'AvailabilityCriteria'
          metricName: 'availabilityResults/availabilityPercentage'
          operator: 'LessThan'
          threshold: 99
          timeAggregation: 'Average'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroupId
      }
    ]
  }
}

// High 5xx Error Rate Alert (> 5% over 5 minutes)
resource errorRateAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-api-5xx-rate'
  location: 'global'
  properties: {
    severity: 2
    enabled: true
    scopes: [appInsightsId]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'ErrorRateCriteria'
          metricName: 'requests/failed'
          operator: 'GreaterThan'
          threshold: 5
          timeAggregation: 'Count'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroupId
      }
    ]
  }
}
```

---

## 11. App Configuration

### Decision: Azure App Configuration for Non-Secret Settings

**Rationale**: Centralized configuration management with versioning, feature flags support, and Key Vault references for secrets.

### App Configuration Setup

```bicep
// modules/core/app-configuration.bicep
param environmentName string
param location string = resourceGroup().location
param tags object = {}

var appConfigName = 'appcs-recall-${environmentName}'

resource appConfiguration 'Microsoft.AppConfiguration/configurationStores@2023-03-01' = {
  name: appConfigName
  location: location
  tags: tags
  sku: {
    name: environmentName == 'prod' ? 'standard' : 'free'
  }
  properties: {
    disableLocalAuth: true  // Force Entra ID auth
    publicNetworkAccess: 'Enabled'
  }
}

// Initial configuration values
resource tenantIdSetting 'Microsoft.AppConfiguration/configurationStores/keyValues@2023-03-01' = {
  parent: appConfiguration
  name: 'AzureAd:TenantId'
  properties: {
    value: subscription().tenantId
  }
}

output appConfigId string = appConfiguration.id
output appConfigName string = appConfiguration.name
output appConfigEndpoint string = appConfiguration.properties.endpoint
```

---

## 12. Container Registry

### Decision: Azure Container Registry with Managed Identity Pull

**Rationale**: ACR is tightly integrated with ACA. Managed identity pull eliminates need for registry credentials.

### ACR Configuration

```bicep
// modules/container/container-registry.bicep
param environmentName string
param location string = resourceGroup().location
param tags object = {}

var acrName = 'crrecall${environmentName}'

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: environmentName == 'prod' ? 'Standard' : 'Basic'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

output acrId string = containerRegistry.id
output acrName string = containerRegistry.name
output acrLoginServer string = containerRegistry.properties.loginServer
```

### ACR Pull Role Assignment

```bicep
// Assign AcrPull role to Container App managed identity
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, principalId, acrPullRoleId)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
```

---

## Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| IaC Tool | Bicep | Azure-native, ARM integration, declarative |
| Entry Point | Subscription-level main.bicep | Resource group creation + all resources |
| Container Host | Azure Container Apps | Serverless scaling, integrated logging |
| Frontend Host | Azure Static Web Apps | CDN, HTTPS, linked backend routing |
| Database | Azure DocumentDB (MongoDB vCore) | Wire-compatible, managed, predictable pricing |
| Queue | Azure Storage Queue | Integrated with ACA Jobs trigger |
| Background Jobs | ACA Jobs (event-driven) | Scale-to-zero, queue-triggered |
| Secrets | Key Vault (RBAC only) | Centralized, auditable, no access policies |
| Config | App Configuration | Non-secrets, feature flags, versioning |
| Observability | App Insights + Log Analytics | OpenTelemetry export, unified logging |
| Identity | System-assigned MI per resource | Least privilege, lifecycle management |
| CI/CD Auth | OIDC workload identity | No stored secrets, GitHub integration |
| Alerts | Azure Monitor (prod only) | Availability + error rate monitoring |

````