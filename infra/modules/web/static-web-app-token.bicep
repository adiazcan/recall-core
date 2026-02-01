@description('Name of the existing Static Web App')
param staticSiteName string

resource staticSiteResource 'Microsoft.Web/staticSites@2024-04-01' existing = {
  name: staticSiteName
}

@secure()
output deploymentToken string = staticSiteResource.listSecrets().properties.apiKey
