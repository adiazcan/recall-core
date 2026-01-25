# Quickstart: Bookmark Enrichment

**Feature Branch**: `005-bookmark-enrichment`  
**Created**: 2026-01-25

---

## Prerequisites

- .NET 10 SDK
- Node.js 20+ (for Playwright browser installation)
- Docker Desktop (for Aspire orchestration with containers)
- Dapr CLI installed ([Install Dapr CLI](https://docs.dapr.io/getting-started/install-dapr-cli/))
- Aspire workload installed (`dotnet workload install aspire`)

### Initialize Dapr (First Time Only)

```bash
dapr init
```

This installs:
- Dapr sidecar binaries
- Redis container (for Pub/Sub backing)
- Zipkin container (for tracing)

---

## Running Locally

### 1. Start the Application

From the repository root:

```bash
cd src/Recall.Core.AppHost
dotnet run
```

This starts:
- MongoDB (container)
- Redis (container) - Dapr Pub/Sub backing store
- Azure Storage Emulator (Azurite, container) - provides blobs
- API service with Dapr sidecar
- Enrichment worker service with Dapr sidecar
- Web frontend

### 2. Install Playwright Browsers (First Time Only)

The enrichment service requires Chromium for screenshot generation:

```bash
cd src/Recall.Core.Enrichment
dotnet build
pwsh bin/Debug/net10.0/playwright.ps1 install chromium
```

Or on Linux/macOS:
```bash
./bin/Debug/net10.0/playwright.sh install chromium
```

### 3. Access the Application

- **API**: http://localhost:5080
- **Web UI**: http://localhost:5173
- **Aspire Dashboard**: http://localhost:15014

---

## Testing Enrichment

### Create an Item (API)

```bash
curl -X POST http://localhost:5080/api/v1/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "url": "https://github.com"
  }'
```

**Expected Response** (201 Created):
```json
{
  "id": "507f1f77bcf86cd799439011",
  "url": "https://github.com",
  "normalizedUrl": "github.com",
  "title": null,
  "excerpt": null,
  "status": "unread",
  "isFavorite": false,
  "collectionId": null,
  "tags": [],
  "createdAt": "2026-01-25T10:30:00Z",
  "updatedAt": "2026-01-25T10:30:00Z",
  "thumbnailUrl": null,
  "enrichmentStatus": "pending",
  "enrichmentError": null,
  "enrichedAt": null
}
```

### Check Enrichment Status

After a few seconds, the enrichment worker processes the job:

```bash
curl http://localhost:5080/api/v1/items/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer <token>"
```

**Expected Response** (after enrichment):
```json
{
  "id": "507f1f77bcf86cd799439011",
  "url": "https://github.com",
  "normalizedUrl": "github.com",
  "title": "GitHub: Let's build from here",
  "excerpt": "GitHub is where over 100 million developers shape the future of software...",
  "status": "unread",
  "isFavorite": false,
  "collectionId": null,
  "tags": [],
  "createdAt": "2026-01-25T10:30:00Z",
  "updatedAt": "2026-01-25T10:30:05Z",
  "thumbnailUrl": "/api/v1/items/507f1f77bcf86cd799439011/thumbnail",
  "enrichmentStatus": "succeeded",
  "enrichmentError": null,
  "enrichedAt": "2026-01-25T10:30:05Z"
}
```

### Get Thumbnail

```bash
curl http://localhost:5080/api/v1/items/507f1f77bcf86cd799439011/thumbnail \
  -H "Authorization: Bearer <token>" \
  --output thumbnail.jpg
```

### Manual Re-Enrichment

To refresh metadata for an existing item:

```bash
curl -X POST http://localhost:5080/api/v1/items/507f1f77bcf86cd799439011/enrich \
  -H "Authorization: Bearer <token>"
```

**Response** (202 Accepted):
```json
{
  "message": "Enrichment job enqueued",
  "itemId": "507f1f77bcf86cd799439011",
  "status": "pending"
}
```

---

## SSRF Protection Testing

Create an item with a blocked URL:

```bash
curl -X POST http://localhost:5080/api/v1/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "url": "http://localhost:8080/internal"
  }'
```

The item is created, but enrichment fails safely:

```json
{
  "id": "...",
  "url": "http://localhost:8080/internal",
  "enrichmentStatus": "failed",
  "enrichmentError": "URL blocked: private network access not allowed"
}
```

---

## Running Tests

### API Integration Tests

```bash
cd src/tests/Recall.Core.Api.Tests
dotnet test
```

### Enrichment Service Tests

```bash
cd src/tests/Recall.Core.Enrichment.Tests
dotnet test
```

### All Tests

```bash
cd src
dotnet test
```

---

## Development Workflow

### Watching Logs

Open the Aspire Dashboard at http://localhost:15014 to view:
- Structured logs from all services (including Dapr sidecars)
- Distributed traces
- Metrics

### Viewing Dapr Pub/Sub Messages

Use Dapr CLI to publish test messages:

```bash
dapr publish --pubsub enrichment-pubsub --topic enrichment.requested \
  --data '{"itemId":"test123","userId":"user1","url":"https://example.com"}'
```

Check Redis for Pub/Sub state:

```bash
docker exec -it dapr_redis redis-cli
> KEYS *
```

### Viewing Blob Thumbnails

```bash
az storage blob list --container-name thumbnails \
  --connection-string "UseDevelopmentStorage=true"
```

### Dapr Sidecar Inspection

Check Dapr sidecar status:

```bash
dapr list
```

View Dapr components:

```bash
dapr components --kubernetes=false
```

---

## Configuration

### API Configuration (appsettings.json)

```json
{
  "Enrichment": {
    "PubSubName": "enrichment-pubsub",
    "TopicName": "enrichment.requested",
    "ThumbnailContainer": "thumbnails"
  }
}
```

### Enrichment Worker Configuration (appsettings.json)

```json
{
  "Enrichment": {
    "ThumbnailContainer": "thumbnails",
    "FetchTimeoutSeconds": 10,
    "MaxHtmlSizeBytes": 5242880,
    "ScreenshotTimeoutSeconds": 15,
    "ThumbnailMaxWidth": 600,
    "ThumbnailMaxHeight": 400,
    "ThumbnailQuality": 80
  }
}
```

### Dapr Components (src/Recall.Core.AppHost/components/)

**pubsub.yaml** - Redis-backed Pub/Sub:
```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: enrichment-pubsub
spec:
  type: pubsub.redis
  version: v1
  metadata:
    - name: redisHost
      value: localhost:6379
```

**subscription.yaml** - Topic subscription:
```yaml
apiVersion: dapr.io/v2alpha1
kind: Subscription
metadata:
  name: enrichment-subscription
spec:
  pubsubname: enrichment-pubsub
  topic: enrichment.requested
  routes:
    default: /api/enrichment/process
  deadLetterTopic: enrichment.deadletter
```

**resiliency.yaml** - Timeout/retry policies:
```yaml
apiVersion: dapr.io/v1alpha1
kind: Resiliency
metadata:
  name: enrichment-resiliency
scopes:
  - enrichment
spec:
  policies:
    timeouts:
      httpFetch: 30s
    retries:
      enrichmentRetry:
        policy: exponential
        maxInterval: 5m
        maxRetries: 5
```

---

## Troubleshooting

### Enrichment Job Not Processing

1. Check Aspire Dashboard for enrichment service health
2. Verify Dapr sidecar is running: `dapr list`
3. Check Redis connectivity: `docker exec -it dapr_redis redis-cli PING`
4. Verify Pub/Sub subscription in logs (look for "[topic=enrichment.requested]")
5. Check for browser installation issues:
   ```bash
   cd src/Recall.Core.Enrichment
   dotnet build
   pwsh bin/Debug/net10.0/playwright.ps1 install --dry-run
   ```

### Dapr Sidecar Not Starting

1. Ensure Dapr is initialized: `dapr init`
2. Check Docker containers: `docker ps | grep dapr`
3. Verify component files exist in `src/Recall.Core.AppHost/components/`
4. Check Dapr logs in Aspire Dashboard

### Screenshot Failures

1. Ensure Chromium is installed (see step 2 above)
2. Check page timeout settings
3. Some pages may block headless browsers - this is expected

### Thumbnail Endpoint Returns 404

1. Verify item exists and belongs to authenticated user
2. Check if `enrichmentStatus` is `succeeded`
3. Verify blob exists in storage container

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Request                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Recall.Core.Api + Dapr Sidecar              │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │ POST /items │───▶│ Save to DB   │───▶│ Publish Event    │   │
│  └─────────────┘    └──────────────┘    │ (DaprClient)     │   │
│                                         └────────┬─────────┘   │
│  ┌──────────────────────────────────────────────┐│              │
│  │ GET /items/{id}/thumbnail ─────────────────────┼────────┐    │
│  └──────────────────────────────────────────────┘│         │    │
└──────────────────────────────────────────────────┼─────────┼────┘
                                                   │         │
                                                   ▼         │
┌─────────────────────────────────────────────────────────────────┐
│                     Redis (Dapr Pub/Sub)                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Topic: enrichment.requested                             │   │
│  │  Dead Letter: enrichment.deadletter                      │   │
│  └──────────────────────────┬──────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Recall.Core.Enrichment + Dapr Sidecar              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ [Topic("enrichment-pubsub", "enrichment.requested")]      │  │
│  │ POST /api/enrichment/process                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ Fetch HTML   │───▶│ Extract      │───▶│ Generate     │      │
│  │ (SSRF Check) │    │ Metadata     │    │ Thumbnail    │      │
│  └──────────────┘    └──────────────┘    └──────┬───────┘      │
│                                                  │               │
│         ┌────────────────────────────────────────┘               │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │ Upload to    │───▶ Update Item in MongoDB                    │
│  │ Blob Storage │                                               │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Azure Storage (Azurite)                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Blob Container: thumbnails                              │   │
│  │  Key: {userId}/{itemId}.jpg                              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Client Integration Notes

### Polling for Enrichment Completion

Frontend can poll the item endpoint on interval:

```typescript
async function waitForEnrichment(itemId: string, maxAttempts = 10): Promise<Item> {
  for (let i = 0; i < maxAttempts; i++) {
    const item = await fetchItem(itemId);
    if (item.enrichmentStatus !== 'pending') {
      return item;
    }
    await sleep(2000); // 2 second intervals
  }
  throw new Error('Enrichment timeout');
}
```

### Displaying Enrichment Status

```typescript
function EnrichmentBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <Badge variant="warning">Enriching...</Badge>;
    case 'succeeded':
      return null; // Don't show badge when successful
    case 'failed':
      return <Badge variant="error">Enrichment failed</Badge>;
  }
}
```
