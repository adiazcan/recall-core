targetScope = 'subscription'

@description('Environment name')
@allowed([
  'dev'
  'prod'
])
param environmentName string

@description('Azure region for all resources')
param location string = 'westeurope'

@description('DocumentDB administrator login')
param documentDbAdminLogin string = 'recallAdmin'

@description('DocumentDB administrator password')
@secure()
@minLength(8)
param documentDbAdminPassword string

@description('GitHub repository URL for SWA')
param repositoryUrl string = 'https://github.com/adiazcan/recall-core'

@description('Git branch for SWA deployment')
param branch string = 'main'

@description('Azure AD Tenant ID for authentication')
param azureAdTenantId string

@description('Azure AD API Client ID')
param azureAdApiClientId string

@description('Azure AD API Audience (typically same as Client ID)')
param azureAdApiAudience string = azureAdApiClientId

@description('Azure AD API Scopes')
param azureAdScopes string = 'access_as_user'

@description('Tags for all resources')
param tags object = {
  environment: environmentName
  project: 'recall-core'
  managedBy: 'bicep'
  costCenter: 'recall-${environmentName}'
}

var resourceGroupName = 'rg-recall-${environmentName}'
var isProd = environmentName == 'prod'
var logRetentionDays = isProd ? 90 : 30
var appConfigSku = isProd ? 'standard' : 'free'
var containerRegistrySku = isProd ? 'Standard' : 'Basic'
var storageSku = isProd ? 'Standard_GRS' : 'Standard_LRS'
var documentDbTier = isProd ? 'M40' : 'M25'
var documentDbDiskSize = isProd ? 64 : 32
var keyVaultSoftDeleteRetentionDays = isProd ? 30 : 7
var apiMinReplicas = isProd ? 1 : 0
var apiMaxReplicas = isProd ? 10 : 3
var enableLinkedBackend = isProd
var actionGroupName = 'ag-recall-${environmentName}'
var actionGroupShortName = 'recall-${environmentName}'

module resourceGroupModule 'modules/core/resource-group.bicep' = {
  params: {
    name: resourceGroupName
    location: location
    tags: tags
  }
}

module logAnalytics 'modules/core/log-analytics.bicep' = {
  scope: resourceGroup(resourceGroupName)
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    retentionInDays: logRetentionDays
  }
  dependsOn: [
    resourceGroupModule
  ]
}

module appInsights 'modules/core/app-insights.bicep' = {
  scope: resourceGroup(resourceGroupName)
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    retentionInDays: logRetentionDays
  }
  dependsOn: [
    resourceGroupModule
  ]
}

module alerts 'modules/core/alerts.bicep' = if (isProd) {
  scope: resourceGroup(resourceGroupName)
  params: {
    appInsightsId: appInsights.outputs.appInsightsId
    actionGroupName: actionGroupName
    actionGroupShortName: actionGroupShortName
    actionGroupEmail: 'adiazcan@hotmail.com'
    tags: tags
    enableAlerts: true
  }
  dependsOn: [
    resourceGroupModule
  ]
}

module keyVault 'modules/core/key-vault.bicep' = {
  scope: resourceGroup(resourceGroupName)
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    enablePurgeProtection: isProd
    softDeleteRetentionInDays: keyVaultSoftDeleteRetentionDays
  }
  dependsOn: [
    resourceGroupModule
  ]
}

module appConfiguration 'modules/core/app-configuration.bicep' = {
  scope: resourceGroup(resourceGroupName)
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    sku: appConfigSku
  }
  dependsOn: [
    resourceGroupModule
  ]
}

module containerRegistry 'modules/container/container-registry.bicep' = {
  scope: resourceGroup(resourceGroupName)
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    sku: containerRegistrySku
  }
  dependsOn: [
    resourceGroupModule
  ]
}

module storageAccount 'modules/storage/storage-account.bicep' = {
  scope: resourceGroup(resourceGroupName)
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    sku: storageSku
  }
  dependsOn: [
    resourceGroupModule
  ]
}

module serviceBus 'modules/messaging/service-bus.bicep' = {
  scope: resourceGroup(resourceGroupName)
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    sku: isProd ? 'Standard' : 'Standard'
  }
  dependsOn: [
    resourceGroupModule
  ]
}

module documentDb 'modules/database/documentdb.bicep' = {
  scope: resourceGroup(resourceGroupName)
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    administratorLogin: documentDbAdminLogin
    administratorPassword: documentDbAdminPassword
    keyVaultName: keyVault.outputs.keyVaultName
    tier: documentDbTier
    enableHa: isProd
    diskSizeGB: documentDbDiskSize
  }
  dependsOn: [
    resourceGroupModule
  ]
}

module containerAppsEnvironment 'modules/container/container-apps-env.bicep' = {
  scope: resourceGroup(resourceGroupName)
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    zoneRedundant: isProd
    daprApplicationInsightsConnectionString: appInsights.outputs.connectionString
  }
  dependsOn: [
    resourceGroupModule
  ]
}

module daprComponents 'modules/container/dapr-components.bicep' = {
  scope: resourceGroup(resourceGroupName)
  params: {
    environmentName: environmentName
    serviceBusNamespaceName: serviceBus.outputs.serviceBusNamespaceName
  }
  dependsOn: [
    containerAppsEnvironment
  ]
}

module apiApp 'modules/container/container-app-api.bicep' = {
  scope: resourceGroup(resourceGroupName)
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    containerAppsEnvironmentId: containerAppsEnvironment.outputs.environmentId
    containerRegistryName: containerRegistry.outputs.acrName
    keyVaultName: keyVault.outputs.keyVaultName
    keyVaultUri: keyVault.outputs.keyVaultUri
    appConfigurationName: appConfiguration.outputs.appConfigName
    appInsightsConnectionString: appInsights.outputs.connectionString
    storageAccountName: storageAccount.outputs.storageAccountName
    serviceBusNamespaceName: serviceBus.outputs.serviceBusNamespaceName
    azureAdTenantId: azureAdTenantId
    azureAdClientId: azureAdApiClientId
    azureAdAudience: azureAdApiAudience
    azureAdScopes: azureAdScopes
    minReplicas: apiMinReplicas
    maxReplicas: apiMaxReplicas
  }
  dependsOn: [
    resourceGroupModule
    documentDb // Ensure DocumentDB secret is created in KeyVault before container app tries to reference it
    daprComponents // Ensure Dapr components are deployed before API starts
  ]
}

module enrichmentJob 'modules/container/container-app-enrichment.bicep' = {
  scope: resourceGroup(resourceGroupName)
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    containerAppsEnvironmentId: containerAppsEnvironment.outputs.environmentId
    containerRegistryName: containerRegistry.outputs.acrName
    keyVaultName: keyVault.outputs.keyVaultName
    keyVaultUri: keyVault.outputs.keyVaultUri
    appConfigurationName: appConfiguration.outputs.appConfigName
    appInsightsConnectionString: appInsights.outputs.connectionString
    storageAccountName: storageAccount.outputs.storageAccountName
    serviceBusNamespaceName: serviceBus.outputs.serviceBusNamespaceName
    minReplicas: apiMinReplicas
    maxReplicas: apiMaxReplicas
  }
  dependsOn: [
    resourceGroupModule
    documentDb // Ensure DocumentDB secret is created in KeyVault before container job tries to reference it
    daprComponents // Ensure Dapr components are deployed before enrichment starts
  ]
}

module storageRolesApi 'modules/storage/storage-roles.bicep' = {
  scope: resourceGroup(resourceGroupName)
  params: {
    storageAccountName: storageAccount.outputs.storageAccountName
    principalId: apiApp.outputs.apiPrincipalId
    principalType: 'ServicePrincipal'
  }
  dependsOn: [
    resourceGroupModule
  ]
}

module storageRolesJob 'modules/storage/storage-roles.bicep' = {
  scope: resourceGroup(resourceGroupName)
  params: {
    storageAccountName: storageAccount.outputs.storageAccountName
    principalId: enrichmentJob.outputs.enrichmentPrincipalId
    principalType: 'ServicePrincipal'
  }
  dependsOn: [
    resourceGroupModule
  ]
}

module serviceBusRolesApi 'modules/messaging/service-bus-roles.bicep' = {
  scope: resourceGroup(resourceGroupName)
  params: {
    serviceBusNamespaceName: serviceBus.outputs.serviceBusNamespaceName
    principalId: apiApp.outputs.apiPrincipalId
    principalType: 'ServicePrincipal'
    enableSender: true
    enableReceiver: false
  }
  dependsOn: [
    resourceGroupModule
  ]
}

module serviceBusRolesJob 'modules/messaging/service-bus-roles.bicep' = {
  scope: resourceGroup(resourceGroupName)
  params: {
    serviceBusNamespaceName: serviceBus.outputs.serviceBusNamespaceName
    principalId: enrichmentJob.outputs.enrichmentPrincipalId
    principalType: 'ServicePrincipal'
    enableSender: false
    enableReceiver: true
  }
  dependsOn: [
    resourceGroupModule
  ]
}

module staticWebApp 'modules/web/static-web-app.bicep' = {
  scope: resourceGroup(resourceGroupName)
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    repositoryUrl: repositoryUrl
    branch: branch
    appLocation: 'src/web'
    outputLocation: 'dist'
    apiContainerAppResourceId: enableLinkedBackend ? apiApp.outputs.apiAppId : ''
    enableLinkedBackend: enableLinkedBackend
  }
  dependsOn: [
    resourceGroupModule
  ]
}

output resourceGroupName string = resourceGroupName
output apiEndpoint string = apiApp.outputs.apiAppFqdn
output swaEndpoint string = staticWebApp.outputs.swaDefaultHostname
output acrLoginServer string = containerRegistry.outputs.acrLoginServer
output keyVaultName string = keyVault.outputs.keyVaultName
output appConfigEndpoint string = appConfiguration.outputs.appConfigEndpoint
output storageAccountName string = storageAccount.outputs.storageAccountName
output appInsightsConnectionString string = appInsights.outputs.connectionString
output serviceBusNamespace string = serviceBus.outputs.serviceBusNamespaceName
output enrichmentTopicName string = serviceBus.outputs.enrichmentTopicName
