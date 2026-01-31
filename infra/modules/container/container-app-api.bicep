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

@description('Key Vault URI')
param keyVaultUri string

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

var appName = 'aca-recall-api-${environmentName}'
var registryServer = '${containerRegistryName}.azurecr.io'
var imageName = '${registryServer}/recall-api:${containerImageTag}'
var activeRevisionsMode = environmentName == 'prod' ? 'Multiple' : 'Single'
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

module apiApp 'br/public:avm/res/app/container-app:0.20.0' = {
  params: {
    name: appName
    location: location
    tags: tags
    environmentResourceId: containerAppsEnvironmentId
    activeRevisionsMode: activeRevisionsMode
    managedIdentities: {
      systemAssigned: true
    }
    registries: [
      {
        server: registryServer
        identity: 'system'
      }
    ]
    secrets: [
      {
        name: toLower(documentDbSecretName)
        keyVaultUrl: keyVaultSecretUrl
        identity: 'system'
      }
    ]
    containers: [
      {
        name: 'recall-api'
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
            name: 'Storage__AccountName'
            value: storageAccountName
          }
          {
            name: 'Storage__BlobServiceUri'
            value: 'https://${storageAccountName}.blob.${environment().suffixes.storage}'
          }
          {
            name: 'Storage__QueueServiceUri'
            value: 'https://${storageAccountName}.queue.${environment().suffixes.storage}'
          }
          {
            name: 'ConnectionStrings__recalldb'
            secretRef: toLower(documentDbSecretName)
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
    ingressExternal: true
    ingressAllowInsecure: false
    ingressTargetPort: 8080
    scaleSettings: {
      minReplicas: minReplicas
      maxReplicas: maxReplicas
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
    enableTelemetry: false
  }
}

var apiPrincipalId = apiApp.outputs.?systemAssignedMIPrincipalId ?? ''

var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
var appConfigDataReaderRoleId = '516239f1-63e1-4d78-a4de-a74fb236a071'
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource keyVaultSecretsUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, appName, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: apiPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource appConfigDataReaderRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(appConfiguration.id, appName, appConfigDataReaderRoleId)
  scope: appConfiguration
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', appConfigDataReaderRoleId)
    principalId: apiPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, appName, acrPullRoleId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: apiPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output apiAppId string = apiApp.outputs.resourceId
output apiAppName string = apiApp.outputs.name
output apiAppFqdn string = apiApp.outputs.fqdn
output apiPrincipalId string = apiPrincipalId
