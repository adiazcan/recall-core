#!/usr/bin/env bash
set -euo pipefail

LOCATION="${LOCATION:-swedencentral}"
STATE_RG="${STATE_RG:-recall-tfstate-rg}"
STATE_SA="${STATE_SA:-recalltfstate}"
STATE_CONTAINER="${STATE_CONTAINER:-tfstate}"
ENABLE_VERSIONING="${ENABLE_VERSIONING:-true}"

if ! az account show >/dev/null 2>&1; then
  echo "Azure CLI not logged in. Run 'az login' first." >&2
  exit 1
fi

echo "Creating state resource group: ${STATE_RG} (${LOCATION})"
az group create --name "${STATE_RG}" --location "${LOCATION}" >/dev/null

echo "Creating state storage account: ${STATE_SA}"
az storage account create \
  --name "${STATE_SA}" \
  --resource-group "${STATE_RG}" \
  --location "${LOCATION}" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --min-tls-version TLS1_2 \
  --allow-blob-public-access false \
  --https-only true \
  --output none

echo "Creating state container: ${STATE_CONTAINER}"
az storage container create \
  --name "${STATE_CONTAINER}" \
  --account-name "${STATE_SA}" \
  --auth-mode login \
  --output none

if [[ "${ENABLE_VERSIONING}" == "true" ]]; then
  echo "Enabling blob versioning on ${STATE_SA}"
  az storage account blob-service-properties update \
    --account-name "${STATE_SA}" \
    --enable-versioning true \
    --output none
fi

echo "✅ Terraform state storage ready"
