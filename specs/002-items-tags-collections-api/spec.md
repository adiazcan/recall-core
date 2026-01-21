# Feature Specification: Backend APIs for Items, Tags, and Collections

**Feature Branch**: `002-items-tags-collections-api`  
**Created**: January 21, 2026  
**Status**: Draft  
**Input**: User description: "Backend APIs for Items (save/delete/list) + Tags + Collections - CRUD-lite APIs to save and manage saved URLs (items), organize them into collections, and tag them. API contracts + persistence + minimal validation + tests. No ingestion/enrichment/reader-mode parsing."

## Overview

This feature implements the core backend API surface for managing saved URLs ("items"), organizing them with tags and collections. The focus is on fast URL saving, proper deduplication, and flexible organization primitives. This is a foundation feature that enables users to build their personal knowledge base before any enrichment or processing capabilities are added.

### Out of Scope

- Authentication / multi-user support
- Ingestion pipeline, web scraping, OpenGraph enrichment, reader-mode content extraction
- Full-text search (q parameter)
- Sync, sharing, highlights, notes, offline, browser extension
- Advanced hierarchy rules beyond optional parentId
- Soft-delete functionality

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a URL for Later (Priority: P1)

A user finds an interesting article or resource online and wants to save it quickly for later reading. The user provides the URL and optionally a title. The system validates the URL, checks for duplicates, and persists the item immediately.

**Why this priority**: This is the core value proposition - the ability to save content. Without this, no other feature has purpose.

**Independent Test**: Can be fully tested by calling POST /api/v1/items with a valid URL and verifying the response contains the saved item with correct metadata.

**Acceptance Scenarios**:

1. **Given** no items exist, **When** user saves a valid http/https URL, **Then** the system creates a new item and returns it with status 201 and generated id, createdAt, and default status "unread"
2. **Given** an item already exists with the same URL, **When** user tries to save the same URL again, **Then** the system returns the existing item with status 200 (no duplicate created)
3. **Given** the user provides an invalid URL (not http/https or malformed), **When** user attempts to save, **Then** the system returns 400 with a structured error message
4. **Given** a valid URL, **When** user saves with optional title and tags, **Then** the item is created with those values attached

---

### User Story 2 - Browse and Filter Saved Items (Priority: P1)

A user wants to view their saved items with the ability to filter by status (unread/archived), favorites, collection, or tags. The list must be paginated for performance.

**Why this priority**: Viewing saved items is essential for the user to access their saved content. Equally critical as saving.

**Independent Test**: Can be fully tested by creating several items, then calling GET /api/v1/items with various filter combinations and verifying correct pagination and filtering.

**Acceptance Scenarios**:

1. **Given** multiple items exist, **When** user requests items list without filters, **Then** the system returns paginated items sorted by most recent first
2. **Given** items with different statuses exist, **When** user filters by status=unread, **Then** only unread items are returned
3. **Given** items in different collections, **When** user filters by collectionId, **Then** only items in that collection are returned
4. **Given** items with various tags, **When** user filters by tag name, **Then** only items with that tag are returned
5. **Given** more items than the page size, **When** user requests with pagination cursor, **Then** the next page of results is returned with proper cursor for further pagination

---

### User Story 3 - Organize Items with Tags (Priority: P2)

A user wants to tag their saved items with keywords for easy categorization and later retrieval. Tags are simple text labels that can be attached to multiple items.

**Why this priority**: Tags provide the primary organizational mechanism beyond collections. Critical for finding content.

**Independent Test**: Can be fully tested by creating items with tags, listing tags with counts, and verifying tag operations work correctly.

**Acceptance Scenarios**:

1. **Given** items exist with tags, **When** user requests the tags list, **Then** the system returns all unique tags with the count of items for each
2. **Given** a tag used by multiple items, **When** user renames the tag globally, **Then** all items are updated to use the new tag name
3. **Given** a tag used by items, **When** user deletes the tag with detach mode, **Then** the tag is removed from all items but items remain
4. **Given** an item being updated, **When** user adds/removes tags via PATCH, **Then** the item's tags are updated accordingly
5. **Given** different case variations of a tag name (e.g., "Tech", "TECH", "tech"), **When** saved, **Then** they are normalized to the same lowercase form

---

### User Story 4 - Organize Items with Collections (Priority: P2)

A user wants to organize their saved items into collections (like folders). Collections can optionally have parent collections for hierarchy.

**Why this priority**: Collections provide folder-like organization which is intuitive for users who prefer hierarchical organization.

**Independent Test**: Can be fully tested by creating collections, assigning items, and verifying list operations return correct item counts.

**Acceptance Scenarios**:

1. **Given** the user wants to organize items, **When** user creates a new collection with a name, **Then** the collection is created with a unique id
2. **Given** collections exist, **When** user requests collections list, **Then** each collection includes the count of items it contains
3. **Given** a collection with items, **When** user deletes the collection (default mode), **Then** items are moved to inbox (collectionId becomes null) and collection is deleted
4. **Given** a collection with items, **When** user deletes the collection with cascade mode, **Then** both collection and its items are permanently deleted
5. **Given** a collection exists, **When** user renames it via PATCH, **Then** the collection name is updated
6. **Given** collections exist, **When** user moves a collection by setting parentId, **Then** the collection hierarchy is updated

---

### User Story 5 - Update Item Metadata (Priority: P2)

A user wants to update their saved item's metadata such as marking as favorite, archiving, changing collection, editing title/excerpt, or modifying tags.

**Why this priority**: Users need to refine and organize their items after initial save.

**Independent Test**: Can be fully tested by creating an item and calling PATCH with various field updates.

**Acceptance Scenarios**:

1. **Given** an unread item, **When** user marks it as archived, **Then** the item status changes to "archived"
2. **Given** an item, **When** user marks it as favorite, **Then** the isFavorite flag is set to true
3. **Given** an item in no collection, **When** user assigns it to a collection, **Then** the collectionId is updated
4. **Given** an item, **When** user updates title and excerpt, **Then** those fields are persisted
5. **Given** an item with tags, **When** user updates tags array, **Then** the tags are replaced with the new set

---

### User Story 6 - Delete an Item (Priority: P3)

A user wants to permanently remove a saved item they no longer need.

**Why this priority**: Necessary for housekeeping but less frequently used than other operations.

**Independent Test**: Can be fully tested by creating an item, deleting it, and verifying it no longer appears in lists.

**Acceptance Scenarios**:

1. **Given** an item exists, **When** user deletes it, **Then** the item is permanently removed and returns 204
2. **Given** an item does not exist, **When** user tries to delete it, **Then** the system returns 404

---

### User Story 7 - Get Single Item Details (Priority: P3)

A user or client application wants to retrieve the full details of a specific saved item by its ID.

**Why this priority**: Supporting feature for viewing item details.

**Independent Test**: Can be fully tested by creating an item and retrieving it by ID.

**Acceptance Scenarios**:

1. **Given** an item exists, **When** user requests it by ID, **Then** the full item details are returned
2. **Given** an item does not exist, **When** user requests it by ID, **Then** the system returns 404

---

### Edge Cases

- What happens when saving a URL that redirects? The provided URL is stored as-is; canonicalUrl handling is deferred to future enrichment features.
- How does the system handle concurrent duplicate saves of the same URL? The deduplication check occurs at save time; race conditions may result in a duplicate, but subsequent saves will return the existing item.
- What happens when deleting a tag that doesn't exist? The system returns 404.
- What happens when creating a collection with a name that already exists? The system returns 409 Conflict.
- How does the system handle very long URLs? URLs must be valid http/https and reasonable length (max 2048 characters).
- What happens when assigning an item to a non-existent collection? The system returns 400 with validation error.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

#### Items

- **FR-001**: System MUST accept HTTP/HTTPS URLs up to 2048 characters for saving
- **FR-002**: System MUST normalize URLs before storage (lowercase scheme/host, sort query params, remove fragments) for deduplication
- **FR-003**: System MUST return existing item with status 200 when saving a duplicate URL (no new record created)
- **FR-004**: System MUST validate URLs are well-formed HTTP/HTTPS; reject others with 400 error
- **FR-005**: System MUST persist items with: id, url, normalizedUrl, title, excerpt, status, isFavorite, collectionId, tags, createdAt, updatedAt
- **FR-006**: System MUST default new items to status "unread" and isFavorite false
- **FR-007**: System MUST support partial updates to items via PATCH (status, isFavorite, collectionId, title, excerpt, tags)
- **FR-008**: System MUST permanently delete items on DELETE request (hard delete)

#### Collections

- **FR-009**: System MUST enforce unique collection names; return 409 Conflict on duplicate
- **FR-010**: System MUST support optional parentId for collection hierarchy
- **FR-011**: System MUST return itemCount (computed) when listing or retrieving collections
- **FR-012**: System MUST support two deletion modes: default (orphan items to inbox) and cascade (delete items)

#### Tags

- **FR-013**: System MUST normalize tags to lowercase on save
- **FR-014**: System MUST store tags as embedded string array within items (not separate collection)
- **FR-015**: System MUST support listing all tags with item counts via aggregation
- **FR-016**: System MUST support global tag rename (updates all items with that tag)
- **FR-017**: System MUST support global tag delete/detach (removes tag from all items, keeps items)

#### API Conventions

- **FR-018**: System MUST support cursor-based pagination on list endpoints (default limit 20, max 50)
- **FR-019**: System MUST return consistent error envelope: `{ "error": { "code": "...", "message": "..." } }`
- **FR-020**: System MUST return 404 with error envelope when resource not found
- **FR-021**: System MUST validate collectionId references exist before assigning to items; return 400 if invalid

### Key Entities

- **Item**: A saved URL/bookmark. Key attributes: url (original), normalizedUrl (for dedup), title, excerpt, status (unread/archived), isFavorite, collectionId (nullable FK), tags (string array), timestamps. Unique constraint on normalizedUrl.
- **Collection**: A folder-like container for organizing items. Key attributes: name (unique), description, parentId (nullable self-reference for hierarchy), timestamps. Derived attribute: itemCount (computed at query time).
- **Tag**: Embedded within Item as lowercase string array. No separate entity. Operations (list/rename/delete) performed via aggregation on items collection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: POST /api/v1/items returns acknowledgment in <200ms p95 (persistence only, no enrichment)
- **SC-002**: GET /api/v1/items with 1000+ items returns paginated results with stable cursor navigation
- **SC-003**: All 7 user story acceptance scenarios pass in automated integration tests
- **SC-004**: Duplicate URL detection works correctly—saving same URL twice returns existing item, not 201
- **SC-005**: Collection delete modes work as specified—default orphans items, cascade deletes items
- **SC-006**: Tag operations (list/rename/delete) correctly affect all items globally
- **SC-007**: API error responses follow consistent envelope format with appropriate HTTP status codes
