@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('GitHub repository URL')
param repositoryUrl string

@description('Git branch')
param branch string = 'main'

@description('App location in repository')
param appLocation string = 'src/web'

@description('Build output location')
param outputLocation string = 'dist'

@description('API Container App resource ID for linked backend')
param apiContainerAppResourceId string = ''

@description('Enable linked backend (requires Standard SKU)')
param enableLinkedBackend bool = false

var staticSiteName = 'swa-recall-${environmentName}'
var sku = environmentName == 'prod' ? 'Standard' : 'Free'
var linkedBackendConfig = enableLinkedBackend && apiContainerAppResourceId != '' ? {
  resourceId: apiContainerAppResourceId
  location: location
} : {}
var buildProperties = {
  appLocation: appLocation
  apiLocation: ''
  outputLocation: outputLocation
}

module staticSite 'br/public:avm/res/web/static-site:0.9.3' = {
  params: {
    name: staticSiteName
    location: location
    tags: tags
    repositoryUrl: repositoryUrl
    branch: branch
    sku: sku
    buildProperties: buildProperties
    linkedBackend: linkedBackendConfig
    enableTelemetry: false
  }
}

resource staticSiteResource 'Microsoft.Web/staticSites@2024-04-01' existing = {
  name: staticSiteName
}

var deploymentToken = staticSiteResource.listSecrets().properties.apiKey

output swaId string = staticSite.outputs.resourceId
output swaName string = staticSite.outputs.name
output swaDefaultHostname string = staticSite.outputs.defaultHostname
@secure()
output swaDeploymentToken string = deploymentToken
