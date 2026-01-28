# This document has moved

The Azure infrastructure requirements documentation has been moved to the correctly named file:

- [`docs/infrastructure.md`](./infrastructure.md)

The original filename (`infratructure.md`) was misspelled. Please update any bookmarks or links to point to `docs/infrastructure.md`.
|---------|-------------|-------------|
| `api` | .NET 10 minimal API | `api` |
| `enrichment` | Background enrichment worker | `enrichment` |

**Configuration requirements:**

- Dapr enabled with sidecars
- Ingress enabled for API (external)
- Ingress internal-only for enrichment
- Min replicas: 0 (scale to zero)
- Max replicas: 10 (adjust based on load)

### 2. Database - Azure DocumentDB

Azure DocumentDB is a fully managed MongoDB-compatible database service.

| Setting | Value |
|---------|-------|
| Compatibility | MongoDB 7.0 |
| Database name | `recalldb` |
| Collections | `items`, `collections` |

**Alternative:** MongoDB Atlas deployed via Azure Marketplace.

**Indexes required:**

- `{ userId: 1, normalizedUrl: 1 }` (unique)
- `{ userId: 1, createdAt: -1, _id: -1 }`

### 3. Storage - Azure Storage Account

A single Storage Account provides both blob storage for thumbnails and queue storage for async messaging.

| Resource | Purpose |
|----------|--------|
| Blob container: `thumbnails` | Stores generated thumbnail images |
| Storage queue: `enrichment-queue` | Backing queue for Dapr pub/sub topic `enrichment.requested` (async enrichment jobs) |
| Storage queue: `enrichment-deadletter` | Backing queue for Dapr pub/sub topic `enrichment.deadletter` (failed jobs for retry/inspection) |

| Setting | Value |
|---------|-------|
| Access tier | Hot |
| Redundancy | LRS (dev) / GRS (prod) |

**Blob naming convention:** `{userId}/{itemId}.jpg`

**Why Storage Queues instead of Redis:**

- Only one subscriber (enrichment worker) - no need for pub/sub
- ~$0.05/million operations vs $16-80/month for Redis
- Already using Storage Account for blobs - no additional resources
- Built-in dead letter queue support

### 4. Identity - Microsoft Entra ID

Two authentication options are supported depending on the target audience:

#### Option A: External ID (CIAM) - Consumer Apps

Best for B2C scenarios with consumer sign-ups using email/password or social providers.

| Setting | Value |
|---------|-------|
| Tenant type | External ID (separate tenant) |
| Sign-up flows | Email + password, Google, Apple, Facebook |
| Authority URL | `https://<tenant-subdomain>.ciamlogin.com/<tenant-id>` |

**Cost:** Free up to 50,000 MAU, then ~$0.0025/MAU

#### Option B: Entra ID B2B - Enterprise Apps

Best for enterprise scenarios where users authenticate with their own organization's credentials (guest access).

| Setting | Value |
|---------|-------|
| Tenant type | Workforce tenant (your organization) |
| Sign-up flows | B2B invitation, self-service sign-up |
| External providers | Any Entra ID tenant, Microsoft accounts, Google federation |
| Authority URL | `https://login.microsoftonline.com/<tenant-id>` |

**Cost:** Free for B2B guests (first 50,000 MAU/month)

#### App Registrations (both options)

| App Registration | Purpose | Redirect URIs |
|------------------|---------|---------------|
| recall-api | Backend API | N/A (API only) |
| recall-web | React SPA | `https://<web-domain>/` |
| recall-extension | Browser extension | `https://<extension-id>.chromiumapp.org/` |

**API Scopes:**

- `api://<api-client-id>/access_as_user`

#### Configuration Differences

| Setting | External ID | B2B |
|---------|-------------|-----|
| `Instance` | `https://<subdomain>.ciamlogin.com/` | `https://login.microsoftonline.com/` |
| `TenantId` | External tenant ID | Workforce tenant ID |
| User claims | `sub`, `email`, custom | `oid`, `email`, `tid` (home tenant) |
| Multi-tenant | No (single tenant) | Yes (any Entra ID org) |

### 5. Observability - Azure Monitor

| Resource | Purpose |
|----------|---------|
| Application Insights | APM, logs, traces, metrics |
| Log Analytics Workspace | Centralized log storage |

OpenTelemetry exporters are configured in `ServiceDefaults` and automatically send telemetry to Application Insights via OTLP.

### 6. Frontend Hosting - Azure Static Web Apps

Hosts the React SPA (`src/web/`). Only **one** Static Web App is needed.

| Setting | Value |
|---------|-------|
| Framework | React + Vite |
| Build output | `dist/` |
| API integration | Proxied to Container Apps |

**Alternative:** Deploy as container in ACA or use Azure CDN + Storage static website.

### 7. Browser Extension Distribution

The browser extension (`src/extension/`) is **not hosted on Azure**. Extensions are distributed through browser vendor stores:

| Store | URL | Fee |
|-------|-----|-----|
| Chrome Web Store | `chrome.google.com/webstore` | $5 one-time |
| Firefox Add-ons | `addons.mozilla.org` | Free |
| Edge Add-ons | `microsoftedge.microsoft.com/addons` | Free |

**Deployment flow:**

```plaintext
┌─────────────────┐     ┌─────────────────┐
│   src/web/      │────▶│ Static Web App  │  (Azure hosting)
└─────────────────┘     └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│ src/extension/  │────▶│ Browser Stores  │  (vendor distribution)
└─────────────────┘     └─────────────────┘
```

**CI/CD considerations:**

- Build extension with `pnpm build` → outputs to `dist/`
- Package as `.zip` for store submission
- Chrome/Edge: Use Chrome Web Store API for automated publishing
- Firefox: Use `web-ext` CLI for automated submission

**Note:** The extension authenticates against the same Entra ID app registration but runs entirely client-side in the browser.

## Environment Configuration

### API Service (`appsettings.Production.json`)

**For External ID (CIAM):**

```json
{
  "AzureAd": {
    "Instance": "https://<tenant-subdomain>.ciamlogin.com/",
    "TenantId": "<external-tenant-id>",
    "ClientId": "<api-client-id>",
    "Audience": "<api-client-id>"
  },
  "Cors": {
    "AllowedOrigins": [
      "https://<web-app-domain>",
      "chrome-extension://<extension-id>"
    ]
  }
}
```

**For B2B (multi-tenant):**

```json
{
  "AzureAd": {
    "Instance": "https://login.microsoftonline.com/",
    "TenantId": "<workforce-tenant-id>",
    "ClientId": "<api-client-id>",
    "Audience": "<api-client-id>"
  },
  "Cors": {
    "AllowedOrigins": [
      "https://<web-app-domain>",
      "chrome-extension://<extension-id>"
    ]
  }
}
```

### Dapr Components (Production)

Use Azure Storage Queues for pub/sub messaging:

```yaml
# pubsub.yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: enrichment-pubsub
spec:
  type: pubsub.azure.storage.queues
  version: v1
  metadata:
    - name: accountName
      value: <storage-account-name>
    - name: accountKey
      secretKeyRef:
        name: storage-account-key
        key: storage-account-key
    - name: queueName
      value: enrichment-requested
```

## Cost Estimation

### Development/Staging Environment

| Resource | Tier | Est. Cost (USD/month) |
|----------|------|----------------------:|
| Container Apps (2 services) | Consumption | $20-50 |
| Azure DocumentDB | vCore M25 | $25-50 |
| Storage Account (blobs + queues) | Hot LRS | $5-10 |
| Static Web Apps | Free | $0 |
| Application Insights | Pay-as-you-go | $5-20 |
| Entra ID (External ID or B2B) | Free tier (50K MAU) | $0 |
| Browser extension stores | Chrome $5 one-time | $0 |
| **Total** | | **$55-130** |

### Production Environment

| Resource | Tier | Est. Cost (USD/month) |
|----------|------|----------------------:|
| Container Apps (2 services) | Consumption (higher traffic) | $100-300 |
| Azure DocumentDB | vCore M40+ | $100-300 |
| Storage Account (blobs + queues) | Hot GRS | $20-50 |
| Static Web Apps | Standard | $9 |
| Application Insights | Pay-as-you-go | $50-100 |
| Entra ID (External ID or B2B) | Per MAU after 50K | Variable |
| Browser extension stores | Already paid | $0 |
| **Total** | | **$280-760** |

## Deployment Checklist

### Azure Resources

- [ ] Create resource group
- [ ] Provision Azure DocumentDB cluster
- [ ] Create Storage Account with `thumbnails` container and `enrichment-requested` queue
- [ ] Create Container Apps Environment with Dapr enabled
- [ ] Deploy API container app with Dapr sidecar
- [ ] Deploy enrichment container app with Dapr sidecar
- [ ] Configure Dapr components (pubsub with Storage Queues)
- [ ] Create Static Web App for frontend (web only)
- [ ] Configure Entra ID tenant (External ID or B2B)
- [ ] Register application credentials (api, web, extension)
- [ ] Configure Application Insights
- [ ] Set up CI/CD pipelines
- [ ] Configure custom domains and SSL

### Browser Extension Stores

- [ ] Create Chrome Web Store developer account ($5 fee)
- [ ] Create Firefox Add-ons developer account (free)
- [ ] Create Edge Add-ons developer account (free)
- [ ] Submit extension for review (each store)
- [ ] Configure automated publishing in CI/CD

## Related Documentation

- [External ID Setup](auth/external-id-setup.md)
- [B2B Guest Access Setup](auth/b2b-setup.md)
- [Authentication Quickstart](auth/quickstart-validation.md)
- [Browser Extension Entra Configuration](extension/entra-configuration.md)
- [Extension Setup Guide](extension/setup.md)
- [Extension Testing Checklist](extension/testing-checklist.md)
