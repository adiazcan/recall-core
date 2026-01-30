#!/usr/bin/env bash
set -euo pipefail

environment="${1:-dev}"
location="${AZURE_LOCATION:-westeurope}"
docdb_password="${2:-${DOCUMENTDB_ADMIN_PASSWORD:-}}"

if [[ -z "$docdb_password" ]]; then
  echo "DocumentDB password required. Provide as argument or set DOCUMENTDB_ADMIN_PASSWORD." >&2
  exit 1
fi

# Validate permissions before deploying
echo "🔍 Validating deployment permissions..."
if ! bash "$(dirname "$0")/../validate-permissions.sh"; then
  echo ""
  echo "❌ Pre-deployment validation failed. Please fix the issues above before deploying."
  exit 1
fi

echo ""
echo "✅ Validation passed. Proceeding with deployment..."
echo ""

# Export the password as an environment variable for the Bicep parameter file to read
export DOCUMENTDB_ADMIN_PASSWORD="$docdb_password"

az deployment sub create \
  --location "$location" \
  --template-file infra/main.bicep \
  --parameters "infra/parameters/${environment}.bicepparam" \
  --name "recall-${environment}-$(date +%Y%m%d%H%M%S)"
