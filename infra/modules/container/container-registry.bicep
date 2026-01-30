@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('SKU: Basic or Standard')
@allowed(['Basic', 'Standard'])
param sku string = 'Basic'

var acrName = 'crrecall${environmentName}'

module acr 'br/public:avm/res/container-registry/registry:0.10.0' = {
  params: {
    name: acrName
    location: location
    tags: tags
    acrSku: sku
    acrAdminUserEnabled: false
    enableTelemetry: false
  }
}

output acrId string = acr.outputs.resourceId
output acrName string = acr.outputs.name
output acrLoginServer string = acr.outputs.loginServer
