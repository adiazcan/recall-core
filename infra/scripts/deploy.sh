#!/usr/bin/env bash
set -euo pipefail

environment="${1:-dev}"
location="${AZURE_LOCATION:-westeurope}"
docdb_password="${2:-${DOCUMENTDB_ADMIN_PASSWORD:-}}"

if [[ -z "$docdb_password" ]]; then
  echo "DocumentDB password required. Provide as argument or set DOCUMENTDB_ADMIN_PASSWORD." >&2
  exit 1
fi

az deployment sub create \
  --location "$location" \
  --template-file infra/main.bicep \
  --parameters "infra/parameters/${environment}.bicepparam" \
  --parameters documentDbAdminPassword="$docdb_password" \
  --name "recall-${environment}-$(date +%Y%m%d%H%M%S)"
