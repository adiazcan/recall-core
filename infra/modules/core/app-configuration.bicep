@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('SKU: free or standard')
@allowed(['free', 'standard'])
param sku string = 'free'

var appConfigName = 'appcs-recall-${environmentName}'
var skuName = sku == 'standard' ? 'Standard' : 'Free'
var enablePurgeProtection = skuName != 'Free'

module appConfig 'br/public:avm/res/app-configuration/configuration-store:0.9.2' = {
  params: {
    name: appConfigName
    location: location
    tags: tags
    sku: skuName
    disableLocalAuth: true
    enablePurgeProtection: enablePurgeProtection
    enableTelemetry: false
  }
}

output appConfigId string = appConfig.outputs.resourceId
output appConfigName string = appConfig.outputs.name
output appConfigEndpoint string = appConfig.outputs.endpoint
