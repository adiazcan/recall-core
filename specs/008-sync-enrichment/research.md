# Research: Synchronous Enrichment on Item Creation

**Spec**: 008-sync-enrichment | **Date**: 2026-02-09

---

## 1. Shared Library Architecture

### Decision: `Recall.Core.Enrichment.Common` — class library, no AppHost registration

**Rationale**: A shared class library (`Recall.Core.Enrichment.Common`) is consumed via `<ProjectReference>` from both `Recall.Core.Api` and `Recall.Core.Enrichment`. It has no entry point and no process — Aspire `builder.AddProject<T>()` is only for runnable projects (web apps, workers) that Aspire orchestrates as processes with endpoints, sidecars, and health checks. The existing `Recall.Core.ServiceDefaults` follows this exact pattern — it's a class library referenced by runnable projects and not registered in AppHost.

**Alternatives considered**:

| Name | Verdict |
|------|---------|
| `Recall.Core.Shared` | Too generic — implies solution-wide shared code, not enrichment-specific |
| `Recall.Core.Enrichment.Abstractions` | Conventional for interface-only packages, but this library holds implementations too (HtmlFetcher, SsrfValidator, MetadataExtractor) |
| `Recall.Core.Enrichment.Common` | **Selected** — accurately scoped to shared enrichment code consumed by both API and Enrichment worker |

### Extraction strategy

1. Move interfaces first: `ISsrfValidator`, `IHtmlFetcher`, `IMetadataExtractor`, `PageMetadata`, `EnrichmentOptions` → shared library.
2. Move implementations: `SsrfValidator`, `HtmlFetcher`, `MetadataExtractor`, `SsrfBlockedException` → shared library.
3. Update namespaces from `Recall.Core.Enrichment.Services` to `Recall.Core.Enrichment.Common.Services`.
4. Add `<ProjectReference>` from both API and Enrichment `.csproj` to the new library.
5. Add the project to `RecallCore.sln` (`dotnet sln add`).
6. Build after each step to catch breakages.

---

## 2. HttpClient Management for Sync Enrichment

### Decision: Use `IHttpClientFactory` with named client

The current `HtmlFetcher` creates its own `HttpClient` in the constructor. When moving to the shared library consumed by both API (request-scoped) and Enrichment (long-lived singleton):

- Register a **named HttpClient** via `builder.Services.AddHttpClient("enrichment-fetch", ...)` with the `SocketsHttpHandler` configuration (no auto-redirect, decompression, connect timeout).
- Inject `IHttpClientFactory` into `HtmlFetcher` and use `factory.CreateClient("enrichment-fetch")` per operation.
- This ensures proper DNS rotation and connection pooling in the API process.
- The Enrichment worker also benefits from this pattern.

**Alternatives considered**: Using a singleton `HttpClient` in the API process — rejected because it misses DNS changes and doesn't benefit from `IHttpClientFactory` pooling.

---

## 3. Timeout Composition

### Decision: Master CancellationTokenSource (4s) with HTML fetch sub-timeout

Hierarchy:

```
HttpContext.RequestAborted (ASP.NET, typically 30s+)
  └── Master enrichment CTS: 4000ms (CreateLinkedTokenSource from RequestAborted)
       └── HTML fetch CTS: 3000ms (linked to master)
            └── HtmlFetcher.FetchHtmlAsync()
```

The sync path is now simpler — only one external HTTP call (HTML fetch). No image download, no blob upload:

- Master CTS (4s) leaves ~1s headroom for item persistence (~10-50ms), metadata extraction (~10-50ms), response serialization (~1-5ms), and Dapr pub/sub publish (~50-200ms).
- HTML fetch CTS (3s) is the only sub-operation timeout.
- `HttpClient.SendAsync` throws `OperationCanceledException` (specifically `TaskCanceledException`) when the cancellation token fires at any stage (DNS, connect, header read, body streaming).
- In the sync enrichment orchestrator, `OperationCanceledException` from the master CTS is caught and treated as "enrichment timed out" — set `enrichmentStatus=pending`, queue async fallback.

**Rationale**: `CreateLinkedTokenSource` is the idiomatic .NET pattern for composing timeouts. It respects both the overall budget and per-operation limits while automatically propagating client disconnection from `HttpContext.RequestAborted`.

---

## 4. Memory Management for HTML Downloads

### Decision: Streaming with size limits (existing pattern)

The current `HtmlFetcher.ReadStreamWithLimitAsync` already implements the correct pattern:

- Uses `HttpCompletionOption.ResponseHeadersRead` to avoid buffering the full response.
- Reads in 8KB chunks, tracking total bytes.
- Throws `InvalidOperationException("Response too large.")` when the limit is exceeded.

For the shared library:
- **HTML fetch**: 5MB limit (existing `MaxResponseSizeBytes` in `EnrichmentOptions`)
- No image download in sync path — only the og:image URL is extracted from HTML metadata.

**No changes to the streaming approach are needed.**

---

## 5. Preview Image Strategy: Store og:image URL, Don't Download

### Decision: Store the og:image URL directly on the Item entity — no image download in sync path

Instead of downloading og:image bytes, validating them, and uploading to blob storage during the sync request, **simply store the og:image URL** as a new `PreviewImageUrl` field on the Item entity. The frontend renders this URL directly via `<img src="...">`.

**Why this is better**:

1. **Faster sync path**: Eliminates image download (0.5-2s), content validation, and blob upload from the sync request. The sync path is now HTML fetch + parse only.
2. **Simpler architecture**: No `IImageDownloader`, no `IThumbnailWriter` in the shared library. No SkiaSharp, no magic bytes checking, no content-type validation.
3. **No blob storage dependency in sync path**: The API doesn't need write access to blob storage for item creation.
4. **og:image URLs are designed for public consumption**: They are stable, CDN-backed, and optimized for social sharing (typically 1200×630, 50-200KB).

**Trade-offs**:

- **Privacy**: The user's browser fetches the og:image directly from the third-party server when viewing bookmarks, exposing the user's IP to that server. This is acceptable because:
  - og:image URLs are designed for public sharing (used by Twitter, Facebook, Slack, etc.)
  - The user explicitly chose to save this page
  - The alternative (proxying through our API) adds latency, bandwidth cost, and complexity
- **Link rot**: If the og:image URL becomes unavailable later, the preview image breaks. Mitigation: the async fallback screenshot still runs for items without an og:image, and users can trigger re-enrichment.
- **Mixed content**: If the og:image is HTTP and our app is HTTPS, browsers may block it. Most sites serve og:image over HTTPS.

**How `PreviewImageUrl` and `ThumbnailStorageKey` work together**:

| Field | Source | Set by | Used when |
|---|---|---|---|
| `PreviewImageUrl` | og:image / twitter:image URL | Sync enrichment | og:image found in page metadata |
| `ThumbnailStorageKey` | Playwright screenshot blob key | Async fallback worker | No og:image found; screenshot captured |

The frontend displays `previewImageUrl` (direct external URL) if available, falling back to the thumbnail endpoint (`/api/v1/items/{id}/thumbnail`) for screenshot-based thumbnails.

**Alternatives considered**:
- Download og:image bytes and store in blob — rejected because it adds 0.5-2s latency, requires blob write access in API, introduces image validation complexity, and provides marginal benefit for URLs that are already publicly accessible.
- Proxy og:image through our API — rejected because it adds latency, bandwidth cost, and the API becomes a CDN for third-party images.

---

## 6. Sync Enrichment Service Design

### Decision: Return a result object (`SyncEnrichmentResult`), caller applies to entity

Define a result type:

```
SyncEnrichmentResult:
  - Title: string?            — extracted title, or null if not found
  - Excerpt: string?          — extracted excerpt, or null if not found
  - PreviewImageUrl: string?  — og:image / twitter:image URL (stored directly, not downloaded)
  - NeedsAsyncFallback: bool  — true if no preview image URL was found
  - Error: string?            — if enrichment failed entirely
  - Duration: TimeSpan        — for metrics
```

The **caller** (`ItemService.SaveItemAsync`) applies results to the entity, respecting FR-008:

```csharp
item.Title = request.Title ?? result.Title;      // user-provided wins
item.Excerpt = request.Excerpt ?? result.Excerpt; // user-provided wins
item.PreviewImageUrl = result.PreviewImageUrl;
item.EnrichmentStatus = result.NeedsAsyncFallback ? "pending" : "succeeded";
item.EnrichedAt = result.PreviewImageUrl != null ? DateTime.UtcNow : null;
```

### Partial success mapping:

| Title | Excerpt | Image | EnrichmentStatus | Async job? |
|-------|---------|-------|------------------|------------|
| ✓ | ✓ | ✓ | `succeeded` | No |
| ✓ | ✓ | ✗ | `pending` | Yes (screenshot only) |
| ✓ | ✗ | ✓ | `succeeded` | No |
| ✓ | ✗ | ✗ | `pending` | Yes |
| ✗ | ✗ | ✗ | `pending` | Yes (full enrichment) |

**Rationale**: Keeps `ISyncEnrichmentService` decoupled from the `Item` entity (which lives in `Recall.Core.Api.Entities`). The shared library doesn't need a reference to the API project. Easier to unit test — assert on the result object without inspecting entity state.

---

## 7. Async Worker Narrowing Strategy

### Decision: Worker checks database state, skips HTML fetch if title+excerpt exist

The existing `EnrichmentService.EnrichAsync` already reads the item from MongoDB and preserves existing title/excerpt. The narrowing:

1. Worker reads item from database (already happens on line ~70 of `EnrichmentService.cs`).
2. If `item.Title != null && item.Excerpt != null` → skip HTML fetch/parse, go straight to Playwright screenshot.
3. If either is null → do full enrichment (HTML fetch + parse + screenshot), same as today.

### Message schema changes: None

**No changes to `EnrichmentJob` schema.** The worker makes state-driven decisions by reading the item's current state from the database, not from message hints.

| Approach | Pros | Cons |
|----------|------|------|
| Message hints (`needsMetadata`, `needsScreenshot`) | Avoids database read; explicit intent | Schema coupling; hints can become stale; requires versioning |
| **Worker checks database (selected)** | Always uses latest state; no schema changes; idempotent | One extra database read per job (negligible — already happens today) |

---

## 8. Ownership-Safe Write-Back in Async Worker

### Decision: Verify userId match before updating

The existing worker already verifies `item.UserId == job.UserId` before processing (line ~66 of `EnrichmentService.cs`). This remains unchanged. The ownership check occurs:

1. Read item from database by `itemId`.
2. Verify `item.UserId == job.UserId` — if mismatch, log error and skip.
3. Process enrichment (screenshot or full).
4. Update item with results.

This is already implemented correctly and does not need changes.

---

## 9. SSRF Validation Sharing

### Decision: Single `SsrfValidator` in shared library, consumed by all fetch paths

The current `SsrfValidator` in `Recall.Core.Enrichment` is complete and well-tested. Moving it to `Recall.Core.Enrichment.Common`:

- Used by `HtmlFetcher` for HTML page fetching (validates every URL including redirect targets).
- Used by `ThumbnailGenerator` in the Enrichment worker for og:image fallback (already uses it).

The sync path no longer downloads images, so SSRF validation during sync is needed **only for the HTML fetch**. The async worker path retains SSRF validation for og:image download and screenshot URL validation.

All SSRF validation goes through a **single implementation** — eliminating the risk of inconsistent rules between sync and async paths.

---

## 10. Re-enrichment Endpoint Changes

### Decision: Re-enrichment performs sync enrichment first, then queues async fallback

The existing `POST /api/v1/items/{id}/enrich` endpoint resets `enrichmentStatus=pending` and publishes an async job. With the new architecture:

1. Reset `enrichmentStatus=pending`.
2. Run `ISyncEnrichmentService.EnrichAsync(url, cancellationToken)`.
3. Apply results (title/excerpt may be refreshed, `previewImageUrl` updated).
4. If no `previewImageUrl` obtained → publish async fallback job (screenshot).
5. If `previewImageUrl` obtained → set `enrichmentStatus=succeeded`, skip async job.

This aligns with FR-016 and maintains the existing endpoint contract.

---

## Summary of Key Decisions

| Topic | Decision |
|-------|----------|
| Shared library name | `Recall.Core.Enrichment.Common` |
| AppHost registration | Not needed — class library, project reference only |
| HttpClient | `IHttpClientFactory` with named client `enrichment-fetch` |
| Timeout strategy | Master CTS 4s → HTML CTS 3s (no image download in sync path) |
| Memory limits | Streaming with size limits: 5MB HTML |
| Preview image | Store og:image URL directly — no download, no blob upload in sync path |
| Service design | Return `SyncEnrichmentResult` — caller applies to entity |
| Async worker narrowing | Worker checks DB state, skips HTML fetch if title+excerpt exist |
| Message schema | No changes — worker is state-driven |
| SSRF sharing | Single `SsrfValidator` in shared library |
| Budget enforcement | Master CTS 4s, HTML fetch CTS 3s |
| Re-enrichment | Sync first, async fallback only if no preview image URL |
