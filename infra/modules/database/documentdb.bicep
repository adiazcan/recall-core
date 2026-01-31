@description('Environment name for naming')
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@description('Tags')
param tags object = {}

@description('Administrator login username')
param administratorLogin string = 'recallAdmin'

@description('Administrator login password')
@secure()
param administratorPassword string

@description('Key Vault name to store connection string')
param keyVaultName string

@description('Compute tier: M25 (dev) or M40 (prod)')
@allowed([
  'M25'
  'M40'
])
param tier string = 'M25'

@description('Enable high availability')
param enableHa bool = false

@description('Disk size in GB')
param diskSizeGB int = 32

var clusterName = 'cosmos-recall-${environmentName}'
var highAvailabilityMode = enableHa ? 'ZoneRedundantPreferred' : 'Disabled'
var nodeCount = enableHa ? 3 : 1
var documentDbSecretName = 'DocumentDbConnectionString'
var databaseName = 'recall'

module mongoCluster 'br/public:avm/res/document-db/mongo-cluster:0.4.2' = {
  params: {
    name: clusterName
    location: location
    tags: tags
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    nodeCount: nodeCount
    sku: tier
    storage: diskSizeGB
    highAvailabilityMode: highAvailabilityMode
    enableTelemetry: false
  }
}

resource mongoClusterResource 'Microsoft.DocumentDB/mongoClusters@2024-02-15-preview' existing = {
  name: clusterName
  dependsOn: [
    mongoCluster
  ]
}

resource allowAzureServicesFirewallRule 'Microsoft.DocumentDB/mongoClusters/firewallRules@2024-02-15-preview' = {
  parent: mongoClusterResource
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource documentDbSecret 'Microsoft.KeyVault/vaults/secrets@2024-11-01' = {
  parent: keyVault
  name: documentDbSecretName
  properties: {
    value: mongoCluster.outputs.connectionString
  }
}

resource createDatabaseScript 'Microsoft.Resources/deploymentScripts@2020-10-01' = {
  name: 'create-${databaseName}-db-${environmentName}'
  location: location
  tags: tags
  kind: 'AzureCLI'
  properties: {
    azCliVersion: '2.60.0'
    timeout: 'PT30M'
    cleanupPreference: 'OnSuccess'
    retentionInterval: 'P1D'
    environmentVariables: [
      {
        name: 'MONGO_CONN'
        secureValue: mongoCluster.outputs.connectionString
      }
      {
        name: 'DB_NAME'
        value: databaseName
      }
    ]
    scriptContent: '''
      set -euo pipefail

      # mongosh version and download details
      MONGOSH_VERSION="2.6.0"
      MONGOSH_URL="https://downloads.mongodb.com/compass/mongosh-${MONGOSH_VERSION}-linux-x64.tgz"
      MONGOSH_SHA256="7d4e9d96613fe6c2b88514114e8fba924fd6e0628def8693455281ca1c77bd45"
      MONGOSH_TGZ="/tmp/mongosh.tgz"
      MONGOSH_DIR="/tmp/mongosh-${MONGOSH_VERSION}-linux-x64"
      MONGOSH_BIN="${MONGOSH_DIR}/bin/mongosh"

      # Download mongosh using wget (curl not available in AzureCLI container)
      echo "Downloading mongosh ${MONGOSH_VERSION}..."
      wget -q "${MONGOSH_URL}" -O "${MONGOSH_TGZ}"
      
      # Verify checksum
      echo "${MONGOSH_SHA256}  ${MONGOSH_TGZ}" | sha256sum -c -
      
      # Extract mongosh
      echo "Extracting mongosh..."
      tar -xzf "${MONGOSH_TGZ}" -C /tmp
      
      # Validate extraction
      if [ ! -f "${MONGOSH_BIN}" ]; then
        echo "Error: mongosh binary not found at ${MONGOSH_BIN}"
        exit 1
      fi
      
      chmod +x "${MONGOSH_BIN}"
      
      # Use mongosh to create database
      echo "Creating database..."
      "${MONGOSH_BIN}" "$MONGO_CONN" --quiet --eval "const dbName = process.env.DB_NAME || 'recall'; const db = db.getSiblingDB(dbName); if (!db.getCollectionNames().includes('_init')) { db.createCollection('_init'); }"
      echo "Database creation completed successfully."
    '''
  }
}

output cosmosDbId string = mongoCluster.outputs.mongoClusterResourceId
output cosmosDbName string = mongoCluster.outputs.name
