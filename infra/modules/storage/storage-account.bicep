@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('Storage account SKU')
@allowed([
  'Standard_LRS'
  'Standard_GRS'
  'Standard_ZRS'
])
param sku string = 'Standard_LRS'

@description('Blob container names to create')
param blobContainers array = [
  'thumbnails'
]

@description('Queue names to create')
param queues array = [
  'enrichment-queue'
]

var storageAccountName = toLower(replace('strecall${environmentName}', '-', ''))

var blobContainersConfig = [for containerName in blobContainers: {
  name: containerName
  publicAccess: 'None'
}]

var queueConfigs = [for queueName in queues: {
  name: queueName
  metadata: {}
}]

var blobServiceConfig = {
  containers: blobContainersConfig
}

var queueServiceConfig = {
  queues: queueConfigs
}

module storageAccount 'br/public:avm/res/storage/storage-account:0.31.0' = {
  params: {
    name: storageAccountName
    location: location
    tags: tags
    skuName: sku
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    supportsHttpsTrafficOnly: true
    requireInfrastructureEncryption: true
    blobServices: blobServiceConfig
    queueServices: queueServiceConfig
    // Allow access from Azure services using managed identity
    // Network rules default to Deny which blocks Container Apps
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
    enableTelemetry: false
  }
}

output storageAccountId string = storageAccount.outputs.resourceId
output storageAccountName string = storageAccount.outputs.name
output blobEndpoint string = storageAccount.outputs.primaryBlobEndpoint
output queueEndpoint string = storageAccount.outputs.serviceEndpoints.?queue ?? ''
