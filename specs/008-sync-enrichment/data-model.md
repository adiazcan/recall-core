# Data Model: Synchronous Enrichment on Item Creation

**Spec**: 008-sync-enrichment | **Date**: 2026-02-09

---

## Overview

This feature adds **one new field** (`PreviewImageUrl`) to the `Item` entity and changes the **behavioral timing** of enrichment field population. Instead of all metadata being populated by the async worker, title, excerpt, and preview image URL are extracted synchronously during item creation.

The og:image URL is stored directly — no image bytes are downloaded during the sync request. The async screenshot fallback only runs when no og:image URL is available.

This document describes the entity change, the **new shared library types**, and the **updated flow semantics**.

---

## Item Entity (one new field)

> Reference: `src/Recall.Core.Api/Entities/Item.cs`

| Field | C# Type | MongoDB Field | Notes |
|---|---|---|---|
| `Id` | `ObjectId` | `_id` | Auto-generated |
| `Url` | `string` | `url` | Original URL |
| `NormalizedUrl` | `string` | `normalizedUrl` | For deduplication |
| `Title` | `string?` | `title` | User-provided or sync-enriched |
| `Excerpt` | `string?` | `excerpt` | User-provided or sync-enriched |
| `Status` | `string` | `status` | `unread` / `archived` |
| `IsFavorite` | `bool` | `isFavorite` | |
| `CollectionId` | `ObjectId?` | `collectionId` | Nullable FK |
| `Tags` | `List<string>` | `tags` | Embedded list |
| `UserId` | `string?` | `userId` | Set on insert |
| `CreatedAt` | `DateTime` | `createdAt` | UTC |
| `UpdatedAt` | `DateTime` | `updatedAt` | UTC |
| **`PreviewImageUrl`** | **`string?`** | **`previewImageUrl`** | **NEW — og:image / twitter:image URL (stored directly, not downloaded)** |
| `ThumbnailStorageKey` | `string?` | `thumbnailStorageKey` | `{userId}/{itemId}.jpg` — used by async screenshot fallback |
| `EnrichmentStatus` | `string` | `enrichmentStatus` | `pending` / `succeeded` / `failed` |
| `EnrichmentError` | `string?` | `enrichmentError` | Max 500 chars, sanitized |
| `EnrichedAt` | `DateTime?` | `enrichedAt` | UTC |

### New Field: `PreviewImageUrl`

- **Source**: Extracted from `og:image` or `twitter:image` meta tags during sync enrichment.
- **Not downloaded**: The URL is stored as-is. The frontend renders it directly via `<img src="...">`.
- **Relationship to `ThumbnailStorageKey`**: These are complementary, not redundant:
  - `PreviewImageUrl` = external og:image URL (set by sync enrichment)
  - `ThumbnailStorageKey` = blob key for Playwright screenshot (set by async fallback worker)
  - The UI displays `previewImageUrl` when available, falling back to the `/thumbnail` endpoint.
- **Migration**: Existing items without `PreviewImageUrl` continue to work — the field is nullable, and `[BsonIgnoreExtraElements]` on the worker's `ItemDocument` handles backward compatibility.
- **No new indexes needed**: `PreviewImageUrl` is not queried or filtered on.

---

## New Model: SyncEnrichmentResult

> Location: `Recall.Core.Enrichment.Common/Models/SyncEnrichmentResult.cs`

Returned by `ISyncEnrichmentService.EnrichAsync()`. The caller (API `ItemService`) applies these values to the `Item` entity.

| Field | Type | Description |
|---|---|---|
| `Title` | `string?` | Extracted title, null if not found |
| `Excerpt` | `string?` | Extracted excerpt, null if not found |
| `PreviewImageUrl` | `string?` | og:image / twitter:image URL (stored directly, not downloaded) |
| `NeedsAsyncFallback` | `bool` | `true` if no preview image URL was found |
| `Error` | `string?` | Error message if enrichment failed entirely |
| `Duration` | `TimeSpan` | Wall-clock time spent on enrichment (for metrics) |

### State Mapping

| Title | Excerpt | PreviewImageUrl | `NeedsAsyncFallback` | Item `EnrichmentStatus` |
|-------|---------|----------------|----------------------|------------------------|
| ✓ | ✓ | ✓ | `false` | `succeeded` |
| ✓ | ✓ | ✗ | `true` | `pending` |
| ✓ | ✗ | ✓ | `false` | `succeeded` |
| ✓ | ✗ | ✗ | `true` | `pending` |
| ✗ | ✗ | ✗ (fetch failed) | `true` | `pending` |

When `Error` is set (enrichment failed entirely), `NeedsAsyncFallback` is `true` and all extracted fields are null.

---

## Existing Model: PageMetadata (moved to shared library)

> Current location: `Recall.Core.Enrichment/Services/MetadataExtractor.cs` (nested record)
> New location: `Recall.Core.Enrichment.Common/Models/PageMetadata.cs`

| Field | Type | Description |
|---|---|---|
| `Title` | `string?` | Extracted from og:title → `<title>` → `<h1>` |
| `Excerpt` | `string?` | Extracted from og:description → meta description → first `<p>` |
| `OgImageUrl` | `string?` | From og:image → twitter:image |

Unchanged semantically — just relocated to the shared library.

---

## Existing Model: EnrichmentJob (unchanged)

> Location: `Recall.Core.Api/Models/EnrichmentJob.cs` and `Recall.Core.Enrichment/Models/EnrichmentJob.cs`

| Field | Type | Description |
|---|---|---|
| `ItemId` | `string` | The item's MongoDB ObjectId as string |
| `UserId` | `string` | The owning user's ID |
| `Url` | `string` | The bookmark URL to enrich |
| `EnqueuedAt` | `DateTime` | UTC timestamp when the job was published |

**No schema changes.** The message semantics change: this now represents a **fallback job** (screenshot-only or full-retry) rather than the primary enrichment path. The worker determines what work to do by reading the item's current state from the database.

---

## Shared Configuration: EnrichmentOptions (unified)

> Current: Separate `EnrichmentOptions` in API and Enrichment projects with different fields
> New: Unified `EnrichmentOptions` in `Recall.Core.Enrichment.Common/Configuration/EnrichmentOptions.cs`

| Property | Type | Default | Description |
|---|---|---|---|
| `ThumbnailContainer` | `string` | `"thumbnails"` | Blob storage container name |
| `MaxResponseSizeBytes` | `long` | `5_242_880` (5MB) | Max HTML response size |
| `FetchTimeoutSeconds` | `int` | `3` | HTML fetch timeout for sync path (**new**) |
| `MasterTimeoutSeconds` | `int` | `4` | Overall sync enrichment budget (**new**) |
| `MaxRedirects` | `int` | `3` | Max HTTP redirects to follow |
| `ConnectTimeoutSeconds` | `int` | `10` | TCP connect timeout |
| `ReadTimeoutSeconds` | `int` | `30` | Full read timeout (async worker) |
| `UserAgent` | `string` | `"Recall.Enrichment/1.0"` | HTTP User-Agent header |

The async Enrichment worker uses `ReadTimeoutSeconds` (30s) for its longer-budget operations and `ConnectTimeoutSeconds` for Playwright. The sync API path uses `FetchTimeoutSeconds` (3s) and `MasterTimeoutSeconds` (4s). No image download settings in sync path — og:image URL is stored directly.

---

## Blob Storage (unchanged — async fallback only)

| Property | Value |
|---|---|
| Container | `thumbnails` |
| Key format | `{userId}/{itemId}.jpg` |
| Content-Type | `image/jpeg` (Playwright screenshot) |
| Max size | ~100KB (post-SkiaSharp resize) |

Blob storage is used **only by the async fallback worker** for Playwright screenshots. The sync path does not write to blob storage — it stores the og:image URL directly on the Item entity.

---

## Enrichment State Machine (updated semantics)

```
[Item Created]
      │
      ▼
  Sync Enrichment (HTML fetch + metadata extraction)
      │
      ├── Full success (title+excerpt+previewImageUrl) ──► enrichmentStatus = "succeeded"
      │                                                    (no async job published)
      │
      ├── Partial success (title/excerpt found, no og:image) ──► enrichmentStatus = "pending"
      │                                                          │
      │                                                          ▼
      │                                                  Async Fallback Job Published
      │                                                          │
      │                                                          ▼
      │                                                  Worker: Screenshot only
      │                                                          │
      │                                                  ├── Success ──► "succeeded" + thumbnailStorageKey
      │                                                  └── Failure ──► "succeeded" (title/excerpt already populated)
      │
      ├── Full failure (page unreachable/timeout) ──► enrichmentStatus = "pending"
      │                                               │
      │                                               ▼
      │                                        Async Fallback Job Published
      │                                               │
      │                                               ▼
      │                                        Worker: Full enrichment + screenshot
      │                                               │
      │                                        ├── Success ──► "succeeded"
      │                                        └── Failure ──► "failed"
      │
      └── SSRF blocked ──► enrichmentStatus = "failed"
                            enrichmentError = "URL blocked."
                            (no async job — intentional security block)

[Re-enrichment triggered]
      │
      ▼
  Reset to "pending" → Sync Enrichment → same flow as above
```

### Key behavioral changes from spec 005:

1. **Before (005)**: Item always created with `enrichmentStatus=pending`, all metadata null. Async worker does everything.
2. **After (008)**: Item often created with `enrichmentStatus=succeeded`, metadata populated inline, `previewImageUrl` set to og:image URL. Async worker only runs as fallback for screenshots.
3. **SSRF-blocked URLs**: Now set to `failed` immediately at creation (previously would fail in async worker). No async fallback for security blocks.
4. **Deduplication**: Unchanged — existing item returned, no enrichment triggered.

---

## Interface Definitions (shared library)

### ISyncEnrichmentService

```csharp
namespace Recall.Core.Enrichment.Common.Services;

public interface ISyncEnrichmentService
{
    Task<SyncEnrichmentResult> EnrichAsync(
        string url,
        string userId,
        string itemId,
        CancellationToken cancellationToken = default);
}
```

### IHtmlFetcher

```csharp
namespace Recall.Core.Enrichment.Common.Services;

public interface IHtmlFetcher
{
    Task<string> FetchHtmlAsync(string url, CancellationToken cancellationToken = default);
}
```

### IMetadataExtractor

```csharp
namespace Recall.Core.Enrichment.Common.Services;

public interface IMetadataExtractor
{
    Task<PageMetadata> ExtractAsync(string html);
}
```

### ISsrfValidator

```csharp
namespace Recall.Core.Enrichment.Common.Services;

public interface ISsrfValidator
{
    Task ValidateUrlAsync(string url, CancellationToken cancellationToken = default);
}
```

Note: `IImageDownloader` and `IThumbnailWriter` are **not** in the shared library. Image downloading and blob storage writes remain in the async `Recall.Core.Enrichment` worker only. The sync path stores the og:image URL directly — no image bytes are handled.
