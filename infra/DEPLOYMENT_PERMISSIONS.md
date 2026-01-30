# Infrastructure Deployment Permissions

## Issue

The infrastructure deployment workflow fails with authorization errors when creating role assignments:

```
Authorization failed for template resource ... The client '***' with object id '3a5a4b29-02ac-46fe-9646-53246630b794' does not have permission to perform action 'Microsoft.Authorization/roleAssignments/write'
```

Reference: [GitHub Actions Run #21530534082](https://github.com/adiazcan/recall-core/actions/runs/21530534082/job/62045102289#step:4:1)

## Root Cause

The Bicep templates create role assignments to grant managed identities (Container Apps and Jobs) access to Azure resources:

| Resource | Role | Purpose |
|----------|------|---------|
| Key Vault | Key Vault Secrets User | Read DocumentDB connection string |
| App Configuration | App Configuration Data Reader | Read application settings |
| Container Registry | ACR Pull | Pull container images |
| Storage Account | Storage Blob Data Contributor | Read/write blobs (thumbnails) |
| Storage Account | Storage Queue Data Contributor | Send/receive queue messages |

These role assignments are created inline within the Bicep deployment. To create them, the deployment service principal needs the `Microsoft.Authorization/roleAssignments/write` permission.

## Solution

Grant the GitHub Actions service principal (configured in GitHub secrets as `AZURE_CLIENT_ID`) the **User Access Administrator** role at the subscription scope.

### Steps to Fix

1. Get the service principal object ID from the error message: `3a5a4b29-02ac-46fe-9646-53246630b794`

2. Run the following Azure CLI command:

```bash
# At subscription scope (recommended for multiple environments)
az role assignment create \
  --assignee 3a5a4b29-02ac-46fe-9646-53246630b794 \
  --role "User Access Administrator" \
  --scope "/subscriptions/YOUR_SUBSCRIPTION_ID"
```

Replace `YOUR_SUBSCRIPTION_ID` with your actual Azure subscription ID.

**Alternative**: Scope to specific resource groups if preferred:

```bash
# For dev environment
az role assignment create \
  --assignee 3a5a4b29-02ac-46fe-9646-53246630b794 \
  --role "User Access Administrator" \
  --scope "/subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/rg-recall-dev"

# For prod environment  
az role assignment create \
  --assignee 3a5a4b29-02ac-46fe-9646-53246630b794 \
  --role "User Access Administrator" \
  --scope "/subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/rg-recall-prod"
```

### Using Azure Portal

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Subscriptions** → Select your subscription
3. Click **Access control (IAM)** in the left menu
4. Click **Add** → **Add role assignment**
5. Select **User Access Administrator** role
6. Click **Next**
7. Click **Select members**
8. Search for the service principal by its Object ID: `3a5a4b29-02ac-46fe-9646-53246630b794`
9. Select it and click **Select**
10. Click **Review + assign**

## Verification

After granting the role, re-run the [Deploy Infrastructure workflow](https://github.com/adiazcan/recall-core/actions/workflows/infra-deploy.yml). The role assignments should be created successfully.

## Security Considerations

The **User Access Administrator** role allows the service principal to manage role assignments within the assigned scope. This is required for the infrastructure deployment but should be carefully controlled:

- ✅ **Recommended**: Limit scope to subscription level if deploying to multiple environments
- ✅ **Alternative**: Grant at resource group level for more granular control
- ⚠️ **Important**: This role does NOT grant access to the resources themselves, only the ability to assign roles
- ⚠️ **Best Practice**: Use separate service principals for dev and prod environments
- ⚠️ **Audit**: Regularly review role assignments using Azure Monitor or Azure Policy

## Why This Role Is Needed

The deployment creates managed identities for Container Apps and Jobs, which need access to:

1. **Key Vault**: To read the DocumentDB connection string secret
2. **App Configuration**: To read application configuration values  
3. **Container Registry**: To pull container images during deployment
4. **Storage Account**: To read/write blobs and queue messages

Without these role assignments, the applications will fail to start or function correctly.

## Alternative Approaches (Not Recommended)

If granting User Access Administrator is not acceptable in your organization, consider:

1. **Manual Role Assignment**: Assign roles manually after infrastructure deployment (requires additional operational overhead)
2. **Separate Deployment Step**: Create a separate workflow that runs with different credentials to assign roles
3. **Azure Managed Identities with Role Inheritance**: Design the architecture to avoid explicit role assignments (significant redesign required)

However, these alternatives add complexity and are not recommended for this project structure.
