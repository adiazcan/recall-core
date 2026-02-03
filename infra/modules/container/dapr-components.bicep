@description('Container Apps Environment name')
param environmentName string

@description('Service Bus namespace name')
param serviceBusNamespaceName string

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: 'cae-recall-${environmentName}'
}

resource pubsubComponent 'Microsoft.App/managedEnvironments/daprComponents@2024-03-01' = {
  parent: containerAppsEnvironment
  name: 'enrichment-pubsub'
  properties: {
    componentType: 'pubsub.azure.servicebus.topics'
    version: 'v1'
    metadata: [
      {
        name: 'namespaceName'
        value: '${serviceBusNamespaceName}.servicebus.windows.net'
      }
      {
        name: 'maxConcurrentHandlers'
        value: '5'
      }
      {
        name: 'timeoutInSec'
        value: '60'
      }
      {
        name: 'maxActiveMessages'
        value: '100'
      }
      {
        name: 'maxActiveMessagesRecoveryInSec'
        value: '2'
      }
      {
        name: 'lockDurationInSec'
        value: '300'
      }
      {
        name: 'disableEntityManagement'
        value: 'true'
      }
    ]
    scopes: [
      'api'
      'enrichment'
    ]
  }
}

output pubsubComponentName string = pubsubComponent.name

