@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('Log Analytics workspace resource ID')
param logAnalyticsWorkspaceId string

@description('Enable zone redundancy (prod only)')
param zoneRedundant bool = false

@description('Dapr Application Insights connection string for telemetry')
param daprApplicationInsightsConnectionString string = ''

var environmentNameValue = 'cae-recall-${environmentName}'
var logAnalyticsResourceGroupName = split(logAnalyticsWorkspaceId, '/')[4]
var logAnalyticsWorkspaceName = split(logAnalyticsWorkspaceId, '/')[8]

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing = {
  name: logAnalyticsWorkspaceName
  scope: resourceGroup(logAnalyticsResourceGroupName)
}

var logAnalyticsSharedKey = listKeys(logAnalyticsWorkspaceId, '2022-10-01').primarySharedKey

module managedEnvironment 'br/public:avm/res/app/managed-environment:0.11.3' = {
  params: {
    name: environmentNameValue
    location: location
    tags: tags
    zoneRedundant: zoneRedundant
    publicNetworkAccess: 'Enabled'
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsSharedKey
      }
    }
    daprAIConnectionString: daprApplicationInsightsConnectionString
    daprAIInstrumentationKey: ''
    enableTelemetry: false
  }
}

output environmentId string = managedEnvironment.outputs.resourceId
output environmentName string = managedEnvironment.outputs.name
output defaultDomain string = managedEnvironment.outputs.defaultDomain
