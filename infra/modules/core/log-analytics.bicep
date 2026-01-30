@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('Retention in days (30 for dev, 90 for prod)')
param retentionInDays int = 30

var workspaceName = 'log-recall-${environmentName}'

module workspace 'br/public:avm/res/operational-insights/workspace:0.15.0' = {
  params: {
    name: workspaceName
    location: location
    tags: tags
    dataRetention: retentionInDays
    enableTelemetry: false
  }
}

resource workspaceResource 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing = {
  name: workspaceName
}

output workspaceId string = workspace.outputs.resourceId
output workspaceName string = workspace.outputs.name
output customerId string = workspaceResource.properties.customerId
