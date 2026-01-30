using '../main.bicep'

param environmentName = 'dev'
param location = 'westeurope'
param documentDbAdminLogin = 'recallAdmin'
// documentDbAdminPassword provided at deployment time
param repositoryUrl = 'https://github.com/adiazcan/recall-core'
param branch = 'main'
