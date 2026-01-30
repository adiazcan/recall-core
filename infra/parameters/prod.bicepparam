using '../main.bicep'

param environmentName = 'prod'
param location = 'westeurope'
param documentDbAdminLogin = 'recallAdmin'
// documentDbAdminPassword provided at deployment time
param repositoryUrl = 'https://github.com/adiazcan/recall-core'
param branch = 'main'
