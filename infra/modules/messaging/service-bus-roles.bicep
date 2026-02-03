@description('Service Bus namespace name')
param serviceBusNamespaceName string

@description('Principal ID for role assignment')
param principalId string

@description('Principal type (ServicePrincipal, User, Group)')
@allowed([
  'ServicePrincipal'
  'User'
  'Group'
])
param principalType string = 'ServicePrincipal'

@description('Enable Data Sender role assignment')
param enableSender bool = false

@description('Enable Data Receiver role assignment')
param enableReceiver bool = false

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2024-01-01' existing = {
  name: serviceBusNamespaceName
}

var serviceBusDataSenderRoleId = '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
var serviceBusDataReceiverRoleId = '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0'

resource dataReceiverRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (enableReceiver) {
  name: guid(serviceBusNamespace.id, principalId, serviceBusDataReceiverRoleId)
  scope: serviceBusNamespace
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', serviceBusDataReceiverRoleId)
    principalId: principalId
    principalType: principalType
  }
}

resource dataSenderRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (enableSender) {
  name: guid(serviceBusNamespace.id, principalId, serviceBusDataSenderRoleId)
  scope: serviceBusNamespace
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', serviceBusDataSenderRoleId)
    principalId: principalId
    principalType: principalType
  }
}

