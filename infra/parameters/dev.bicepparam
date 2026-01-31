using '../main.bicep'

param environmentName = 'dev'
param location = 'westeurope'
param documentDbAdminLogin = 'recallAdmin'
param documentDbAdminPassword = readEnvironmentVariable('DOCUMENTDB_ADMIN_PASSWORD', '')
param repositoryUrl = 'https://github.com/adiazcan/recall-core'
param branch = 'main'
