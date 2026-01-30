# GitHub OIDC Setup for Azure Deployments

This guide configures GitHub Actions to deploy Azure resources with OIDC federation (no stored client secrets).

## Prerequisites

- Azure CLI 2.60+
- Contributor access to the target subscription or resource group
- GitHub repository admin access

## 1) Create an App Registration and Service Principal

```bash
APP_NAME="recall-github-actions"
APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
az ad sp create --id "$APP_ID"

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

echo "AZURE_CLIENT_ID=$APP_ID"
echo "AZURE_TENANT_ID=$TENANT_ID"
echo "AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID"
```

## 2) Create Federated Credentials (dev and prod)

```bash
REPO_OWNER="adiazcan"
REPO_NAME="recall-core"

az ad app federated-credential create --id "$APP_ID" --parameters "$(cat <<JSON
{
  \"name\": \"github-dev\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:${REPO_OWNER}/${REPO_NAME}:environment:dev\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}
JSON
)"

az ad app federated-credential create --id "$APP_ID" --parameters "$(cat <<JSON
{
  \"name\": \"github-prod\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:${REPO_OWNER}/${REPO_NAME}:environment:prod\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}
JSON
)"
```

## 3) Assign Roles

At minimum, assign `Contributor` on the resource group. For a subscription-scope deployment, assign at the subscription scope.

```bash
az role assignment create \
  --assignee "$APP_ID" \
  --role "Contributor" \
  --scope "/subscriptions/$SUBSCRIPTION_ID"
```

For image pushes, also assign `AcrPush` on the registry resource:

```bash
az role assignment create \
  --assignee "$APP_ID" \
  --role "AcrPush" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/rg-recall-dev/providers/Microsoft.ContainerRegistry/registries/crrecalldev"
```

## 4) Configure GitHub Environments

Create `dev` and `prod` environments in repository settings. Add the following:

**Environment variables**
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `VITE_API_BASE_URL` (for web deploy workflow)

**Environment secrets**
- `DOCUMENTDB_ADMIN_PASSWORD` (infra deploy)
- `AZURE_STATIC_WEB_APPS_API_TOKEN_DEV` (dev only)
- `AZURE_STATIC_WEB_APPS_API_TOKEN_PROD` (prod only)

## 5) Validate Login

Trigger any of the deployment workflows (e.g., infrastructure deploy) and confirm the Azure login step succeeds.
