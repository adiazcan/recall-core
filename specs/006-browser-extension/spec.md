# Feature Specification: Chrome/Edge Browser Extension

**Feature Branch**: `006-browser-extension`  
**Created**: January 25, 2026  
**Status**: Draft  
**Input**: User description: "Chrome/Edge extension to save current page or selected tabs + open Side Panel with embedded Recall web app"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save Current Tab Quickly (Priority: P1)

As a user browsing the web, I want to save the current page URL to my Recall inbox with one click, so I can quickly bookmark content without interrupting my browsing flow.

**Why this priority**: This is the core value proposition of the extension—frictionless saving. Users need a fast, one-click way to capture URLs they want to remember.

**Independent Test**: Can be fully tested by clicking the extension icon, pressing "Save current tab", and verifying the item appears in Recall. Delivers immediate value as a standalone bookmark capture tool.

**Acceptance Scenarios**:

1. **Given** the user is on any web page and the extension is installed, **When** the user clicks the extension icon and selects "Save current tab", **Then** the current page URL and title are sent to the API and the user sees a success message.

2. **Given** the user saves a URL that already exists in their Recall account, **When** the API returns that the item already exists, **Then** the user sees a message indicating the page was already saved (dedupe handled gracefully).

3. **Given** the API call fails (network error or 5xx), **When** the save operation completes, **Then** the user sees a clear error message indicating the save failed.

4. **Given** the user is not authenticated, **When** they attempt to save a tab, **Then** the extension prompts them to sign in before proceeding.

---

### User Story 2 - Side Panel with Recall Web App (Priority: P2)

As a user, I want to open a side panel that shows my Recall inbox and collections, so I can browse my saved items without leaving the current tab.

**Why this priority**: The side panel transforms the extension from a simple save tool to a full browsing companion. Users can reference saved content while reading new pages.

**Independent Test**: Can be fully tested by clicking the toolbar action to open the side panel and navigating through Inbox, Collections, and Tags. Delivers value as a persistent reference panel.

**Acceptance Scenarios**:

1. **Given** the extension is installed, **When** the user clicks the toolbar action (extension icon) and clicks the "Open Side Panel" button in the popup, **Then** the side panel opens showing the Recall web app in a responsive layout.

2. **Given** the side panel is open, **When** the user navigates within the Recall app (Inbox → Item Detail → Collections → Tags), **Then** navigation works correctly within the panel.

3. **Given** the user is authenticated in the extension (via popup sign-in), **When** they open the side panel, **Then** the extension shares the access token with the web app and they see their content without additional sign-in.

4. **Given** the side panel is open and the user navigates to a different browser tab, **When** they return to the original tab, **Then** the side panel remains open and preserves its state.

---

### User Story 3 - Save Multiple Selected Tabs (Priority: P3)

As a user with multiple relevant tabs open, I want to select and save several tabs at once, so I can batch-save related content efficiently.

**Why this priority**: Batch saving is a power-user feature that enhances productivity but isn't essential for initial adoption. Single-tab save covers most use cases.

**Independent Test**: Can be fully tested by opening multiple tabs, selecting some via checkboxes in the popup, and verifying all selected URLs are saved. Delivers value as a batch operation tool.

**Acceptance Scenarios**:

1. **Given** the user has multiple tabs open, **When** they click the extension icon and select "Save selected tabs", **Then** they see a list of open tabs with checkboxes to select which to save.

2. **Given** the user has selected 5 tabs to save, **When** they click "Save", **Then** all 5 URLs are saved and the user sees a summary (e.g., "4 saved, 1 already existed").

3. **Given** some tabs fail to save, **When** the batch operation completes, **Then** the user sees which tabs succeeded, which already existed, and which failed.

4. **Given** the user selects tabs, **When** they decide not to save, **Then** they can cancel and return to the main popup without saving.

---

### Edge Cases

- What happens when the user tries to save a browser internal page (chrome://, edge://, about:blank)?
  - Save is skipped with a message: "Cannot save browser internal pages"
- What happens when the tab title is empty or unavailable?
  - Save proceeds with URL only; title field is optional
- What happens when the user's access token expires mid-session?
  - Extension attempts silent token refresh; if it fails, prompts user to re-authenticate
- What happens when the side panel URL (web app) fails to load?
  - Display an error state with retry option and link to open in new tab
- What happens when saving many tabs (e.g., 50+)?
  - Save with limited concurrency (2-3 parallel requests) and show progress indicator

## Requirements *(mandatory)*

### Functional Requirements

#### Extension Core

- **FR-001**: Extension MUST be built with Manifest V3 and support both Chrome and Microsoft Edge (Chromium).
- **FR-002**: Extension MUST request only minimal permissions: `activeTab`, `sidePanel`, `storage`, and `identity`.
- **FR-003**: Extension MUST NOT capture or store page content—only URLs and titles.

#### Save Current Tab

- **FR-004**: Extension MUST provide a "Save current tab" action accessible from the popup UI.
- **FR-005**: Extension MUST retrieve the active tab's URL and title using browser APIs.
- **FR-006**: Extension MUST call `POST /api/v1/items` with the URL and optional title.
- **FR-007**: Extension MUST handle API response codes: 201 (created), 200 (dedupe/existing), 4xx/5xx (error).
- **FR-008**: Extension MUST display success, already-exists, or error feedback to the user.
- **FR-008a**: Extension MUST provide a default keyboard shortcut (Ctrl+Shift+S / Cmd+Shift+S) for quick save, customizable via browser extension shortcut settings.

#### Save Selected Tabs

- **FR-009**: Extension MUST provide a "Save selected tabs" action from the popup UI.
- **FR-010**: Extension MUST display a list of open tabs in the current window with checkboxes for selection.
- **FR-011**: Extension MUST save selected tabs by calling the API for each URL with limited concurrency.
- **FR-012**: Extension MUST show progress during batch save and a summary upon completion.

#### Side Panel

- **FR-013**: Extension MUST use the Chrome/Edge Side Panel API (`chrome.sidePanel`) to display a persistent panel.
- **FR-014**: Side panel MUST load the Recall web app URL in a responsive/embedded mode.
- **FR-015**: Side panel MUST support in-panel navigation (Inbox, Collections, Tags, Item Detail).
- **FR-016**: Toolbar action click MUST open the popup; popup MUST include an "Open Side Panel" button that opens the side panel.

#### Authentication

- **FR-017**: Extension MUST authenticate users via the existing Entra External ID flow.
- **FR-018**: Extension MUST obtain access tokens for scope `api://<API_CLIENT_ID>/access_as_user`.
- **FR-019**: Extension MUST attach `Authorization: Bearer <token>` header to all API requests.
- **FR-020**: Extension MUST use `chrome.identity.launchWebAuthFlow` with PKCE for token acquisition (browser-native flow, no embedded MSAL).
- **FR-021**: Extension MUST NOT store client secrets.
- **FR-022**: Extension MUST handle token expiry with silent refresh; prompt re-auth if refresh fails.
- **FR-023**: Extension MUST share access tokens with the side panel web app via postMessage API to enable single sign-on experience.

#### Configuration

- **FR-024**: Extension MUST support development mode (localhost URLs) and production mode (deployed URLs).
- **FR-025**: Extension MUST provide a centralized configuration module for base URLs, client IDs, and scopes.

### Key Entities

- **Extension Popup**: UI component for save actions and tab selection; ephemeral state.
- **Side Panel**: Persistent panel hosting the Recall web app; managed by browser Side Panel API.
- **Service Worker**: Background script handling API calls, token management, and browser event listeners.
- **Configuration**: Module containing environment-specific URLs, client IDs, and OAuth scopes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can save the current tab in under 3 seconds from clicking the extension icon to seeing confirmation.
- **SC-002**: Users can save 10 selected tabs in under 15 seconds with visible progress feedback.
- **SC-003**: Side panel opens within 2 seconds of clicking the toolbar action.
- **SC-004**: 95% of save operations complete successfully when the API is reachable.
- **SC-005**: Users can navigate through Inbox, Collections, and Tags in the side panel without page reload errors.
- **SC-006**: Authentication works seamlessly—users signed into the extension see their content in the side panel without additional sign-in (single sign-on via token sharing).
- **SC-007**: Extension passes Chrome Web Store review for minimal permissions and privacy compliance.

## Assumptions

- The Recall web app already supports responsive layouts suitable for side panel width of 400px minimum.
- The existing Entra External ID app registration can be configured to allow extension origins/redirects.
- The `POST /api/v1/items` endpoint accepts `{ url, title? }` and handles deduplication by returning 200 for existing items.
- Chrome and Edge both support the `sidePanel` API in their current stable versions (Chrome 114+, Edge 114+).
- Users have the Recall web app accessible (localhost for dev, deployed URL for production).

## Dependencies

- **Recall Web App**: Must be running and accessible for side panel embedding; must accept access tokens via postMessage for SSO.
- **Recall API**: Must support `POST /api/v1/items` with Bearer token authentication.
- **Entra External ID**: App registration must be configured for extension redirect URIs.

## Out of Scope

- Content script that scrapes page body or extracts metadata beyond URL/title
- Offline queueing and retry when API is unreachable
- Cross-browser support (Firefox, Safari)
- Context menu integration for right-click saving
- Omnibox/address bar integration
- Auto-tagging or AI-based categorization
- Advanced selected-tabs UX (cross-window selection, tab groups)

## Clarifications

### Session 2026-01-25

- Q: What happens when user clicks the extension icon—popup or side panel? → A: Click opens popup; separate "Open Side Panel" button in popup opens the side panel
- Q: How does the extension obtain access tokens for Entra External ID? → A: Use chrome.identity.launchWebAuthFlow with PKCE (browser-native, no MSAL in extension)
- Q: Should the extension provide a keyboard shortcut for quick save? → A: Default shortcut (Ctrl+Shift+S / Cmd+Shift+S) customizable via browser settings
- Q: What is the minimum supported side panel width? → A: 400px minimum (Chrome default, tablet-like responsive breakpoint)
- Q: How is authentication shared between extension popup and side panel web app? → A: Shared tokens via postMessage; extension passes its token to the side panel web app
