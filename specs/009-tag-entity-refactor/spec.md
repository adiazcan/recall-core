# Feature Specification: Tag Entity Refactor

**Feature Branch**: `009-tag-entity-refactor`  
**Created**: 2026-02-15  
**Status**: Draft  
**Input**: User description: "Refactor tags: introduce first-class Tag entity (separate from embedded tags). Introduce CRUD for Tags, migrate Items from embedded string tags to tag ID references, provide safe migration with rollback, and update the UI for tag management."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Tag CRUD Management (Priority: P1)

A user wants to manage their tags as independent entities so they can maintain a consistent, curated taxonomy across all saved items. Today tags are free-form strings embedded on each item, which leads to duplicates (e.g., "JavaScript" vs "javascript"), inconsistent naming, and no way to attach metadata (such as color) to a tag. With first-class tags the user can create, view, rename, and delete tags from a single management screen.

**Why this priority**: Without the Tag entity existing as an independent resource, none of the other stories (migration, item tagging, merge) are possible. This is the foundational data-model change.

**Independent Test**: Can be fully tested by creating, listing, renaming, and deleting tags via the API and verifying correct persistence and validation rules.

**Acceptance Scenarios**:

1. **Given** an authenticated user with no tags, **When** the user creates a tag named "Recipes", **Then** the system persists a new Tag entity with display name "Recipes", a normalized name "recipes", and the user's ID as the owner.
2. **Given** an authenticated user who owns the tag "Recipes", **When** the user renames it to "Cooking", **Then** the tag's display name becomes "Cooking", its normalized name becomes "cooking", and the change is reflected on all items that reference this tag.
3. **Given** an authenticated user who owns the tag "Cooking" referenced by 3 items, **When** the user deletes the tag, **Then** the tag is removed and all 3 items no longer reference it.
4. **Given** an authenticated user, **When** the user attempts to create a tag whose normalized name already exists in their account, **Then** the system returns an error indicating the tag already exists.
5. **Given** an authenticated user, **When** the user lists their tags, **Then** the system returns each tag with its display name, normalized name, and the count of items referencing it.

---

### User Story 2 — Item Tagging with Tag References (Priority: P1)

A user wants to tag items using the curated Tag entities instead of free-form strings. When saving or editing an item, the user selects from existing tags or creates new ones on the fly. Items store references (tag IDs) rather than raw strings to ensure consistent naming and easy global updates.

**Why this priority**: This is the core behavioral change for everyday use — the primary interaction users have with tags. Without it, first-class tags provide no end-user value.

**Independent Test**: Can be fully tested by creating items with tag references, updating tags on items, and verifying that item responses expand tag IDs to full tag details.

**Acceptance Scenarios**:

1. **Given** an authenticated user with existing tags "JavaScript" and "Tutorial", **When** the user creates an item and selects both tags, **Then** the item is saved with references to those two Tag entities.
2. **Given** an authenticated user creating an item, **When** the user includes a tag name in the `newTagNames` field that does not match any existing tag, **Then** a new Tag entity is created and the item references it.
3. **Given** an item referencing tag "JavaScript", **When** the user retrieves the item, **Then** the response includes the expanded tag information (ID, display name) rather than just an ID.
4. **Given** an authenticated user, **When** the user filters items by a tag, **Then** only items referencing that specific Tag entity are returned.
5. **Given** an authenticated user editing an item, **When** the user removes a tag reference, **Then** the item no longer references that tag, but the Tag entity itself remains in the system.

---

### User Story 3 — Data Migration from Embedded Tags to Tag Entities (Priority: P1)

An operator or the system needs to migrate existing items from the legacy embedded-string tag format to the new Tag-entity-reference format. The migration must be safe, idempotent, produce zero data loss, and support rollback.

**Why this priority**: Existing users have data in the old format. Without migration, all existing tag data is orphaned when the new model goes live. This is required for backward compatibility.

**Independent Test**: Can be fully tested by running the migration on a dataset with known embedded tags, verifying Tag entities are created with correct deduplication, and confirming items reference the new tag IDs. Rollback can be tested by restoring from the exported mapping.

**Acceptance Scenarios**:

1. **Given** items with embedded tags ["JavaScript", "javascript", "JAVASCRIPT"], **When** the migration runs, **Then** a single Tag entity with normalized name "javascript" is created using the display name of the first occurrence encountered (e.g., "JavaScript"), and all three items reference that same tag ID.
2. **Given** a set of items across multiple users, **When** the migration runs, **Then** each user gets their own independent Tag entities (tags are user-scoped, not global).
3. **Given** the migration has completed, **When** the migration runs again, **Then** no duplicate Tag entities are created and no data is modified (idempotent).
4. **Given** the migration has completed, **When** an operator initiates rollback, **Then** items are restored to their original embedded-string tags using the exported mapping file, with zero data loss.
5. **Given** a migration in progress, **When** an item has an empty tags array, **Then** the item is left unchanged (no tag references added).

---

### User Story 4 — Tag Management UI (Priority: P2)

A user wants a dedicated screen in the web application to manage all their tags: view with item counts, rename, and delete. The item edit form should present a searchable tag picker backed by the Tag entity rather than a free-text input.

**Why this priority**: The UI is the primary means for users to interact with the new tag model, but the backend entities and APIs must exist first.

**Independent Test**: Can be fully tested by navigating to the tag management screen, performing CRUD operations, and verifying changes reflect on items.

**Acceptance Scenarios**:

1. **Given** an authenticated user navigates to the tag management screen, **When** the page loads, **Then** all tags are listed with their display name and item count, sorted alphabetically.
2. **Given** the tag management screen, **When** the user clicks rename on a tag and enters a new name, **Then** the tag is renamed and the list updates.
3. **Given** the item edit form, **When** the user starts typing in the tag picker, **Then** existing tags matching the input are suggested in a dropdown.
4. **Given** the item edit form, **When** the user types a tag name that does not exist, **Then** an option to create a new tag is offered.

---

### Edge Cases

- What happens when a tag is deleted while another user session is editing an item that references it? The item save should gracefully handle the missing tag reference by ignoring invalid tag IDs and returning a warning.
- What happens when the migration encounters an item with a tag string that exceeds the maximum tag length (50 characters)? The migration truncates the tag to 50 characters before normalization and logs a warning with the original value.
- What happens when two concurrent requests attempt to create the same tag (same normalized name) for the same user? The system enforces a unique constraint on (userId, normalizedName) and returns the existing tag to the second request instead of failing.
- How does the system handle items with hundreds of tag references? The system limits the number of tags per item to 50 (matching the current implicit limit) and returns a validation error if exceeded.
- What happens when a user has zero tags and accesses the tag management screen? The screen displays an empty state with guidance on how to create tags.

## Requirements *(mandatory)*

### Functional Requirements

#### Tag Entity

- **FR-001**: System MUST support a Tag as an independent, first-class entity with a unique identifier, display name, normalized name (lowercase), color (optional), owner (user ID), and timestamps (created, updated).
- **FR-002**: System MUST enforce uniqueness of tags per user based on normalized name — no two tags for the same user may share the same normalized name.
- **FR-003**: System MUST support creating a tag with a display name (1–50 characters, trimmed of leading/trailing whitespace).
- **FR-004**: System MUST support renaming a tag, updating both the display name and normalized name, and rejecting the rename if the new normalized name conflicts with an existing tag for the same user.
- **FR-005**: System MUST support deleting a tag, which also removes all references to that tag from the user's items.
- **FR-006**: System MUST support listing all tags for a user, including the count of items referencing each tag.
#### Item–Tag Relationship

- **FR-007**: Items MUST reference tags by their unique identifier (tag ID) rather than by a string name.
- **FR-008**: When creating or updating an item, the system MUST accept two separate fields: `tagIds` (list of existing tag IDs) and `newTagNames` (list of tag name strings for inline creation). The system MUST validate that each tag ID corresponds to an existing Tag entity owned by the requesting user.
- **FR-009**: When retrieving an item, the system MUST expand tag IDs into full tag details (ID, display name) in the response.
- **FR-010**: System MUST support filtering items by tag ID.
- **FR-011**: System MUST limit the number of tag references per item to 50.
- **FR-012**: When creating or updating an item, the system MUST allow inline creation of new tags via the `newTagNames` field. For each name that does not match an existing tag (by normalized name) for the user, the system creates the Tag entity and adds its ID to the item's tag references.

#### Migration

- **FR-013**: System MUST provide a migration process that scans all items with embedded string tags, creates corresponding Tag entities (deduplicated by normalized name per user), and replaces the embedded tags with tag ID references. When multiple case variants exist for the same normalized name, the display name of the first occurrence encountered is used.
- **FR-014**: The migration MUST be idempotent — running it multiple times produces the same result without creating duplicate tags or corrupting data.
- **FR-015**: The migration MUST export a mapping file (embedded tag string → tag ID, per user) and item snapshots before modifying data, enabling rollback.
- **FR-016**: System MUST provide a rollback mechanism that restores items to their original embedded-string tag format using the exported mapping and snapshots.
- **FR-017**: The migration MUST record metrics: total items processed, tags created, duplicates merged, items updated, errors encountered.

#### Data Isolation

- **FR-018**: All tag operations (CRUD, merge, list) MUST be scoped to the authenticated user. A user MUST NOT be able to see, modify, or reference another user's tags.
- **FR-019**: System MUST return 404 (not 403) when a user attempts to access a tag owned by a different user, to avoid leaking tag existence.

#### UI/UX

- **FR-020**: The web application MUST provide a tag management screen listing all tags with display name, item count, and actions (rename, delete).
- **FR-021**: The item edit form MUST provide a searchable tag picker that suggests existing tags and allows inline creation of new tags.
- **FR-022**: Tags on items MUST be displayed as visual chips showing the tag's display name (resolved from the Tag entity).

### Key Entities

- **Tag**: Represents a user-defined label for categorizing items. Key attributes: unique identifier, display name, normalized name (lowercase), color (optional), owner (user ID), created timestamp, updated timestamp. Scoped per user — each user has their own independent set of tags.
- **Item** (modified): Existing entity representing a saved bookmark/URL. Currently stores tags as a list of strings (`tags`). After refactor, stores a list of tag identifiers (`tagIds`) referencing Tag entities. The legacy `tags` field is removed after migration.

## Clarifications

### Session 2026-02-15

- Q: How should the API transition from name-based to ID-based tag endpoints? → A: Replace in place — remove old name-based endpoints, introduce ID-based endpoints under the same `/api/v1/tags` path, deployed alongside the migration. All consumers (web app, browser extension) updated in the same release.
- Q: Should the Tag entity include additional metadata fields (color, description) in this refactor? → A: Include color only. Description deferred to a future feature.
- Q: When deduplicating embedded tags during migration, which display name should the surviving Tag entity use? → A: First occurrence — use the display name from the first item encountered during the migration scan.
- Q: Which adjacent capabilities should be explicitly declared out of scope? → A: All out of scope — global/shared tags, AI/auto-tagging, tag hierarchies, and bulk item re-tagging.
- Q: How should the item create/update API distinguish between existing tag IDs and new tag names for inline creation? → A: Separate fields — `tagIds` (array of existing tag IDs) and `newTagNames` (array of strings for tags to create inline).

## Assumptions

- Tags are user-scoped (each user has their own tag namespace), consistent with the existing per-user data isolation model in the application.
- The migration is a one-time batch process that can run while the application is offline or in a maintenance window. No requirement for live/online migration with zero downtime.
- The maximum tag name length remains 50 characters, consistent with the current validation rules.
- Tag display names are case-preserving (stored as entered) but uniqueness is enforced on the normalized (lowercase) form.
- The tag picker in the UI supports both selecting existing tags and creating new tags inline during item creation/editing.
- The API transition is a single-release replacement: existing name-based tag endpoints (`PATCH /api/v1/tags/{name}`, `DELETE /api/v1/tags/{name}`) are removed and replaced by ID-based endpoints in the same deploy as the migration. No dual-endpoint or versioned transition period.

## Out of Scope

- **Global/shared tags**: Tags are strictly user-scoped. No cross-user tag sharing, global tag library, or organization-level tags.
- **AI/auto-tagging**: Automatic tag suggestions based on item content, URL analysis, or machine learning.
- **Tag hierarchies**: Parent-child tag relationships, nested tag trees, or tag categories.
- **Bulk item re-tagging**: Applying or removing a tag across multiple items in a single batch operation.
- **Tag merge**: Merging two or more tags into a single tag.
- **Tag archive**: Soft-archiving tags to hide them from default views without deletion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All existing items with embedded tags are migrated to tag-ID references with zero data loss — 100% of pre-migration tag associations are preserved.
- **SC-002**: Users can create, rename, and delete tags in under 3 seconds per operation from the management screen.
- **SC-003**: Tag renaming propagates to all associated items — renaming a tag immediately reflects the new name on every item that references it (no stale names).
- **SC-004**: Duplicate tags are eliminated: after migration, no user has two Tag entities with the same normalized name.
- **SC-005**: The tag picker on the item edit form returns matching suggestions within 1 second of the user typing.
- **SC-006**: Rollback from the new tag model to the legacy embedded model can be completed using the exported mapping without data loss.
- **SC-007**: Tag operations maintain complete data isolation — no cross-user tag leakage as verified by automated tests.
