#!/usr/bin/env bash
set -euo pipefail

environment="${1:-dev}"
location="${AZURE_LOCATION:-westeurope}"
docdb_password="${2:-${DOCUMENTDB_ADMIN_PASSWORD:-}}"

if [[ -z "$docdb_password" ]]; then
  echo "DocumentDB password required. Provide as argument or set DOCUMENTDB_ADMIN_PASSWORD." >&2
  exit 1
fi

# Export the password as an environment variable for the Bicep parameter file to read
export DOCUMENTDB_ADMIN_PASSWORD="$docdb_password"

az deployment sub what-if \
  --location "$location" \
  --template-file infra/main.bicep \
  --parameters "infra/parameters/${environment}.bicepparam"
