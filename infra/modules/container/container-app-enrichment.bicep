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

@description('Key Vault URI')
param keyVaultUri string

@description('App Configuration name')
param appConfigurationName string

@description('Application Insights connection string')
param appInsightsConnectionString string

@description('Storage account name')
param storageAccountName string

@description('Service Bus namespace name')
param serviceBusNamespaceName string

@description('Minimum replicas')
param minReplicas int = 0

@description('Maximum replicas')
param maxReplicas int = 3

@description('CPU allocation')
param cpu string = '1.0'

@description('Memory allocation')
param memory string = '2Gi'

var appName = 'aca-recall-enrichment-${environmentName}'
var registryServer = '${containerRegistryName}.azurecr.io'
var imageName = '${registryServer}/recall-enrichment:${containerImageTag}'
var documentDbSecretName = 'DocumentDbConnectionString'
// Construct Key Vault secret URL without trailing slash duplication
var keyVaultSecretUrl = '${keyVaultUri}secrets/${documentDbSecretName}'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource appConfiguration 'Microsoft.AppConfiguration/configurationStores@2023-03-01' existing = {
  name: appConfigurationName
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: containerRegistryName
}

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2024-01-01' existing = {
  name: serviceBusNamespaceName
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2024-01-01' existing = {
  name: storageAccountName
}

// Create User-Assigned Managed Identity to assign roles before Container App creation
resource userAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${appName}'
  location: location
  tags: tags
}

// Define role IDs
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
var appConfigDataReaderRoleId = '516239f1-63e1-4d78-a4de-a74fb236a071'
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var serviceBusDataReceiverRoleId = '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0'
var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

// Assign roles BEFORE creating the Container App to avoid pull errors
resource keyVaultSecretsUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, appName, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: userAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource appConfigDataReaderRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(appConfiguration.id, appName, appConfigDataReaderRoleId)
  scope: appConfiguration
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', appConfigDataReaderRoleId)
    principalId: userAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, appName, acrPullRoleId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: userAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Service Bus Data Receiver role must be assigned BEFORE container app creation for scaler validation
resource serviceBusDataReceiverRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(serviceBusNamespace.id, appName, serviceBusDataReceiverRoleId)
  scope: serviceBusNamespace
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', serviceBusDataReceiverRoleId)
    principalId: userAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Storage Blob Data Contributor role must be assigned BEFORE container app creation
resource storageBlobDataContributorRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, appName, storageBlobDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: userAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Create Container App with User-Assigned Managed Identity (roles already assigned)
module enrichmentApp 'br/public:avm/res/app/container-app:0.20.0' = {
  params: {
    name: appName
    location: location
    tags: tags
    environmentResourceId: containerAppsEnvironmentId
    activeRevisionsMode: 'Single'
    dapr: {
      enabled: true
      appId: 'enrichment'
      appPort: 8080
      appProtocol: 'http'
      enableApiLogging: true
    }
    managedIdentities: {
      userAssignedResourceIds: [
        userAssignedIdentity.id
      ]
    }
    registries: [
      {
        server: registryServer
        identity: userAssignedIdentity.id
      }
    ]
    secrets: [
      {
        name: toLower(documentDbSecretName)
        keyVaultUrl: keyVaultSecretUrl
        identity: userAssignedIdentity.id
      }
    ]
    containers: [
      {
        name: 'recall-enrichment'
        image: imageName
        resources: {
          cpu: json(cpu)
          memory: memory
        }
        env: [
          {
            name: 'ASPNETCORE_ENVIRONMENT'
            value: environmentName == 'prod' ? 'Production' : 'Development'
          }
          {
            name: 'ASPNETCORE_URLS'
            value: 'http://+:8080'
          }
          {
            name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
            value: appInsightsConnectionString
          }
          {
            name: 'AzureAppConfiguration__Endpoint'
            value: 'https://${appConfigurationName}.azconfig.io'
          }
          {
            name: 'AZURE_CLIENT_ID'
            value: userAssignedIdentity.properties.clientId
          }
          {
            name: 'ConnectionStrings__recalldb'
            secretRef: toLower(documentDbSecretName)
          }
          {
            name: 'Storage__BlobServiceUri'
            value: 'https://${storageAccountName}.blob.${environment().suffixes.storage}'
          }
          {
            name: 'Storage__AccountName'
            value: storageAccountName
          }
          {
            name: 'ServiceBus__FullyQualifiedNamespace'
            value: '${serviceBusNamespaceName}.servicebus.windows.net'
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
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 30
            timeoutSeconds: 5
          }
          {
            type: 'Liveness'
            httpGet: {
              path: '/health'
              port: 8080
              scheme: 'HTTP'
            }
            periodSeconds: 30
            failureThreshold: 3
          }
          {
            type: 'Readiness'
            httpGet: {
              path: '/health'
              port: 8080
              scheme: 'HTTP'
            }
            periodSeconds: 10
            failureThreshold: 3
          }
        ]
      }
    ]
    ingressExternal: false
    ingressTargetPort: 8080
    scaleSettings: {
      minReplicas: minReplicas
      maxReplicas: maxReplicas
      rules: [
        {
          name: 'servicebus-scale'
          custom: {
            type: 'azure-servicebus'
            metadata: {
              topicName: 'enrichment.requested'
              subscriptionName: 'enrichment-worker'
              messageCount: '5'
              namespace: '${serviceBusNamespaceName}.servicebus.windows.net'
            }
            identity: userAssignedIdentity.id
          }
        }
      ]
    }
    enableTelemetry: false
  }
  dependsOn: [
    keyVaultSecretsUserRole
    appConfigDataReaderRole
    acrPullRole
    serviceBusDataReceiverRole
    storageBlobDataContributorRole
  ]
}

var enrichmentPrincipalId = userAssignedIdentity.properties.principalId

output enrichmentAppId string = enrichmentApp.outputs.resourceId
output enrichmentAppName string = enrichmentApp.outputs.name
output enrichmentPrincipalId string = enrichmentPrincipalId

