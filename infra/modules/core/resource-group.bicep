targetScope = 'subscription'

@description('Resource group name')
param name string

@description('Azure region')
param location string

@description('Tags')
param tags object = {}

module rg 'br/public:avm/res/resources/resource-group:0.4.3' = {
  params: {
    name: name
    location: location
    tags: tags
    enableTelemetry: false
  }
}

output name string = rg.outputs.name
output id string = rg.outputs.resourceId
