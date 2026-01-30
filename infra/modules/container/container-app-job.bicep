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
var imageName = '${registryServer}/recall-enrichment:${containerImageTag}'
var keyVaultUri = 'https://${keyVaultName}.vault.azure.net'
var documentDbSecretName = 'DocumentDbConnectionString'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: containerRegistryName
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2024-01-01' existing = {
  name: storageAccountName
}

var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${listKeys(storageAccount.id, '2024-01-01').keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

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
              storageAccountResourceId: storageAccount.id
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
    replicaRetryLimit: replicaRetryLimit
    replicaTimeout: replicaTimeout
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
        name: 'documentdb-connection-string'
        keyVaultUrl: '${keyVaultUri}/secrets/${documentDbSecretName}'
        identity: 'system'
      }
      {
        name: 'storage-connection'
        value: storageConnectionString
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
            name: 'ConnectionStrings__recalldb'
            secretRef: 'documentdb-connection-string'
          }
          {
            name: 'ConnectionStrings__blobs'
            secretRef: 'storage-connection'
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

var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource keyVaultSecretsUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, job.outputs.systemAssignedMIPrincipalId, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: job.outputs.systemAssignedMIPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, job.outputs.systemAssignedMIPrincipalId, acrPullRoleId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: job.outputs.systemAssignedMIPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output jobId string = job.outputs.resourceId
output jobName string = job.outputs.name
output jobPrincipalId string = job.outputs.systemAssignedMIPrincipalId
