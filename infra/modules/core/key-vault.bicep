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

var keyVaultName = 'kv-recall-${environmentName}'

module keyVault 'br/public:avm/res/key-vault/vault:0.13.3' = {
  params: {
    name: keyVaultName
    location: location
    tags: tags
    enablePurgeProtection: enablePurgeProtection
    softDeleteRetentionInDays: softDeleteRetentionInDays
    enableRbacAuthorization: true
    enableTelemetry: false
  }
}

output keyVaultId string = keyVault.outputs.resourceId
output keyVaultName string = keyVault.outputs.name
output keyVaultUri string = keyVault.outputs.uri
