using '../main.bicep'

param environmentName = 'dev'
param location = 'westeurope'
param documentDbAdminLogin = 'recallAdmin'
param documentDbAdminPassword = readEnvironmentVariable('DOCUMENTDB_ADMIN_PASSWORD', '')
param repositoryUrl = 'https://github.com/adiazcan/recall-core'
param branch = 'main'
param azureAdTenantId = readEnvironmentVariable('AZUREAD_TENANT_ID', '')
param azureAdApiClientId = readEnvironmentVariable('AZUREAD_API_CLIENT_ID', '')
param azureAdApiAudience = readEnvironmentVariable('AZUREAD_API_AUDIENCE', '')
param azureAdScopes = 'access_as_user'
