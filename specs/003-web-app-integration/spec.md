# Feature Specification: Web App Integration

**Feature Branch**: `003-web-app-integration`  
**Created**: January 22, 2026  
**Status**: Draft  
**Input**: User description: "Turn the Figma-generated React UI into a functional web application connected to the existing backend, implementing the full user flow for items, tags, and collections management"

## Overview

This feature transforms the static Figma-generated React UI prototype (`/design`) into a fully functional web application connected to the backend APIs implemented in feature 002. The goal is to deliver a working end-to-end user experience for saving, organizing, and managing URLs with tags and collections.

### Integration Strategy Decision

The implementation should adopt **Option A**: Move `/design` into `/src/web` and make it the primary web app. This approach:
- Preserves the complete Figma design system and UI components
- Leverages the existing shadcn/ui component library already in `/design`
- Minimizes duplication and ensures design fidelity
- Provides a rich set of pre-built accessible UI primitives

### Out of Scope

- Authentication / multi-user support
- Ingestion/enrichment (OpenGraph fetching, favicon, readability parsing)
- Full-text search / semantic search (q parameter)
- Offline/PWA capabilities
- Browser extension
- Notes/highlights features
- Advanced drag-and-drop organization

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a URL for Later (Priority: P1)

A user discovers interesting content online and wants to save the URL quickly using the web app. The user clicks "Save URL", enters the URL in the input field, and the system validates, deduplicates, and persists the item, showing immediate feedback.

**Why this priority**: This is the core value proposition—the ability to save content. Without functional save capability, the app has no utility.

**Independent Test**: Can be fully tested by opening the app, clicking "Save URL", entering a valid URL, and verifying the item appears in the list with correct data from the API.

**Acceptance Scenarios**:

1. **Given** the user is on the Inbox view, **When** they click "Save URL" and enter a valid http/https URL, **Then** the URL is saved via API, the item appears at the top of the list, and a success toast is shown
2. **Given** a URL already exists in the system, **When** the user saves the same URL again, **Then** the existing item is returned with status 200, a "duplicate" toast notification is shown, and no duplicate appears in the list
3. **Given** the user enters an invalid URL, **When** they submit, **Then** the input shows validation error styling, an inline error message appears, and no API call is made
4. **Given** the API is unreachable or returns an error, **When** the user tries to save, **Then** an error toast is displayed with a user-friendly message and option to retry

---

### User Story 2 - Browse and Filter Saved Items (Priority: P1)

A user wants to view their saved items, filtering by status (inbox/archived), favorites, collection, or tag. The list must load efficiently with proper loading states and pagination.

**Why this priority**: Viewing saved items is essential—users need to access their content. Equally critical as saving.

**Independent Test**: Can be fully tested by loading the app, verifying items appear from the API, and clicking sidebar filters to confirm correct filtering behavior.

**Acceptance Scenarios**:

1. **Given** the user opens the app, **When** the Inbox view loads, **Then** a loading skeleton is shown, then items are fetched from GET /api/v1/items?status=unread and displayed sorted by most recent
2. **Given** items exist in the system, **When** the user clicks "Favorites" in the sidebar, **Then** only favorited items are displayed (API filter: isFavorite=true)
3. **Given** items exist, **When** the user clicks "Archive" in the sidebar, **Then** only archived items are displayed (API filter: status=archived)
4. **Given** collections exist, **When** the user clicks a collection in the sidebar, **Then** only items in that collection are displayed (API filter: collectionId=X)
5. **Given** tags exist, **When** the user clicks a tag in the sidebar, **Then** only items with that tag are displayed (API filter: tag=X)
6. **Given** no items match the current filter, **When** the view loads, **Then** an appropriate empty state is displayed with helpful messaging
7. **Given** more items than the page size exist, **When** the user scrolls to the bottom, **Then** the next page is loaded via cursor-based pagination

---

### User Story 3 - View Item Details (Priority: P1)

A user wants to view the full details of a saved item including title, URL, tags, collection, and metadata. Clicking an item opens a detail panel.

**Why this priority**: Detail view is critical for users to interact with individual items and perform actions.

**Independent Test**: Can be tested by clicking an item in the list and verifying the detail panel shows correct data from the API.

**Acceptance Scenarios**:

1. **Given** items are displayed in the list, **When** the user clicks on an item row, **Then** the detail panel slides in from the right showing item title, URL, collection, tags, and creation date
2. **Given** the detail panel is open, **When** the user clicks the external link icon, **Then** the original URL opens in a new browser tab
3. **Given** the detail panel is open, **When** the user clicks the close button or clicks outside on mobile, **Then** the panel closes smoothly

---

### User Story 4 - Quick Actions: Favorite and Archive (Priority: P2)

A user wants to quickly mark items as favorites or archive them without opening the full detail view, using inline action buttons.

**Why this priority**: Quick organization actions are essential for efficient workflow but secondary to core viewing.

**Independent Test**: Can be tested by hovering an item row, clicking favorite/archive buttons, and verifying API calls and UI updates.

**Acceptance Scenarios**:

1. **Given** an item is displayed, **When** the user clicks the favorite (star) icon, **Then** PATCH /api/v1/items/{id} is called with isFavorite=true, the star icon fills in immediately (optimistic), and the update persists
2. **Given** a favorited item is displayed, **When** the user clicks the filled star icon, **Then** the item is unfavorited via PATCH with isFavorite=false
3. **Given** an item in Inbox, **When** the user clicks the archive icon, **Then** PATCH /api/v1/items/{id} is called with status=archived, the item animates out of the list (optimistic)
4. **Given** an archived item, **When** the user clicks unarchive, **Then** PATCH with status=unread is called and item moves to Inbox
5. **Given** an optimistic update fails, **When** the API returns an error, **Then** the UI reverts to the previous state and shows an error toast

---

### User Story 5 - Delete an Item (Priority: P2)

A user wants to permanently remove a saved item they no longer need.

**Why this priority**: Necessary for housekeeping but less frequent than other operations.

**Independent Test**: Can be tested by clicking delete on an item in the detail view and verifying the item is removed.

**Acceptance Scenarios**:

1. **Given** the detail panel is open, **When** the user clicks the delete button, **Then** a confirmation dialog appears asking to confirm deletion
2. **Given** the confirmation dialog is shown, **When** the user confirms, **Then** DELETE /api/v1/items/{id} is called, the item is removed from the list, the detail panel closes, and a success toast appears
3. **Given** the confirmation dialog is shown, **When** the user cancels, **Then** the dialog closes and no action is taken

---

### User Story 6 - Edit Item Metadata (Priority: P2)

A user wants to update an item's title, change its collection assignment, or modify its tags from the detail panel.

**Why this priority**: Enables organization refinement after initial save.

**Independent Test**: Can be tested by opening item detail, modifying fields, and verifying PATCH calls update the backend.

**Acceptance Scenarios**:

1. **Given** the detail panel is open, **When** the user clicks on the collection dropdown and selects a different collection, **Then** PATCH /api/v1/items/{id} is called with the new collectionId and the change is reflected
2. **Given** the detail panel shows tags, **When** the user clicks "+ Add" tag and selects/enters a tag, **Then** PATCH with updated tags array is called
3. **Given** an item has tags, **When** the user removes a tag, **Then** PATCH with the modified tags array is called

---

### User Story 7 - View and Navigate Collections (Priority: P2)

A user wants to see all their collections in the sidebar with item counts, and navigate to collection-filtered views.

**Why this priority**: Collections provide folder-like organization which is intuitive for hierarchical organization.

**Independent Test**: Can be tested by verifying collections load in sidebar with counts from API and clicking navigates correctly.

**Acceptance Scenarios**:

1. **Given** the app loads, **When** the sidebar renders, **Then** collections are fetched from GET /api/v1/collections and displayed with their item counts
2. **Given** collections are displayed, **When** the user clicks a collection name, **Then** the main view filters to show only items in that collection
3. **Given** the collections section, **When** the user clicks the "+" button to add collection, **Then** a dialog/modal appears to create a new collection (name input)
4. **Given** the create collection dialog, **When** the user enters a name and submits, **Then** POST /api/v1/collections is called and the new collection appears in the sidebar

---

### User Story 8 - View and Navigate Tags (Priority: P2)

A user wants to see all tags used across items with their counts, and filter items by clicking a tag.

**Why this priority**: Tags provide the primary cross-cutting organizational mechanism.

**Independent Test**: Can be tested by verifying tags load in sidebar from API and clicking filters the item list.

**Acceptance Scenarios**:

1. **Given** the app loads, **When** the sidebar renders, **Then** tags are fetched from GET /api/v1/tags and displayed with item counts
2. **Given** tags are displayed, **When** the user clicks a tag name, **Then** the main view filters to show only items with that tag

---

### Edge Cases

- What happens when the API is slow to respond? Loading skeletons are shown for initial load; inline spinners for actions
- What happens when pagination cursor becomes invalid (data changed)? Refetch from the beginning with user notification
- How does the app handle concurrent edits? Last-write-wins with refetch on focus
- What happens when a collection is deleted while viewing it? Redirect to Inbox with notification (Note: Collection delete UI is out of scope for this feature; this handles backend-initiated deletes only)
- How does the UI handle very long titles or URLs? Text truncation with ellipsis and full text on hover/in detail view

## Requirements *(mandatory)*

### Functional Requirements

#### Integration & Architecture

- **FR-001**: System MUST integrate the Figma-generated UI from `/design` into `/src/web` as the primary web application
- **FR-002**: System MUST use environment variable (VITE_API_BASE_URL) for Vite proxy target with fallback to http://localhost:5080; frontend code uses relative `/api` paths
- **FR-003**: System MUST implement a typed API client layer with request/response interfaces matching backend contracts
- **FR-004**: System MUST implement React Router for client-side navigation with routes for main views

#### State Management

- **FR-005**: System MUST use Zustand for global state management with feature-scoped slices (items, collections, tags, UI state)
- **FR-006**: System MUST replace mock data with real API calls while maintaining context interface compatibility
- **FR-007**: System MUST implement optimistic updates for favorite and archive toggles with rollback on failure

#### UI Feedback

- **FR-008**: System MUST show loading skeletons when fetching item lists
- **FR-009**: System MUST display appropriate empty states when no items match current filters
- **FR-010**: System MUST show toast notifications for success/error feedback on user actions
- **FR-011**: System MUST display inline validation errors for form inputs (URL save)
- **FR-012**: System MUST show loading indicators during API mutations (save, update, delete)

#### API Integration

- **FR-013**: System MUST call POST /api/v1/items to save new URLs
- **FR-014**: System MUST handle duplicate URL detection (200 response) with appropriate user feedback
- **FR-015**: System MUST call GET /api/v1/items with filter parameters (status, collectionId, tag, isFavorite)
- **FR-016**: System MUST implement cursor-based pagination for item lists with default page size of 20 items
- **FR-017**: System MUST call PATCH /api/v1/items/{id} for item updates (favorite, archive, collection, tags)
- **FR-018**: System MUST call DELETE /api/v1/items/{id} for item removal with confirmation
- **FR-019**: System MUST call GET /api/v1/collections to populate sidebar
- **FR-020**: System MUST call POST /api/v1/collections to create new collections
- **FR-021**: System MUST call GET /api/v1/tags to populate sidebar with tag counts

#### Accessibility

- **FR-022**: System MUST support keyboard navigation for all interactive elements
- **FR-023**: System MUST implement proper focus management for modals/dialogs
- **FR-024**: System MUST include ARIA labels for icon-only buttons and dialogs

#### Error Handling

- **FR-025**: System MUST map API error responses to user-friendly messages
- **FR-026**: System MUST handle network failures gracefully with retry options

### Key Entities

- **Item (Frontend)**: Mapped from backend ItemDto. Key attributes: id, url, title, excerpt, status, isFavorite, collectionId, tags (string array), createdAt, updatedAt. Computed: domain (extracted from URL for display)
- **Collection (Frontend)**: Mapped from backend CollectionDto. Key attributes: id, name, description, parentId, itemCount
- **Tag (Frontend)**: Mapped from backend TagDto. Key attributes: name, count. Note: Frontend may add display properties like color for visual distinction
- **ViewState**: Client-only state tracking current view type (inbox/favorites/archive/collection/tag), selected filter IDs, and view title

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can save a URL and see it appear in the list within 2 seconds
- **SC-002**: Initial page load displays content (or appropriate empty state) within 3 seconds on standard broadband
- **SC-003**: All 8 user story acceptance scenarios pass in manual end-to-end testing
- **SC-004**: Duplicate URL save shows appropriate feedback without creating duplicates
- **SC-005**: Filter switches (inbox/favorites/archive/collection/tag) update the view within 1 second
- **SC-006**: Optimistic updates for favorite/archive feel instant with proper rollback on failure
- **SC-007**: Empty states are displayed for all views when no items match (not blank screens)
- **SC-008**: Application builds without errors and runs locally with documented setup steps
- **SC-009**: All interactive elements are keyboard accessible with visible focus indicators
