# Quickstart: Synchronous Enrichment on Item Creation

**Spec**: 008-sync-enrichment | **Date**: 2026-02-09

---

## What This Feature Does

Before this change, saving a bookmark returned a blank item — title, excerpt, and thumbnail were populated later by a background worker. Now, the save request itself fetches the page metadata inline. Most bookmarks are returned fully enriched in the API response, with `previewImageUrl` populated directly from the page's og:image URL (no image download). A background screenshot job runs **only** as a fallback when no og:image is found.

---

## Prerequisites

No new infrastructure or tooling required. All dependencies are already in the solution:

- .NET 10 SDK
- Aspire 13.1.0 (AppHost)
- MongoDB (via Aspire)
- Redis (via Aspire, for Dapr pub/sub)
- Dapr CLI (existing setup)

Note: Azure Blob Storage / Azurite is only needed for the async screenshot fallback, not the sync path.

---

## How to Verify

### 1. Start the application

```bash
cd src/Recall.Core.AppHost
dotnet run
```

### 2. Save a URL with og:image (fully enriched)

```bash
curl -s -X POST http://localhost:5080/api/v1/items \
  -H "Content-Type: application/json" \
  -H "X-Test-UserId: test-user-1" \
  -d '{"url": "https://github.com"}' | jq .
```

**Expected**: Response includes `title`, `excerpt`, and `previewImageUrl` populated (external og:image URL), `thumbnailUrl: null`, `enrichmentStatus: "succeeded"`.

### 3. Save a URL without og:image (partial — async fallback)

```bash
curl -s -X POST http://localhost:5080/api/v1/items \
  -H "Content-Type: application/json" \
  -H "X-Test-UserId: test-user-1" \
  -d '{"url": "https://httpbin.org/html"}' | jq .
```

**Expected**: Response includes `title` and `excerpt` populated, `previewImageUrl: null`, `thumbnailUrl: null`, `enrichmentStatus: "pending"`. The async worker will capture a screenshot and update `thumbnailUrl`.

### 4. Save a URL that times out (full async fallback)

```bash
curl -s -X POST http://localhost:5080/api/v1/items \
  -H "Content-Type: application/json" \
  -H "X-Test-UserId: test-user-1" \
  -d '{"url": "https://httpbin.org/delay/10"}' | jq .
```

**Expected**: Response returns within ~5s with `title: null`, `excerpt: null`, `previewImageUrl: null`, `thumbnailUrl: null`, `enrichmentStatus: "pending"`. The item is saved; async fallback is queued.

### 5. Save a SSRF-blocked URL (immediate failure)

```bash
curl -s -X POST http://localhost:5080/api/v1/items \
  -H "Content-Type: application/json" \
  -H "X-Test-UserId: test-user-1" \
  -d '{"url": "http://192.168.1.1/admin"}' | jq .
```

**Expected**: Response includes `enrichmentStatus: "failed"`, `enrichmentError: "URL blocked."`. No async fallback queued.

### 6. Deduplication (no re-enrichment)

```bash
# Save same URL as step 2 again
curl -s -X POST http://localhost:5080/api/v1/items \
  -H "Content-Type: application/json" \
  -H "X-Test-UserId: test-user-1" \
  -d '{"url": "https://httpbin.org/html"}' | jq .
```

**Expected**: Returns 200 (not 201) with the existing item. No new enrichment is triggered.

### 7. Re-enrichment

```bash
ITEM_ID="<id-from-step-3>"
curl -s -X POST "http://localhost:5080/api/v1/items/${ITEM_ID}/enrich" \
  -H "X-Test-UserId: test-user-1" | jq .
```

**Expected**: Returns 202 with sync enrichment results. If no og:image URL found, async fallback queued.

### 8. Verify async fallback completes

Wait ~30s after step 3, then:

```bash
ITEM_ID="<id-from-step-3>"
curl -s "http://localhost:5080/api/v1/items/${ITEM_ID}" \
  -H "X-Test-UserId: test-user-1" | jq '.enrichmentStatus, .previewImageUrl, .thumbnailUrl'
```

**Expected**: `enrichmentStatus: "succeeded"`, `thumbnailUrl` populated (screenshot by async worker), `previewImageUrl: null` (no og:image on that page).

---

## Run Tests

```bash
# Unit tests for shared enrichment library
cd src/tests/Recall.Core.Enrichment.Common.Tests
dotnet test

# Integration tests for API with sync enrichment
cd src/tests/Recall.Core.Api.Tests
dotnet test
```

---

## Key Architecture Changes

| Before (spec 005) | After (spec 008) |
|---|---|
| POST /items → save with `pending` status → async worker does everything | POST /items → save → sync enrich (title, excerpt, og:image URL) → return enriched item |
| All items need async processing | Async only runs when og:image URL is missing |
| Blank bookmarks until worker completes | Bookmarks display immediately with metadata + preview image URL |
| SSRF validation only in worker | SSRF validation shared in `Recall.Core.Enrichment.Common` |
| Duplicate code in API and Enrichment | Shared library eliminates duplication |

---

## New Project: Recall.Core.Enrichment.Common

A shared class library referenced by both `Recall.Core.Api` and `Recall.Core.Enrichment`:

```
src/Recall.Core.Enrichment.Common/
├── Models/
│   ├── PageMetadata.cs
│   └── SyncEnrichmentResult.cs
├── Services/
│   ├── ISyncEnrichmentService.cs / SyncEnrichmentService.cs
│   ├── IHtmlFetcher.cs / HtmlFetcher.cs
│   ├── IMetadataExtractor.cs / MetadataExtractor.cs
│   └── ISsrfValidator.cs / SsrfValidator.cs
└── Configuration/
    └── EnrichmentOptions.cs
```
