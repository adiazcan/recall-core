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

@description('Use placeholder image for initial deployment (before pushing real images to ACR)')
param usePlaceholderImage bool = true

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

@description('Queue name to trigger on')
param queueName string = 'enrichment-queue'

@description('Polling interval in seconds')
param pollingInterval int = 30

@description('Max concurrent executions')
param maxExecutions int = 5

@description('Replica timeout in seconds')
param replicaTimeout int = 300

@description('Replica retry limit')
param replicaRetryLimit int = 3

@description('CPU allocation')
param cpu string = '1.0'

@description('Memory allocation')
param memory string = '2Gi'

var jobName = 'acj-recall-enrichment-${environmentName}'
var registryServer = '${containerRegistryName}.azurecr.io'
var acrImageName = '${registryServer}/recall-enrichment:${containerImageTag}'
var placeholderImage = 'mcr.microsoft.com/k8se/quickstart:latest'
var imageName = usePlaceholderImage ? placeholderImage : acrImageName
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

module job 'br/public:avm/res/app/job:0.7.1' = {
  params: {
    name: jobName
    location: location
    tags: tags
    environmentResourceId: containerAppsEnvironmentId
    triggerType: 'Event'
    eventTriggerConfig: {
      parallelism: 1
      replicaCompletionCount: 1
      scale: {
        minExecutions: 0
        maxExecutions: maxExecutions
        pollingInterval: pollingInterval
        rules: [
          {
            name: 'storage-queue'
            type: 'azure-queue'
            metadata: {
              queueName: queueName
              accountName: storageAccountName
            }
            identity: 'system'
          }
        ]
      }
    }
    replicaRetryLimit: replicaRetryLimit
    replicaTimeout: replicaTimeout
    managedIdentities: {
      systemAssigned: true
    }
    registries: usePlaceholderImage ? [] : [
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
        name: 'recall-enrichment'
        image: imageName
        resources: {
          cpu: cpu
          memory: memory
        }
        env: usePlaceholderImage ? [] : [
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
            name: 'ConnectionStrings__recalldb'
            secretRef: toLower(documentDbSecretName)
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
            name: 'Storage__QueueName'
            value: queueName
          }
          {
            name: 'Storage__AccountName'
            value: storageAccountName
          }
        ]
      }
    ]
    enableTelemetry: false
  }
}

var jobPrincipalId = job.outputs.?systemAssignedMIPrincipalId ?? ''

var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
var appConfigDataReaderRoleId = '516239f1-63e1-4d78-a4de-a74fb236a071'
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource keyVaultSecretsUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, jobName, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: jobPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource appConfigDataReaderRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(appConfiguration.id, jobName, appConfigDataReaderRoleId)
  scope: appConfiguration
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', appConfigDataReaderRoleId)
    principalId: jobPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, jobName, acrPullRoleId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: jobPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output jobId string = job.outputs.resourceId
output jobName string = job.outputs.name
output jobPrincipalId string = jobPrincipalId
