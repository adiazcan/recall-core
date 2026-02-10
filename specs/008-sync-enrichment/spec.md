# Feature Specification: Synchronous Enrichment on Item Creation

**Feature Branch**: `008-sync-enrichment`  
**Created**: February 9, 2026  
**Status**: Draft  
**Input**: User description: "Move the core enrichment process to the synchronous item creation flow, ensuring that most items are created with Title, Excerpt, Preview image (when available). The asynchronous image capture job must run only as a fallback when a valid preview image cannot be obtained during synchronous processing."

---

## Overview

Today, when a user saves a bookmark, the system stores it immediately with `enrichmentStatus=pending` and all metadata fields empty. Title, excerpt, and thumbnail are populated later by an asynchronous background worker. This means users often see blank bookmarks until enrichment completes — degrading the experience.

This feature moves metadata extraction (title, excerpt, and preview image download) into the synchronous item-creation request. The user's bookmark is returned fully enriched in most cases. The asynchronous image-capture job (headless browser screenshot) is retained only as a fallback for pages that lack a usable preview image (no `og:image` or `twitter:image`, or the image fails to download).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Instant Enriched Bookmark (Priority: P1)

As a user, I want my saved bookmark to immediately display its title, excerpt, and preview image so I can recognise it at a glance without waiting for background processing.

**Why this priority**: This is the core value of the feature — eliminating the "blank bookmark" gap between save and enrichment.

**Independent Test**: Save a URL to a page that has `og:title`, `meta description`, and `og:image`. Verify the response includes populated title, excerpt, and previewImageUrl with `enrichmentStatus=succeeded`.

**Acceptance Scenarios**:

1. **Given** a user saves a URL to a page with `og:title`, `og:description`, and a valid `og:image`, **When** the create request completes, **Then** the returned item has title, excerpt, and previewImageUrl populated (the og:image URL stored directly), and `enrichmentStatus=succeeded`.
2. **Given** a user saves a URL to a page with a `<title>` tag and a `<meta name="description">` tag but no `og:image`, **When** the create request completes, **Then** title and excerpt are populated, previewImageUrl is null, and `enrichmentStatus=pending` (async screenshot fallback queued).
3. **Given** a user saves a URL to a page with no extractable metadata, **When** the create request completes, **Then** title and excerpt remain null, and `enrichmentStatus=pending` (async fallback queued).

---

### User Story 2 — Async Screenshot Fallback (Priority: P1)

As a user, when the page I save lacks a preview image, I want the system to automatically generate a screenshot in the background so my bookmark eventually gets a visual thumbnail.

**Why this priority**: Ensures comprehensive coverage — bookmarks without `og:image` still get thumbnails, without slowing down the save response.

**Independent Test**: Save a URL to a page that has metadata but no `og:image`. Verify the response returns immediately with title/excerpt populated, `enrichmentStatus=pending`, and previewImageUrl null. After the async job completes, verify the item now has a thumbnailStorageKey and `enrichmentStatus=succeeded`.

**Acceptance Scenarios**:

1. **Given** a newly created item has title and excerpt but no preview image (no `og:image` found during sync processing, so previewImageUrl is null), **When** the async fallback job runs, **Then** a headless browser screenshot is captured, stored, and the item is updated with `thumbnailStorageKey` and `enrichmentStatus=succeeded`.
2. **Given** a newly created item where no og:image URL was found during sync and the async screenshot also fails, **When** the async fallback job completes, **Then** `enrichmentStatus=succeeded` (title/excerpt already populated), thumbnailStorageKey remains null, and no error is raised.
3. **Given** a newly created item where the entire sync enrichment failed (page unreachable), **When** the async fallback job runs, **Then** it retries the full enrichment (title, excerpt, and screenshot) and updates the item accordingly.

---

### User Story 3 — Enrichment Does Not Block on Slow Pages (Priority: P1)

As a user, I want my save request to complete within a reasonable time even if the target page is slow or unresponsive, with the system gracefully falling back to async processing.

**Why this priority**: Moving enrichment into the request path introduces latency risk. Users must not experience unacceptable delays.

**Independent Test**: Save a URL to a page that takes longer than the sync timeout to respond. Verify the create response returns within the overall timeout with `enrichmentStatus=pending` and empty metadata fields.

**Acceptance Scenarios**:

1. **Given** a user saves a URL to a page that exceeds the sync fetch timeout, **When** the create request completes, **Then** the item is returned with `enrichmentStatus=pending`, metadata fields are null, and an async fallback job is queued.
2. **Given** a user saves a URL to a page where HTML fetches quickly but has no `og:image` meta tag, **When** the create request completes, **Then** title and excerpt are populated, previewImageUrl is null, and an async fallback job is queued for the screenshot.

---

### User Story 4 — Deduplication Unchanged (Priority: P2)

As a user, when I save a URL that already exists in my collection, I expect the existing item to be returned without triggering any new enrichment.

**Why this priority**: Preserves existing deduplication behavior — no regressions from the architecture change.

**Independent Test**: Save the same URL twice. Verify the second response returns the existing item without re-fetching metadata or publishing an async job.

**Acceptance Scenarios**:

1. **Given** an item with a given URL already exists for the user, **When** the user saves the same URL again, **Then** the existing item is returned and no sync or async enrichment is triggered.

---

### User Story 5 — Re-enrichment Endpoint Unchanged (Priority: P2)

As a user, I want to manually trigger re-enrichment for a bookmark, which should now perform sync enrichment first and fall back to async for the screenshot.

**Why this priority**: Existing functionality must continue to work with the new enrichment model.

**Independent Test**: Trigger re-enrichment on an existing item. Verify that title/excerpt are refreshed synchronously, and if no `og:image` is available, a screenshot fallback job is queued.

**Acceptance Scenarios**:

1. **Given** a bookmark with stale or missing metadata, **When** the user triggers re-enrichment, **Then** the system performs sync metadata extraction and updates title/excerpt immediately, queuing an async screenshot job only if no preview image is available.

---

### User Story 6 — SSRF Protection Maintained (Priority: P1)

As a system operator, I want the sync enrichment path to enforce the same SSRF protections as the existing async worker, preventing access to internal network resources.

**Why this priority**: Security requirement — SSRF vectors must not be introduced by moving enrichment to the API process.

**Independent Test**: Save a URL pointing to `http://localhost/secret` or `http://192.168.1.1/admin`. Verify enrichment fails safely and the item is created with `enrichmentStatus=failed`.

**Acceptance Scenarios**:

1. **Given** a user saves a URL with a private/loopback IP or non-http(s) scheme, **When** sync enrichment runs, **Then** the URL is blocked, `enrichmentStatus=failed`, and a safe error message is recorded.
2. **Given** a user saves a URL that redirects to a private IP, **When** sync enrichment follows the redirect, **Then** the redirect target is blocked and enrichment fails safely.

---

### Edge Cases

- What happens when the target page returns a very large HTML document? (Size limits enforced, same as current worker limits.)
- What happens when `og:image` points to a very large file? (No image bytes are downloaded during sync enrichment — the URL is stored directly per FR-004. Image size is irrelevant in the sync path. The frontend or a future CDN proxy may enforce size limits when rendering.)
- What happens when the page is behind a login wall or CAPTCHA? (Enrichment extracts whatever metadata is available from the landing page; screenshot fallback captures the visible state.)
- What happens when concurrent saves for the same URL race? (Deduplication guard handles this — same as today.)
- What happens when the API process restarts mid-enrichment? (The item is already persisted; if enrichment output was not saved, status remains `pending` and the async fallback handles it.)
- What happens when a user provides a title at creation time? (User-provided values are preserved; sync enrichment does not overwrite them — same as current behavior.)

---

## Requirements *(mandatory)*

### Functional Requirements

**Sync Enrichment in Item Creation**

- **FR-001**: When creating a new item, the system MUST attempt to fetch the page HTML and extract metadata (title, excerpt, preview image URL) synchronously within the create request.
- **FR-002**: The sync fetch MUST enforce a strict timeout so that slow or unresponsive pages do not cause unacceptable delays to the user's save request.
- **FR-003**: The system MUST extract title with priority: `og:title` → `<title>` → `<h1>` (first found), and excerpt with priority: `og:description` → `meta[name=description]` → first meaningful paragraph.
- **FR-004**: When a preview image URL is found (`og:image` or `twitter:image`), the system MUST store the URL directly as `previewImageUrl` on the item (no image bytes are downloaded during the sync request).
- **FR-005**: If a preview image URL is found and title/excerpt are extracted, the item MUST be returned with `enrichmentStatus=succeeded`, title, excerpt, and `previewImageUrl` populated.
- **FR-005a**: If a preview image URL is found but no title or excerpt could be extracted, the item MUST be returned with `previewImageUrl` populated, title and excerpt null, and `enrichmentStatus=succeeded` (preview image availability is sufficient for visual display; no async fallback needed).
- **FR-006**: If no preview image URL is found (or the page has no `og:image`/`twitter:image` tags), the item MUST be returned with title and excerpt populated (if extracted), `previewImageUrl` null, and `enrichmentStatus=pending` (async screenshot fallback queued).
- **FR-007**: If the HTML fetch fails entirely (timeout, unreachable — but not SSRF-blocked; see FR-017), the item MUST be saved with `enrichmentStatus=pending` and all metadata fields null.
- **FR-008**: User-provided title and excerpt values MUST NOT be overwritten by sync enrichment — only null fields are populated.

**Async Fallback Job**

- **FR-009**: An async fallback job MUST be published when sync enrichment could not populate `previewImageUrl` (no `og:image`/`twitter:image` found, or page unreachable/timed out) **and** the URL was not SSRF-blocked. SSRF-blocked URLs MUST NOT trigger an async fallback.
- **FR-010**: _(Removed.)_
- **FR-011**: The async fallback job MUST attempt a headless browser screenshot to generate a thumbnail.
- **FR-012**: When processing a fallback job for an item that already has title and excerpt, the async worker MUST NOT overwrite those fields.
- **FR-013**: When processing a fallback job for an item with no title or excerpt (full sync failure), the async worker MUST attempt to fetch HTML and extract metadata as well as capture a screenshot.
- **FR-014**: Upon completion of the fallback job: if the async worker captures a screenshot or the item already has title/excerpt, the item MUST be updated with `enrichmentStatus=succeeded`. The item MUST be set to `enrichmentStatus=failed` only when the async worker's own metadata extraction AND screenshot capture both fail AND the item has no pre-existing title or excerpt.

**Deduplication**

- **FR-015**: When deduplication returns an existing item, the system MUST NOT perform sync enrichment or publish an async fallback job.

**Re-enrichment**

- **FR-016**: The re-enrichment endpoint MUST perform sync metadata extraction, then publish an async fallback job only if no preview image was obtained.

**SSRF Protection**

- **FR-017**: Sync enrichment MUST implement the same SSRF protections as the existing async worker: block private IP ranges (10.x, 172.16-31.x, 192.168.x), localhost, link-local (169.254.x), loopback (127.x, ::1), and non-http(s) schemes.
- **FR-018**: DNS resolution MUST be validated against blocked ranges before any connection is made.

**Reliability & Performance**

- **FR-019**: The sync enrichment step MUST enforce a maximum HTML fetch timeout (default: 3 seconds) within an overall sync enrichment budget (default: 4 seconds) to bound request latency.
- **FR-020**: The sync enrichment step MUST enforce a maximum HTML document size (default: 5 MB) to prevent memory exhaustion in the API process.
- **FR-021**: _(Removed — no image download occurs in the sync path. The og:image URL is stored directly; see FR-004.)_
- **FR-022**: A sync enrichment failure MUST NOT prevent the item from being saved — the item is always persisted regardless of enrichment outcome.
- **FR-023**: The async fallback job MUST implement retry with exponential backoff for transient failures (same as current worker).

**Observability**

- **FR-024**: The system MUST emit structured logs for sync enrichment events: started, succeeded, partial (no image), failed, timed out.
- **FR-025**: The system MUST track metrics for sync enrichment: success rate, partial success rate (no image), failure rate, and duration.
- **FR-026**: The existing async enrichment metrics MUST continue to be emitted for fallback jobs.

---

### Key Entities

- **Item**: Existing bookmark entity with enrichment fields (`title`, `excerpt`, `thumbnailStorageKey`, `enrichmentStatus`, `enrichmentError`, `enrichedAt`). One new field added: `previewImageUrl` (nullable string) — the og:image/twitter:image URL stored directly during sync enrichment. `thumbnailStorageKey` is set only by the async screenshot fallback worker.
- **EnrichmentJob (updated semantics)**: The async job message published via Dapr pub/sub. Now represents a *fallback* job (screenshot-only or full-retry) rather than the primary enrichment path. Same schema: `{ itemId, userId, url, enqueuedAt }`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 80% or more of newly created bookmarks are returned with title and excerpt populated in the create response (no waiting for async processing).
- **SC-002**: 60% or more of newly created bookmarks are returned with a preview image in the create response (pages with `og:image`).
- **SC-003**: The item creation request completes within 5 seconds for 95% of saves, including sync enrichment.
- **SC-004**: Items that cannot be enriched synchronously still receive a thumbnail via async screenshot within 60 seconds.
- **SC-005**: SSRF-blocked URL attempts fail safely 100% of the time — no internal network access occurs.
- **SC-006**: Zero regressions in deduplication behavior or data isolation between users.
- **SC-007**: The volume of async enrichment jobs decreases by at least 50% compared to the fully-async model (most enrichment is handled synchronously).
- **SC-008**: Users see enriched bookmark content immediately upon creation for the majority of saves, eliminating the "blank bookmark" experience.

---

## Assumptions

- The existing metadata extraction and HTML fetching implementations from the enrichment worker can be extracted into a shared library or reused in the API project without significant refactoring.
- The existing SSRF validation logic can be shared between the API and enrichment worker projects.
- Storing the og:image URL directly (without downloading image bytes) keeps sync enrichment fast and avoids blob storage writes in the API process.
- The sync enrichment timeout (4s master) is shorter than the overall HTTP request timeout, leaving headroom for the response to be formed and returned.
- The API process has sufficient memory and CPU to handle HTML parsing inline with request processing under expected load.
- The headless browser screenshot capability remains exclusive to the enrichment worker and is NOT moved into the API process due to its resource requirements and latency.

---

## Out of Scope

- Moving headless browser screenshot generation into the synchronous API request (too slow and resource-intensive).
- Changes to the thumbnail storage format, container structure, or blob naming convention.
- Changes to the data model or item entity schema (same fields, different timing of population).
- Changes to the frontend display of enrichment status or bookmark cards.
- Full-text content extraction or reader-mode HTML.
- AI-based classification, embeddings, or summarisation.
- Real-time push notifications for async enrichment completion.
