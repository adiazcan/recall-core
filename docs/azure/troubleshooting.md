# Azure Troubleshooting Guide

**Feature**: 007-azure-infra

## Terraform Init Fails

**Symptom**
```
Error: Failed to get existing workspaces: storage: service returned error
```

**Fix**
- Ensure Azure CLI is logged in: `az login`
- Confirm subscription: `az account set --subscription "<name or id>"`
- Verify access to the state storage account and container.

## Container App Fails to Start

**Checks**
- View logs:
  - `az containerapp logs show -n recall-api-dev -g recall-dev-rg --tail 100`
- List revisions:
  - `az containerapp revision list -n recall-api-dev -g recall-dev-rg -o table`

**Common Causes**
- Incorrect image tag
- Missing Key Vault secret reference
- Missing role assignments (Key Vault/Storage)

## DocumentDB Connection Fails

**Checks**
- Verify Key Vault secret exists:
  - `az keyvault secret show --vault-name recall-dev-kv --name documentdb-connection-string`
- Confirm managed identity RBAC:
  - `az role assignment list --assignee <api-principal-id> --scope <key-vault-id> -o table`

## Static Web App Deployment Fails

**Checks**
- Confirm deployment token is set for the environment:
  - `terraform output -raw static_web_app_api_key`
- Verify `AZURE_STATIC_WEB_APPS_API_TOKEN_DEV` or `AZURE_STATIC_WEB_APPS_API_TOKEN_PROD` in GitHub environment secrets.

## Dapr Pub/Sub Not Receiving Events

**Checks**
- Confirm queue name matches `enrichment-queue`.
- Confirm storage connection string secret is configured for the enrichment app.
- Validate Dapr component name `enrichment-pubsub` in Container Apps configuration.
