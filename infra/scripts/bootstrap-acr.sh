#!/usr/bin/env bash
set -euo pipefail

LOCATION="${LOCATION:-swedencentral}"
ACR_RG="${ACR_RG:-recall-shared-rg}"
ACR_NAME="${ACR_NAME:-recallacr}"
ACR_SKU="${ACR_SKU:-Basic}"

if ! az account show >/dev/null 2>&1; then
  echo "Azure CLI not logged in. Run 'az login' first." >&2
  exit 1
fi

echo "Creating shared resource group: ${ACR_RG} (${LOCATION})"
az group create --name "${ACR_RG}" --location "${LOCATION}" >/dev/null

echo "Creating ACR: ${ACR_NAME} (${ACR_SKU})"
az acr create \
  --name "${ACR_NAME}" \
  --resource-group "${ACR_RG}" \
  --sku "${ACR_SKU}" \
  --admin-enabled false \
  --output none

echo "✅ ACR ready: ${ACR_NAME}.azurecr.io"
