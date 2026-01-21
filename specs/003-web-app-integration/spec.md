# Feature Specification: Web App Integration

**Feature Branch**: `003-web-app-integration`  
**Created**: January 21, 2026  
**Status**: Draft  
**Input**: User description: "Turn the Figma-generated React UI into a functional web application connected to the existing backend, implementing the full user flow for the user stories with a minimal but solid front-end architecture."

## Overview

This feature integrates a Figma-generated React UI with the existing backend APIs to create a fully functional web application for managing saved URLs (items), tags, and collections. The focus is on establishing a clean front-end architecture, connecting all UI flows to the backend, and ensuring proper feedback states for loading, errors, and empty states.

### Out of Scope

- Authentication/multi-user support
- Ingestion/enrichment (OpenGraph, favicon fetching, readability parsing)
- Full-text search / semantic search
- Offline/PWA functionality
- Browser extension
- Notes/highlights

### Assumptions

- The backend APIs as specified in `specs/002-items-tags-collections-api` are fully implemented and functional
- The Figma-generated React code in `/design` represents the target UI design
- The existing `/src/web` structure will serve as the primary web application location
- Standard session-based interaction with the API (no authentication in this iteration)
- Backend URL will be configurable via environment variable (not hardcoded)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View and Browse Saved Items (Priority: P1)

A user opens the web application and sees their saved items in a list view. They can navigate between different views (Inbox, Favorites, Archive) using the sidebar. The list displays items sorted by most recent first with essential metadata (title, URL/domain, tags).

**Why this priority**: This is the core read functionality - users need to see their saved content before they can manage it.

**Independent Test**: Can be fully tested by launching the app, verifying items load from the backend, and confirming sidebar navigation filters items correctly.

**Acceptance Scenarios**:

1. **Given** the app loads, **When** the user lands on the home page, **Then** they see the Inbox view with all non-archived items
2. **Given** items exist in the backend, **When** the list loads, **Then** items appear sorted by creation date (newest first) with title, domain, and tags visible
3. **Given** items are loading, **When** the request is in progress, **Then** a loading skeleton or spinner is displayed
4. **Given** no items exist, **When** the list renders, **Then** a meaningful empty state is shown with guidance
5. **Given** a backend error occurs, **When** fetching items fails, **Then** an error message is displayed to the user

---

### User Story 2 - Save a New URL (Priority: P1)

A user wants to save a new URL for later reading. They click the "Save URL" button, enter a URL in the input, and submit. The system saves the URL to the backend and shows it in the list. If the URL was already saved, the existing item is shown (duplicate handling).

**Why this priority**: Saving URLs is the core write functionality and primary value proposition.

**Independent Test**: Can be fully tested by clicking "Save URL", entering a valid URL, submitting, and verifying the item appears in the list.

**Acceptance Scenarios**:

1. **Given** the user is viewing items, **When** they click "Save URL", **Then** an input form appears to enter the URL
2. **Given** the form is visible, **When** user enters a valid HTTP/HTTPS URL and submits, **Then** the URL is saved and appears in the item list
3. **Given** a URL is being saved, **When** the save request is processing, **Then** the form shows a loading state and prevents duplicate submission
4. **Given** a duplicate URL is entered, **When** user submits, **Then** the existing item is highlighted or shown without creating a duplicate
5. **Given** an invalid URL is entered, **When** user submits, **Then** an error message indicates the URL is invalid
6. **Given** the save operation fails, **When** a backend error occurs, **Then** an error toast/message is displayed

---

### User Story 3 - Filter Items by Collection or Tag (Priority: P1)

A user wants to view only items that belong to a specific collection or have a specific tag. They click on a collection or tag in the sidebar and the list filters to show only matching items.

**Why this priority**: Filtering enables users to organize and find content, which is essential for the application's value.

**Independent Test**: Can be fully tested by creating items with different collections/tags, clicking sidebar filters, and verifying only matching items appear.

**Acceptance Scenarios**:

1. **Given** collections exist with items, **When** user clicks a collection in the sidebar, **Then** only items in that collection are displayed
2. **Given** tags exist on items, **When** user clicks a tag in the sidebar, **Then** only items with that tag are displayed
3. **Given** a filter is active, **When** the filtered view has no items, **Then** an appropriate empty state is shown for that filter
4. **Given** a filter is applied, **When** user clicks "Inbox", **Then** the filter is cleared and all non-archived items are shown

---

### User Story 4 - View Item Details (Priority: P2)

A user wants to see the full details of a saved item. They click on an item in the list and a detail panel slides in showing the title, URL, collection, tags, and creation date. They can open the original URL in a new tab.

**Why this priority**: Detail view provides full context for an item, important for decision-making and actions.

**Independent Test**: Can be fully tested by clicking an item in the list, verifying the detail panel opens with correct data, and confirming the external link works.

**Acceptance Scenarios**:

1. **Given** items exist in the list, **When** user clicks an item, **Then** a detail panel opens showing full item information
2. **Given** the detail panel is open, **When** user clicks the external link icon, **Then** the original URL opens in a new browser tab
3. **Given** the detail panel is open, **When** user clicks the close button, **Then** the panel closes and returns to the list view
4. **Given** the item is loading, **When** detail data is being fetched, **Then** a loading state is shown in the detail panel

---

### User Story 5 - Mark Item as Favorite/Archive (Priority: P2)

A user wants to mark an item as favorite or move it to archive. From the item detail panel, they can toggle favorite status or archive/unarchive the item. Changes persist to the backend.

**Why this priority**: Quick actions enable efficient organization and are frequently used features.

**Independent Test**: Can be fully tested by opening an item detail, clicking favorite/archive buttons, and verifying the state persists after page reload.

**Acceptance Scenarios**:

1. **Given** an item detail is open, **When** user clicks the favorite button, **Then** the item's favorite status toggles and updates visually
2. **Given** the favorite is toggled, **When** viewing Favorites filter, **Then** only favorited items appear
3. **Given** an item detail is open, **When** user clicks the archive button, **Then** the item moves to Archive and disappears from Inbox
4. **Given** an item is in Archive, **When** user unarchives it, **Then** the item returns to Inbox
5. **Given** a toggle operation is in progress, **When** the user waits, **Then** the UI updates optimistically and handles failures gracefully

---

### User Story 6 - Delete an Item (Priority: P2)

A user wants to permanently delete a saved item. From the item detail panel, they click the delete button, confirm the action, and the item is permanently removed.

**Why this priority**: Users need the ability to clean up and remove unwanted items.

**Independent Test**: Can be fully tested by opening an item detail, clicking delete, confirming, and verifying the item no longer appears in any list.

**Acceptance Scenarios**:

1. **Given** an item detail is open, **When** user clicks the delete button, **Then** a confirmation prompt appears
2. **Given** the confirmation is shown, **When** user confirms deletion, **Then** the item is permanently removed from the backend
3. **Given** deletion succeeds, **When** returning to the list, **Then** the item no longer appears
4. **Given** deletion fails, **When** a backend error occurs, **Then** an error message is displayed and the item remains

---

### User Story 7 - Edit Item Tags (Priority: P3)

A user wants to add or remove tags from a saved item. From the item detail panel, they can add a new tag or remove an existing one. Changes persist to the backend.

**Why this priority**: Tag management enables flexible organization but is used less frequently than viewing/saving.

**Independent Test**: Can be fully tested by opening an item detail, adding/removing tags, and verifying changes persist after reload.

**Acceptance Scenarios**:

1. **Given** an item detail is open, **When** user clicks "+ Add" on tags, **Then** an input appears to enter a new tag
2. **Given** a tag input is shown, **When** user enters a tag name and confirms, **Then** the tag is added to the item and persisted
3. **Given** an item has tags, **When** user removes a tag, **Then** the tag is removed from the item and persisted
4. **Given** a tag operation is in progress, **When** the update completes, **Then** the tag list refreshes to show current state

---

### User Story 8 - Manage Collections (Priority: P3)

A user wants to create, view, or manage collections. They can see existing collections in the sidebar with item counts, create a new collection, and assign items to collections.

**Why this priority**: Collection management provides folder-like organization but is secondary to item management.

**Independent Test**: Can be fully tested by creating a collection, assigning an item to it, and verifying the collection appears with correct count.

**Acceptance Scenarios**:

1. **Given** collections exist, **When** viewing the sidebar, **Then** each collection shows its name and item count
2. **Given** the user wants a new collection, **When** they click the "+" button in Collections, **Then** an input appears to create a new collection
3. **Given** a new collection name is entered, **When** user submits, **Then** the collection is created and appears in the sidebar
4. **Given** an item detail is open, **When** user assigns the item to a collection, **Then** the item's collection is updated and persisted

---

### Edge Cases

- What happens when the backend is unreachable? The app shows a connection error and prompts user to retry
- What happens when saving a URL that redirects? The provided URL is stored as-is (per backend behavior)
- What happens when viewing a deleted item's cached detail? The app handles 404 gracefully and returns to list
- What happens when the item list has more items than one page? Pagination loads more items on scroll or via "Load More"
- What happens when two users edit the same item? Single-user scope; no conflict handling needed this iteration
- What happens on slow network? Loading states are shown; no data is lost on timeout

## Requirements *(mandatory)*

### Functional Requirements

#### Integration & Architecture

- **FR-001**: Web app MUST integrate Figma-generated React components into `/src/web`
- **FR-002**: Web app MUST build and run using the existing repository toolchain (Vite, npm)
- **FR-003**: Web app MUST use environment variable or proxy for backend URL (no hardcoding)
- **FR-004**: Web app MUST implement client-side routing for different views (Inbox, Favorites, Archive, Collection, Tag)

#### API Client Layer

- **FR-005**: Web app MUST implement a typed API client layer for backend communication
- **FR-006**: Web app MUST handle API errors consistently and map to user-friendly messages
- **FR-007**: Web app MUST implement cursor-based pagination for item lists

#### State Management

- **FR-008**: Web app MUST maintain client-side state for current view, selected item, and filters
- **FR-009**: Web app MUST support optimistic updates for favorite/archive toggles with rollback on failure
- **FR-010**: Web app MUST refresh data from backend when optimistic updates are unsafe (item creation, deletion)

#### UI Feedback States

- **FR-011**: Web app MUST show loading skeletons or spinners during data fetching
- **FR-012**: Web app MUST display empty states when no items/tags/collections exist for current filter
- **FR-013**: Web app MUST display toast or inline error messages when operations fail
- **FR-014**: Web app MUST disable form submission while requests are in progress to prevent duplicates

#### Items

- **FR-015**: Web app MUST display items with title, domain, tags, and favorite indicator
- **FR-016**: Web app MUST support saving new URLs via the "Save URL" form
- **FR-017**: Web app MUST handle duplicate URL detection (show existing item, no error)
- **FR-018**: Web app MUST support viewing item details in a slide-out panel
- **FR-019**: Web app MUST support toggling favorite status from detail panel
- **FR-020**: Web app MUST support archiving/unarchiving items from detail panel
- **FR-021**: Web app MUST support permanent deletion with confirmation

#### Tags

- **FR-022**: Web app MUST display tags in sidebar with ability to filter by tag
- **FR-023**: Web app MUST support adding tags to items from detail panel
- **FR-024**: Web app MUST support removing tags from items

#### Collections

- **FR-025**: Web app MUST display collections in sidebar with item counts
- **FR-026**: Web app MUST support creating new collections
- **FR-027**: Web app MUST support filtering items by collection
- **FR-028**: Web app MUST support assigning items to collections from detail panel

#### Accessibility

- **FR-029**: Web app MUST support keyboard navigation for primary interactions
- **FR-030**: Web app MUST maintain visible focus states for interactive elements
- **FR-031**: Web app MUST use ARIA attributes for dialogs and modal panels

### Key Entities

- **Item**: A saved URL with title, domain, tags, collection assignment, favorite status, and archive status. Displayed in list and detail views.
- **Collection**: A folder-like container for organizing items. Displayed in sidebar with item count. Can be created by users.
- **Tag**: A text label attached to items. Displayed on items and in sidebar. Can be added/removed from items.
- **ViewState**: The current filter/view selection (Inbox, Favorites, Archive, Collection, Tag). Controls which items are displayed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can save a new URL and see it appear in the list within 3 seconds
- **SC-002**: Users can navigate between Inbox, Favorites, Archive, Collections, and Tags without page reload
- **SC-003**: All primary user flows (save, view, filter, favorite, archive, delete) work end-to-end against the live backend
- **SC-004**: Loading states appear within 100ms of initiating any network request
- **SC-005**: Empty states are displayed (not blank screens) when no items match the current filter
- **SC-006**: Error messages are displayed when any backend operation fails
- **SC-007**: The application builds and starts without errors using `npm install && npm run dev`
- **SC-008**: Users can complete the save-URL-and-view-it flow on first attempt without confusion
- **SC-009**: Item list pagination loads additional items correctly for lists over 20 items
- **SC-010**: Keyboard users can navigate sidebar, open items, and close detail panel using Tab and Enter
