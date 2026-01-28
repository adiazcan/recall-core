#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-recall-core-github-actions}"
GITHUB_REPO="${GITHUB_REPO:-}"
RESOURCE_GROUP_SCOPE="${RESOURCE_GROUP_SCOPE:-}"
STATE_RG="${STATE_RG:-recall-tfstate-rg}"

if [[ -z "${GITHUB_REPO}" ]]; then
  echo "GITHUB_REPO is required (e.g., 'YOUR_ORG/recall-core')." >&2
  exit 1
fi

if ! az account show >/dev/null 2>&1; then
  echo "Azure CLI not logged in. Run 'az login' first." >&2
  exit 1
fi

SUBSCRIPTION_ID="${SUBSCRIPTION_ID:-$(az account show --query id -o tsv)}"
TENANT_ID="${TENANT_ID:-$(az account show --query tenantId -o tsv)}"

APP_ID="$(az ad app create --display-name "${APP_NAME}" --query appId -o tsv)"
OBJECT_ID="$(az ad app show --id "${APP_ID}" --query id -o tsv)"

az ad sp create --id "${APP_ID}" >/dev/null

for ENVIRONMENT in dev prod; do
  az ad app federated-credential create \
    --id "${OBJECT_ID}" \
    --parameters "{\"name\":\"github-actions-${ENVIRONMENT}\",\"issuer\":\"https://token.actions.githubusercontent.com\",\"subject\":\"repo:${GITHUB_REPO}:environment:${ENVIRONMENT}\",\"audiences\":[\"api://AzureADTokenExchange\"]}" \
    --output none

  echo "Added federated credential: ${ENVIRONMENT}"
done

if [[ -n "${RESOURCE_GROUP_SCOPE}" ]]; then
  az role assignment create \
    --assignee "${APP_ID}" \
    --role Contributor \
    --scope "${RESOURCE_GROUP_SCOPE}" \
    --output none
else
  az role assignment create \
    --assignee "${APP_ID}" \
    --role Contributor \
    --scope "/subscriptions/${SUBSCRIPTION_ID}" \
    --output none
fi

if az group show --name "${STATE_RG}" >/dev/null 2>&1; then
  az role assignment create \
    --assignee "${APP_ID}" \
    --role "Storage Blob Data Contributor" \
    --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${STATE_RG}" \
    --output none
else
  echo "State resource group ${STATE_RG} not found; skipping state RBAC assignment."
fi

echo "✅ OIDC configured"
echo "AZURE_CLIENT_ID=${APP_ID}"
echo "AZURE_TENANT_ID=${TENANT_ID}"
echo "AZURE_SUBSCRIPTION_ID=${SUBSCRIPTION_ID}"
