# Feature Specification: Bookmark Enrichment on Creation

**Feature Branch**: `005-bookmark-enrichment`  
**Created**: January 25, 2026  
**Status**: Draft  
**Input**: User description: "Bookmark enrichment on creation (title + excerpt + thumbnail)"

---

## Overview

When a user saves a bookmark (creates an Item), the system automatically enriches it by fetching the page title, extracting a short excerpt, and generating a thumbnail image. Enrichment runs asynchronously so that saving remains fast and reliable. Users see enriched content when viewing their bookmarks.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fast Bookmark Save with Background Enrichment (Priority: P1)

As a user, I want to save a URL to my collection and have it immediately available, while the system automatically fetches the page title, excerpt, and thumbnail in the background.

**Why this priority**: Core value proposition—users get both speed and rich content without manual effort.

**Independent Test**: Save a URL and verify it appears immediately with pending status. After a short delay, refresh and confirm title, excerpt, and thumbnail are populated.

**Acceptance Scenarios**:

1. **Given** a user is authenticated, **When** they create a bookmark with a valid URL, **Then** the bookmark is saved immediately and returned with `enrichmentStatus=pending`.
2. **Given** a newly created bookmark exists, **When** background enrichment completes successfully, **Then** the bookmark has `title`, `excerpt`, and `thumbnailUrl` populated and `enrichmentStatus=succeeded`.
3. **Given** a newly created bookmark exists, **When** background enrichment fails (e.g., page unreachable), **Then** the bookmark has `enrichmentStatus=failed` and `enrichmentError` contains a safe summary.

---

### User Story 2 - View Enriched Bookmarks (Priority: P1)

As a user, I want to see the title, excerpt, and thumbnail for my saved bookmarks so I can quickly identify and browse my collection.

**Why this priority**: Directly enables the value of enrichment—users must be able to see the enriched data.

**Independent Test**: List bookmarks and verify enriched fields (title, excerpt, thumbnailUrl, enrichmentStatus) are returned in the response.

**Acceptance Scenarios**:

1. **Given** a user has enriched bookmarks, **When** they list their items, **Then** each item shows title, excerpt, thumbnailUrl, and enrichmentStatus.
2. **Given** a user has a bookmark with a thumbnail, **When** they access the thumbnail endpoint, **Then** they receive the image data.
3. **Given** a different user exists, **When** they attempt to access another user's thumbnail, **Then** they receive a 404 error (not 403).

---

### User Story 3 - Secure Thumbnail Access (Priority: P1)

As a user, I want my thumbnails to be accessible only to me, ensuring my saved content is not visible to other users.

**Why this priority**: Security is critical—thumbnails must not leak across users.

**Independent Test**: Authenticate as User A, save a bookmark, then authenticate as User B and attempt to access User A's thumbnail—expect 404.

**Acceptance Scenarios**:

1. **Given** User A has a bookmark with a thumbnail, **When** User A requests the thumbnail, **Then** the thumbnail is returned successfully.
2. **Given** User A has a bookmark with a thumbnail, **When** User B requests the thumbnail, **Then** a 404 response is returned.
3. **Given** an unauthenticated request is made to the thumbnail endpoint, **Then** a 401 response is returned.

---

### User Story 4 - SSRF Protection (Priority: P1)

As a system operator, I want the enrichment process to reject attempts to access internal/private network resources, preventing SSRF attacks.

**Why this priority**: Security requirement—must protect internal infrastructure from malicious URLs.

**Independent Test**: Create a bookmark with a localhost or private IP URL and verify enrichment fails safely with appropriate error.

**Acceptance Scenarios**:

1. **Given** a user creates a bookmark with `http://localhost/secret`, **When** enrichment runs, **Then** it fails with a safe error message and `enrichmentStatus=failed`.
2. **Given** a user creates a bookmark with `http://192.168.1.1/admin`, **When** enrichment runs, **Then** it fails with a safe error message.
3. **Given** a user creates a bookmark with `http://[::1]/internal`, **When** enrichment runs, **Then** it fails with a safe error message.
4. **Given** a user creates a bookmark with `file:///etc/passwd`, **When** enrichment runs, **Then** it fails (non-http(s) scheme blocked).

---

### User Story 5 - Retry Failed Enrichment (Priority: P2)

As a user, I want to be able to retry enrichment for a bookmark that previously failed, in case the page is now available.

**Why this priority**: Improves user experience for transient failures without requiring bookmark re-creation.

**Independent Test**: Create a bookmark that fails enrichment, then manually trigger re-enrichment and verify it processes.

**Acceptance Scenarios**:

1. **Given** a bookmark has `enrichmentStatus=failed`, **When** the user triggers re-enrichment via the optional endpoint, **Then** enrichment is re-queued and status becomes `pending`.
2. **Given** a bookmark has `enrichmentStatus=succeeded`, **When** the user triggers re-enrichment, **Then** enrichment is re-queued (refresh scenario).

---

### User Story 6 - Deduplication Does Not Re-Enrich (Priority: P2)

As a user, when I save a URL that already exists in my collection, I want the existing bookmark returned without triggering redundant enrichment.

**Why this priority**: Efficiency—avoid unnecessary work and maintain fast responses.

**Independent Test**: Save the same URL twice and verify the second request returns the existing item without enqueueing new enrichment.

**Acceptance Scenarios**:

1. **Given** an item with a URL already exists, **When** the user creates an item with the same URL, **Then** the existing item is returned.
2. **Given** deduplication returns an existing item, **When** the response is returned, **Then** no new enrichment job is enqueued.

---

### Edge Cases

- What happens when the target URL returns a very large page? (Size limits enforced)
- What happens when the target URL is extremely slow? (Timeouts enforced)
- What happens when the page has no title or meta description? (Graceful fallbacks)
- What happens when og:image is invalid or unreachable? (Screenshot fallback attempted)
- What happens when both og:image and screenshot fail? (Enrichment succeeds with null thumbnail)
- What happens when enrichment runs on an already-enriched item? (Idempotent update)

---

## Requirements *(mandatory)*

### Functional Requirements

**Data Model**

- **FR-001**: System MUST extend Item entity with: `title` (string, nullable), `excerpt` (string, nullable), `thumbnailUrl` or `thumbnailStorageKey` (string, nullable), `enrichmentStatus` (enum: pending|succeeded|failed), `enrichmentError` (string, nullable), `enrichedAt` (datetime, nullable).
- **FR-002**: All enrichment fields MUST be user-scoped and MUST NOT leak across users.

**Create Flow**

- **FR-003**: POST /api/v1/items MUST create the item immediately and return within acceptable response time, with `enrichmentStatus=pending` for new items.
- **FR-004**: POST /api/v1/items MUST enqueue an enrichment job for newly created items only.
- **FR-005**: When deduplication returns an existing item, the system MUST NOT enqueue a new enrichment job.

**Enrichment Worker**

- **FR-006**: System MUST implement a background worker that processes enrichment jobs.
- **FR-007**: Worker MUST fetch the HTML for the item URL with strict timeouts and size limits.
- **FR-008**: Worker MUST extract title with priority: og:title → `<title>` tag.
- **FR-009**: Worker MUST extract excerpt with priority: og:description → meta description → first meaningful paragraph.
- **FR-010**: Worker MUST sanitize extracted title and excerpt before storing (HTML entities decoded, tags stripped).
- **FR-011**: Worker MUST generate thumbnail with priority: og:image (download and store) → screenshot via headless browser.
- **FR-012**: Worker MUST update item with enrichment results and set `enrichmentStatus` to `succeeded` or `failed`.
- **FR-013**: Worker MUST be idempotent—safe to retry without side effects.

**Thumbnail Storage**

- **FR-014**: Thumbnails MUST be stored in blob storage (emulator for local dev, cloud for production).
- **FR-015**: Item record MUST store only the thumbnail URL or storage key, not the image data.
- **FR-016**: System MUST provide GET /api/v1/items/{id}/thumbnail endpoint to retrieve thumbnails.
- **FR-017**: Thumbnail endpoint MUST require authentication and MUST return 404 for items belonging to other users.

**API Behavior**

- **FR-018**: GET /api/v1/items and GET /api/v1/items/{id} MUST return enrichment fields in the response.
- **FR-019**: System SHOULD provide POST /api/v1/items/{id}/enrich endpoint to manually trigger re-enrichment.

**Security**

- **FR-020**: Worker MUST implement SSRF protection: block private IP ranges (10.x, 172.16-31.x, 192.168.x), localhost, link-local (169.254.x), loopback (127.x, ::1), and non-http(s) schemes.
- **FR-021**: Worker MUST resolve DNS and verify the resolved IP is not in blocked ranges before connecting.
- **FR-022**: Enrichment failures MUST NOT break core item operations (create, read, update, delete).
- **FR-023**: Worker MUST NOT execute untrusted scripts except within an isolated screenshot renderer sandbox.

**Reliability**

- **FR-024**: Worker MUST implement retry policy with exponential backoff for transient failures.
- **FR-025**: Worker MUST enforce maximum fetch size limit to prevent memory exhaustion.
- **FR-026**: Worker MUST enforce request timeout to prevent hanging on slow servers.

**Observability**

- **FR-027**: System MUST emit structured logs for job lifecycle events (queued, started, succeeded, failed).
- **FR-028**: System MUST track metrics: jobs succeeded, jobs failed, average duration.

---

### Key Entities

- **Item (extended)**: Existing bookmark entity, now with additional enrichment fields (title, excerpt, thumbnailUrl/thumbnailStorageKey, enrichmentStatus, enrichmentError, enrichedAt). Each item belongs to exactly one user.
- **EnrichmentJob**: Logical job unit representing work to enrich a single item. Contains itemId and userId. Processed by background worker.
- **Thumbnail**: Binary image data stored in blob storage. Referenced by storage key in Item. Accessible only to the owning user.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Creating a bookmark completes in under 500ms, regardless of target page load time.
- **SC-002**: 95% of enrichment jobs for reachable pages complete successfully.
- **SC-003**: Enrichment jobs complete within 30 seconds for typical pages.
- **SC-004**: Title and excerpt are populated for pages that have `<title>` or meta tags.
- **SC-005**: Thumbnail is populated for pages with og:image or accessible screenshot.
- **SC-006**: 100% of SSRF-blocked URL attempts fail safely (no internal network access occurs).
- **SC-007**: Thumbnails are accessible only to authenticated owners (0% cross-user leakage).
- **SC-008**: Failed enrichment jobs can be retried without manual intervention or data corruption.

---

## Assumptions

- The existing Item entity and repository patterns can be extended without breaking changes.
- A queue mechanism (in-memory for dev, durable for production) is acceptable for job processing.
- Headless browser screenshot capability exists or can be added as a dependency.
- Blob storage emulator (e.g., Azurite) is available for local development.
- DNS resolution is available in the worker environment.
- Enrichment processing time is not included in the 500ms create response time (async).

---

## Out of Scope

- Full content storage / reader mode HTML
- Full-text indexing or search
- Semantic embeddings or AI-based classification
- Notes or highlights on bookmarks
- Advanced content type classification (only basic heuristics if needed)
- Webhook notifications for enrichment completion
- Real-time updates (polling is acceptable)
