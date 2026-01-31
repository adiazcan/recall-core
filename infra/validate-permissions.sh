#!/usr/bin/env bash
#
# Pre-deployment validation script
# Checks if the deployment service principal has the required permissions
#
set -euo pipefail

echo "🔍 Checking deployment prerequisites..."
echo ""

# Get the current account
CURRENT_ACCOUNT=$(az account show --query user.name -o tsv 2>/dev/null || echo "")

if [ -z "$CURRENT_ACCOUNT" ]; then
    echo "❌ ERROR: Not logged into Azure CLI"
    echo "   Run: az login"
    exit 1
fi

echo "✅ Logged in as: $CURRENT_ACCOUNT"

# Get subscription info
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)

echo "✅ Subscription: $SUBSCRIPTION_NAME ($SUBSCRIPTION_ID)"
echo ""

# Check if we're using a service principal or user account
ACCOUNT_TYPE=$(az account show --query user.type -o tsv)

if [ "$ACCOUNT_TYPE" = "servicePrincipal" ]; then
    # For service principals, get the app ID first, then the object ID
    APP_ID=$(az account show --query user.name -o tsv)
    SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv 2>/dev/null || echo "")
    
    if [ -z "$SP_OBJECT_ID" ]; then
        echo "⚠️  WARNING: Could not retrieve service principal object ID"
        echo "   Skipping permission check. Deployment may fail if permissions are missing."
        echo ""
        exit 0
    fi
    
    echo "🔑 Deployment will use service principal:"
    echo "   Application ID: $APP_ID"
    echo "   Object ID: $SP_OBJECT_ID"
    echo ""
    echo "⚠️  IMPORTANT: Role Assignment Permission Check"
    echo ""
    echo "   The infrastructure deployment creates role assignments for:"
    echo "   - Key Vault Secrets User"
    echo "   - App Configuration Data Reader"
    echo "   - ACR Pull"
    echo "   - Storage Blob/Queue Data Contributor"
    echo ""
    echo "   To create these, the service principal needs:"
    echo "   • User Access Administrator role at subscription or resource group scope"
    echo ""
    
    # Check if the service principal has the User Access Administrator role
    HAS_UAA_ROLE=$(az role assignment list \
        --assignee "$SP_OBJECT_ID" \
        --role "User Access Administrator" \
        --scope "/subscriptions/$SUBSCRIPTION_ID" \
        --query "[].roleDefinitionName" -o tsv 2>/dev/null || echo "")
    
    if [ -n "$HAS_UAA_ROLE" ]; then
        echo "✅ Service principal has User Access Administrator role"
    else
        echo "❌ WARNING: Service principal does NOT have User Access Administrator role"
        echo ""
        echo "   The deployment will FAIL when creating role assignments."
        echo ""
        echo "   To fix this, run:"
        echo "   az role assignment create \\"
        echo "     --assignee $SP_OBJECT_ID \\"
        echo "     --role \"User Access Administrator\" \\"
        echo "     --scope \"/subscriptions/$SUBSCRIPTION_ID\""
        echo ""
        echo "   For more information, see:"
        echo "   📄 ./DEPLOYMENT_PERMISSIONS.md"
        echo ""
        exit 1
    fi
else
    echo "👤 Deployment will use user account: $CURRENT_ACCOUNT"
    echo ""
    echo "⚠️  User accounts typically have sufficient permissions for role assignments."
    echo "   If deployment fails, you may need Owner or User Access Administrator role."
fi

echo ""
echo "✅ All prerequisites validated"
echo ""
echo "You can now run the deployment:"
echo "  cd infra"
echo "  az deployment sub create \\"
echo "    --location westeurope \\"
echo "    --template-file main.bicep \\"
echo "    --parameters parameters/dev.bicepparam"
