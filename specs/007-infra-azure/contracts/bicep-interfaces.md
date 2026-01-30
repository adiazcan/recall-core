````markdown
# Bicep Contracts: Azure Infrastructure Landing Zone

**Feature Branch**: `007-infra-azure`  
**Created**: 2026-01-30

---

## Overview

This document defines the Bicep module interfaces (inputs/outputs) for the recall-core Azure infrastructure. Each module operates at resource group scope unless otherwise noted.

---

## Main Entry Point

### main.bicep

**Scope**: Subscription

```bicep
// Parameters
@description('Environment name')
@allowed(['dev', 'prod'])
param environmentName string

@description('Azure region for all resources')
param location string = 'westeurope'

@description('DocumentDB administrator login')
param documentDbAdminLogin string = 'recallAdmin'

@description('DocumentDB administrator password')
@secure()
param documentDbAdminPassword string

@description('GitHub repository URL for SWA')
param repositoryUrl string = 'https://github.com/adiazcan/recall-core'

@description('Git branch for SWA deployment')
param branch string = 'main'

@description('Tags for all resources')
param tags object = {
  environment: environmentName
  project: 'recall-core'
  managedBy: 'bicep'
  costCenter: 'recall-${environmentName}'
}

// Outputs
output resourceGroupName string
output apiEndpoint string
output swaEndpoint string
output acrLoginServer string
output keyVaultName string
output appConfigEndpoint string
output documentDbEndpoint string
output storageAccountName string
output appInsightsConnectionString string
```

---

## Core Modules

### modules/core/resource-group.bicep

**Scope**: Subscription

```bicep
// Parameters
@description('Resource group name')
param name string

@description('Azure region')
param location string

@description('Tags')
param tags object = {}

// Outputs
output name string        // Resource group name
output id string          // Resource group resource ID
```

### modules/core/log-analytics.bicep

**Scope**: Resource Group

```bicep
// Parameters
@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('Retention in days (30 for dev, 90 for prod)')
param retentionInDays int = 30

// Outputs
output workspaceId string       // Log Analytics workspace resource ID
output workspaceName string     // Log Analytics workspace name
output customerId string        // Log Analytics workspace customer ID (GUID)
```

### modules/core/app-insights.bicep

**Scope**: Resource Group

```bicep
// Parameters
@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('Log Analytics workspace resource ID')
param logAnalyticsWorkspaceId string

@description('Retention in days')
param retentionInDays int = 30

// Outputs
output appInsightsId string            // Application Insights resource ID
output appInsightsName string          // Application Insights name
output connectionString string         // Connection string for SDK
output instrumentationKey string       // Instrumentation key (legacy)
```

### modules/core/key-vault.bicep

**Scope**: Resource Group

```bicep
// Parameters
@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('Enable purge protection (true for prod)')
param enablePurgeProtection bool = false

@description('Soft delete retention days')
param softDeleteRetentionInDays int = 7

// Outputs
output keyVaultId string        // Key Vault resource ID
output keyVaultName string      // Key Vault name
output keyVaultUri string       // Key Vault URI (https://*.vault.azure.net)
```

### modules/core/app-configuration.bicep

**Scope**: Resource Group

```bicep
// Parameters
@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('SKU: free or standard')
@allowed(['free', 'standard'])
param sku string = 'free'

// Outputs
output appConfigId string          // App Configuration resource ID
output appConfigName string        // App Configuration name
output appConfigEndpoint string    // App Configuration endpoint
```

### modules/core/alerts.bicep (Prod Only)

**Scope**: Resource Group

```bicep
// Parameters
@description('Application Insights resource ID')
param appInsightsId string

@description('Action group resource ID for notifications')
param actionGroupId string

@description('Enable alerts')
param enableAlerts bool = true

// Outputs
output alertIds array    // Array of alert rule resource IDs
```

---

## Container Modules

### modules/container/container-registry.bicep

**Scope**: Resource Group

```bicep
// Parameters
@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('SKU: Basic or Standard')
@allowed(['Basic', 'Standard'])
param sku string = 'Basic'

// Outputs
output acrId string              // ACR resource ID
output acrName string            // ACR name
output acrLoginServer string     // ACR login server (*.azurecr.io)
```

### modules/container/container-apps-env.bicep

**Scope**: Resource Group

```bicep
// Parameters
@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('Log Analytics workspace resource ID')
param logAnalyticsWorkspaceId string

@description('Enable zone redundancy (prod only)')
param zoneRedundant bool = false

// Outputs
output environmentId string         // Container Apps Environment resource ID
output environmentName string       // Container Apps Environment name
output defaultDomain string         // Default domain for apps
```

### modules/container/container-app-api.bicep

**Scope**: Resource Group

```bicep
// Parameters
@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('Container Apps Environment resource ID')
param containerAppsEnvironmentId string

@description('Container Registry name')
param containerRegistryName string

@description('Container image tag')
param containerImageTag string = 'latest'

@description('Key Vault name for secret references')
param keyVaultName string

@description('App Configuration name')
param appConfigurationName string

@description('Application Insights connection string')
param appInsightsConnectionString string

@description('Storage account name')
param storageAccountName string

@description('Minimum replicas')
param minReplicas int = 0

@description('Maximum replicas')
param maxReplicas int = 3

@description('CPU allocation')
param cpu string = '0.5'

@description('Memory allocation')
param memory string = '1Gi'

// Outputs
output apiAppId string           // Container App resource ID
output apiAppName string         // Container App name  
output apiAppFqdn string         // Fully qualified domain name
output apiPrincipalId string     // System-assigned managed identity principal ID
```

### modules/container/container-app-job.bicep

**Scope**: Resource Group

```bicep
// Parameters
@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('Container Apps Environment resource ID')
param containerAppsEnvironmentId string

@description('Container Registry name')
param containerRegistryName string

@description('Container image tag')
param containerImageTag string = 'latest'

@description('Key Vault name')
param keyVaultName string

@description('Application Insights connection string')
param appInsightsConnectionString string

@description('Storage account name')
param storageAccountName string

@description('Queue name to trigger on')
param queueName string = 'enrichment-queue'

@description('Max concurrent executions')
param maxExecutions int = 5

@description('Replica timeout in seconds')
param replicaTimeout int = 300

@description('CPU allocation')
param cpu string = '1.0'

@description('Memory allocation')
param memory string = '2Gi'

// Outputs
output jobId string              // ACA Job resource ID
output jobName string            // ACA Job name
output jobPrincipalId string     // System-assigned managed identity principal ID
```

---

## Storage Modules

### modules/storage/storage-account.bicep

**Scope**: Resource Group

```bicep
// Parameters
@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('Storage account SKU')
@allowed(['Standard_LRS', 'Standard_GRS', 'Standard_ZRS'])
param sku string = 'Standard_LRS'

@description('Blob container names to create')
param blobContainers array = ['thumbnails']

@description('Queue names to create')
param queues array = ['enrichment-queue']

// Outputs
output storageAccountId string       // Storage account resource ID
output storageAccountName string     // Storage account name
output blobEndpoint string           // Blob service endpoint
output queueEndpoint string          // Queue service endpoint
output primaryKey string             // Primary access key (for ACA Job trigger)
```

### modules/storage/storage-roles.bicep

**Scope**: Resource Group

```bicep
// Parameters
@description('Storage account name')
param storageAccountName string

@description('Principal ID to assign roles to')
param principalId string

@description('Principal type')
@allowed(['ServicePrincipal', 'User', 'Group'])
param principalType string = 'ServicePrincipal'

@description('Assign Blob Data Contributor role')
param assignBlobContributor bool = true

@description('Assign Queue Data Contributor role')
param assignQueueContributor bool = true

// Outputs
output roleAssignmentIds array    // Array of role assignment resource IDs
```

---

## Database Modules

### modules/database/documentdb.bicep

**Scope**: Resource Group

```bicep
// Parameters
@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('Administrator login username')
param administratorLogin string = 'recallAdmin'

@description('Administrator login password')
@secure()
param administratorPassword string

@description('Key Vault name to store connection string')
param keyVaultName string

@description('Compute tier: M25 (dev) or M40 (prod)')
@allowed(['M25', 'M40'])
param tier string = 'M25'

@description('Enable high availability')
param enableHa bool = false

@description('Disk size in GB')
param diskSizeGB int = 32

// Outputs
output cosmosDbId string            // DocumentDB cluster resource ID
output cosmosDbName string          // DocumentDB cluster name
output cosmosDbEndpoint string      // DocumentDB connection endpoint (host:port)
```

---

## Web Modules

### modules/web/static-web-app.bicep

**Scope**: Resource Group

```bicep
// Parameters
@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('GitHub repository URL')
param repositoryUrl string

@description('Git branch')
param branch string = 'main'

@description('App location in repository')
param appLocation string = 'src/web'

@description('Build output location')
param outputLocation string = 'dist'

@description('API Container App resource ID for linked backend')
param apiContainerAppResourceId string = ''

@description('Enable linked backend (requires Standard SKU)')
param enableLinkedBackend bool = false

// Outputs
output swaId string                  // Static Web App resource ID
output swaName string                // Static Web App name
output swaDefaultHostname string     // Default hostname (*.azurestaticapps.net)
output swaDeploymentToken string     // Deployment token for GitHub Actions
```

---

## RBAC Role Assignments Module

### modules/rbac/role-assignments.bicep

**Scope**: Resource Group

```bicep
// Parameters
@description('Key Vault name')
param keyVaultName string

@description('App Configuration name')
param appConfigurationName string

@description('Storage account name')
param storageAccountName string

@description('Container Registry name')
param containerRegistryName string

@description('API Container App principal ID')
param apiPrincipalId string

@description('Enrichment Job principal ID')
param jobPrincipalId string

// Outputs
output roleAssignmentCount int    // Number of role assignments created
```

---

## Parameter Files

### parameters/dev.bicepparam

```bicep
using '../main.bicep'

param environmentName = 'dev'
param location = 'westeurope'
param documentDbAdminLogin = 'recallAdmin'
// documentDbAdminPassword provided via --parameters at deployment time
param repositoryUrl = 'https://github.com/adiazcan/recall-core'
param branch = 'main'
```

### parameters/prod.bicepparam

```bicep
using '../main.bicep'

param environmentName = 'prod'
param location = 'westeurope'
param documentDbAdminLogin = 'recallAdmin'
// documentDbAdminPassword provided via --parameters at deployment time
param repositoryUrl = 'https://github.com/adiazcan/recall-core'
param branch = 'main'
```

---

## Deployment Commands

### Deploy to Dev

```bash
az deployment sub create \
  --location westeurope \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam \
  --parameters documentDbAdminPassword='<secure-password>' \
  --name recall-dev-$(date +%Y%m%d%H%M%S)
```

### Deploy to Prod

```bash
az deployment sub create \
  --location westeurope \
  --template-file infra/main.bicep \
  --parameters infra/parameters/prod.bicepparam \
  --parameters documentDbAdminPassword='<secure-password>' \
  --name recall-prod-$(date +%Y%m%d%H%M%S)
```

### Preview Changes (What-If)

```bash
az deployment sub what-if \
  --location westeurope \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam \
  --parameters documentDbAdminPassword='<secure-password>'
```

````