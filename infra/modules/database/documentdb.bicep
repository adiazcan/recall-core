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
@allowed([
  'M25'
  'M40'
])
param tier string = 'M25'

@description('Enable high availability')
param enableHa bool = false

@description('Disk size in GB')
param diskSizeGB int = 32

var clusterName = 'cosmos-recall-${environmentName}'
var highAvailabilityMode = enableHa ? 'ZoneRedundantPreferred' : 'Disabled'
var nodeCount = enableHa ? 3 : 1
var documentDbSecretName = 'DocumentDbConnectionString'

module mongoCluster 'br/public:avm/res/document-db/mongo-cluster:0.4.2' = {
  params: {
    name: clusterName
    location: location
    tags: tags
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    nodeCount: nodeCount
    sku: tier
    storage: diskSizeGB
    highAvailabilityMode: highAvailabilityMode
    enableTelemetry: false
  }
}

resource mongoClusterResource 'Microsoft.DocumentDB/mongoClusters@2024-02-15-preview' existing = {
  name: clusterName
  dependsOn: [
    mongoCluster
  ]
}

resource allowAzureServicesFirewallRule 'Microsoft.DocumentDB/mongoClusters/firewallRules@2024-02-15-preview' = {
  parent: mongoClusterResource
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource documentDbSecret 'Microsoft.KeyVault/vaults/secrets@2024-11-01' = {
  parent: keyVault
  name: documentDbSecretName
  properties: {
    value: mongoCluster.outputs.connectionString
  }
}

// NOTE: Database creation script removed - MongoDB creates databases on first use
// when the application creates its first collection. This avoids Alpine/glibc
// compatibility issues with mongosh in Azure CLI deployment scripts.

output cosmosDbId string = mongoCluster.outputs.mongoClusterResourceId
output cosmosDbName string = mongoCluster.outputs.name
