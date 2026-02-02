#!/usr/bin/env bash
set -euo pipefail

environment="${1:-dev}"
location="${AZURE_LOCATION:-westeurope}"
docdb_password="${2:-${DOCUMENTDB_ADMIN_PASSWORD:-}}"

# Validate required environment variables
missing_vars=()

if [[ -z "$docdb_password" ]]; then
  missing_vars+=("DOCUMENTDB_ADMIN_PASSWORD")
fi

if [[ -z "${AZUREAD_TENANT_ID:-}" ]]; then
  missing_vars+=("AZUREAD_TENANT_ID")
fi

if [[ -z "${AZUREAD_API_CLIENT_ID:-}" ]]; then
  missing_vars+=("AZUREAD_API_CLIENT_ID")
fi

if [[ -z "${AZUREAD_API_AUDIENCE:-}" ]]; then
  missing_vars+=("AZUREAD_API_AUDIENCE")
fi

if [[ ${#missing_vars[@]} -gt 0 ]]; then
  echo "❌ Missing required environment variables:" >&2
  for var in "${missing_vars[@]}"; do
    echo "  - $var" >&2
  done
  echo "" >&2
  echo "Set these variables or provide them as arguments. See infra/README.md for details." >&2
  exit 1
fi

# Validate permissions before deploying
echo "🔍 Validating deployment permissions..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! bash "$SCRIPT_DIR/../validate-permissions.sh"; then
  echo ""
  echo "❌ Pre-deployment validation failed. Please fix the issues above before deploying."
  exit 1
fi

echo ""
echo "✅ Validation passed. Proceeding with deployment..."
echo ""

# Determine the infra directory relative to this script
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Export the password as an environment variable for the Bicep parameter file to read
export DOCUMENTDB_ADMIN_PASSWORD="$docdb_password"

az deployment sub create \
  --location "$location" \
  --template-file "$INFRA_DIR/main.bicep" \
  --parameters "$INFRA_DIR/parameters/${environment}.bicepparam" \
  --name "recall-${environment}-$(date +%Y%m%d%H%M%S)"
