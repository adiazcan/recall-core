# Infrastructure Deployment Fix Summary

## Issue
GitHub Actions workflow "Deploy Infrastructure" fails at step "Deploy Bicep" with authorization error:

```
Authorization failed for template resource ... The client with object id '3a5a4b29-02ac-46fe-9646-53246630b794' does not have permission to perform action 'Microsoft.Authorization/roleAssignments/write'
```

**Reference**: [GitHub Actions Run #21530534082](https://github.com/adiazcan/recall-core/actions/runs/21530534082/job/62045102289#step:4:1)

## Root Cause Analysis

The Bicep infrastructure deployment creates role assignments that grant managed identities (Container Apps and Jobs) access to Azure resources. These role assignments are essential for the application to function:

### Required Role Assignments

| Managed Identity | Target Resource | Role | Why Needed |
|-----------------|----------------|------|------------|
| API Container App | Key Vault | Key Vault Secrets User | Read DocumentDB connection string |
| API Container App | App Configuration | App Configuration Data Reader | Read application settings |
| API Container App | Container Registry | ACR Pull | Pull container images at startup |
| API Container App | Storage Account | Storage Blob/Queue Contributor | Access blob storage and queues |
| Enrichment Job | Key Vault | Key Vault Secrets User | Read DocumentDB connection string |
| Enrichment Job | App Configuration | App Configuration Data Reader | Read application settings |
| Enrichment Job | Container Registry | ACR Pull | Pull container images at startup |
| Enrichment Job | Storage Account | Storage Blob/Queue Contributor | Process enrichment queue messages |

To create these role assignments during deployment, the deployment service principal needs elevated permissions that it currently lacks.

## Solution

Grant the GitHub Actions service principal the **User Access Administrator** role at the subscription scope.

### Option 1: Azure CLI (Recommended)

```bash
az role assignment create \
  --assignee 3a5a4b29-02ac-46fe-9646-53246630b794 \
  --role "User Access Administrator" \
  --scope "/subscriptions/<YOUR_SUBSCRIPTION_ID>"
```

**Note**: Replace `<YOUR_SUBSCRIPTION_ID>` with your actual Azure subscription ID.

### Option 2: Azure Portal

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Subscriptions** → Select your subscription
3. Click **Access control (IAM)**
4. Click **Add** → **Add role assignment**
5. Select **User Access Administrator** role → Click **Next**
6. Click **Select members**
7. Search for Object ID: `3a5a4b29-02ac-46fe-9646-53246630b794`
8. Select the service principal → Click **Select**
9. Click **Review + assign**

## What This PR Provides

This PR adds comprehensive documentation and tooling to help diagnose and resolve the permissions issue:

### 1. Documentation (`infra/DEPLOYMENT_PERMISSIONS.md`)
- Detailed explanation of the issue
- Step-by-step remediation instructions
- Security considerations
- Alternative approaches

### 2. Pre-Deployment Validation (`infra/validate-permissions.sh`)
- Validates deployment prerequisites
- Checks for required permissions
- Provides actionable error messages
- Safe to run before any deployment

Usage:
```bash
cd infra
./validate-permissions.sh
```

### 3. Infrastructure README (`infra/README.md`)
- Complete deployment guide
- Architecture overview
- Module structure explanation
- Troubleshooting section
- Cost estimation

## Verification Steps

After granting the User Access Administrator role:

1. **Validate permissions** (optional but recommended):
   ```bash
   cd infra
   ./validate-permissions.sh
   ```

2. **Re-run the deployment workflow**:
   - Go to **Actions** → **Deploy Infrastructure**
   - Click **Run workflow**
   - Select environment (dev or prod)
   - Click **Run workflow**

3. **Expected outcome**:
   - All role assignments created successfully
   - Container Apps and Jobs can access required resources
   - Applications function correctly

## Security Considerations

### What User Access Administrator Role Grants

The User Access Administrator role allows the service principal to:
- ✅ Create role assignments within the subscription
- ✅ Delete role assignments it created
- ❌ Does **NOT** grant access to the resources themselves
- ❌ Does **NOT** allow modifying Azure AD/Entra ID settings
- ❌ Does **NOT** allow creating or deleting resources

### Security Best Practices

1. **Scope Limitation**: Role is granted only at subscription level, not globally
2. **Audit Trail**: All role assignments are logged in Azure Activity Log
3. **Least Privilege**: Service principal has only deployment-related permissions
4. **Separation of Concerns**: Different service principals can be used for dev/prod

### Risk Assessment

| Risk | Mitigation |
|------|------------|
| Over-privileged service principal | Limited to subscription scope; requires GitHub secrets to use |
| Unauthorized role assignments | Azure Activity Log tracks all changes; can set up alerts |
| Compromised credentials | GitHub Actions uses OIDC with short-lived tokens; rotate credentials regularly |

## Alternative Approaches (Not Recommended)

If granting User Access Administrator is not acceptable:

1. **Manual Role Assignment**: Assign roles manually after infrastructure deployment
   - ❌ Requires operational overhead
   - ❌ Error-prone
   - ❌ Breaks infrastructure-as-code principles

2. **Separate Deployment Step**: Create a workflow with different credentials just for role assignments
   - ❌ Added complexity
   - ❌ Still requires elevated permissions somewhere
   - ❌ Harder to maintain

3. **Architecture Redesign**: Avoid explicit role assignments
   - ❌ Significant redesign required
   - ❌ May not be possible with Container Apps architecture
   - ❌ Would delay project progress

## FAQ

**Q: Why can't we use Azure Key Vault access policies instead of RBAC?**
A: The infrastructure uses RBAC for Key Vault (`enableRbacAuthorization: true`) which is the recommended approach for new deployments. Access policies are legacy.

**Q: Can we grant a less privileged role?**
A: No. The `Microsoft.Authorization/roleAssignments/write` permission is only available in roles like User Access Administrator and Owner. The former is more limited and preferred.

**Q: Is this a one-time fix?**
A: Yes. Once the service principal has the role, all future deployments will work without additional changes.

**Q: Will this affect existing resources?**
A: No. This only grants permission to create role assignments. Existing resources are unaffected.

**Q: Can we scope this to just the resource groups?**
A: Yes. You can grant the role at resource group scope (`/subscriptions/SUB_ID/resourceGroups/rg-recall-dev`) instead of subscription scope for more granular control.

## Next Steps

1. Review and approve this PR
2. Grant User Access Administrator role to the service principal (Azure configuration, not code)
3. Merge this PR to document the solution
4. Re-run the infrastructure deployment workflow
5. Verify successful deployment and application functionality

## References

- [Azure User Access Administrator Role](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#user-access-administrator)
- [Azure RBAC Best Practices](https://learn.microsoft.com/azure/role-based-access-control/best-practices)
- [GitHub Actions OIDC with Azure](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-azure)
- [Bicep Role Assignments](https://learn.microsoft.com/azure/azure-resource-manager/bicep/scenarios-rbac)
