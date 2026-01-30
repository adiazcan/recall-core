@description('Storage account name')
param storageAccountName string

@description('Principal ID to assign roles to')
param principalId string

@description('Principal type')
@allowed([
  'ServicePrincipal'
  'User'
  'Group'
])
param principalType string = 'ServicePrincipal'

@description('Assign Blob Data Contributor role')
param assignBlobContributor bool = true

@description('Assign Queue Data Contributor role')
param assignQueueContributor bool = true

resource storageAccount 'Microsoft.Storage/storageAccounts@2024-01-01' existing = {
  name: storageAccountName
}

resource blobRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (assignBlobContributor) {
  name: guid(storageAccount.id, principalId, 'storage-blob-data-contributor')
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: principalId
    principalType: principalType
  }
}

resource queueRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (assignQueueContributor) {
  name: guid(storageAccount.id, principalId, 'storage-queue-data-contributor')
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '974c5e8b-45b9-4653-ba55-5f855dd0fb88')
    principalId: principalId
    principalType: principalType
  }
}

var blobRoleIds = assignBlobContributor ? [blobRoleAssignment.id] : []
var queueRoleIds = assignQueueContributor ? [queueRoleAssignment.id] : []

output roleAssignmentIds array = concat(blobRoleIds, queueRoleIds)
