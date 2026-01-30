@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('Log Analytics workspace resource ID')
param logAnalyticsWorkspaceId string

@description('Retention in days')
param retentionInDays int = 30

var appInsightsName = 'appi-recall-${environmentName}'

module appInsights 'br/public:avm/res/insights/component:0.7.1' = {
  params: {
    name: appInsightsName
    location: location
    tags: tags
    workspaceResourceId: logAnalyticsWorkspaceId
    retentionInDays: retentionInDays
    applicationType: 'web'
    enableTelemetry: false
  }
}

output appInsightsId string = appInsights.outputs.resourceId
output appInsightsName string = appInsights.outputs.name
output connectionString string = appInsights.outputs.connectionString
output instrumentationKey string = appInsights.outputs.instrumentationKey
