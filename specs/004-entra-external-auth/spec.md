# Feature Specification: Microsoft Entra External ID Authentication

**Feature Branch**: `004-entra-external-auth`  
**Created**: January 24, 2026  
**Status**: Draft  
**Input**: User description: "Microsoft Entra External ID (Customers) with social-login-only registration + secure Minimal API with scopes"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - New User Signs Up with Social Login (Priority: P1)

A new customer visits the application for the first time and creates an account using their Microsoft Account. They are redirected to the External ID sign-up flow, authenticate with their social provider, and are immediately able to access the application with their new identity.

**Why this priority**: This is the foundational user journey that enables all other functionality. Without sign-up, no user can access the system.

**Independent Test**: Can be fully tested by navigating to the app, clicking "Sign In", completing the Microsoft Account sign-up flow, and verifying the user lands on a protected page showing their identity.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user on the landing page, **When** they click "Sign In" and complete Microsoft Account authentication, **Then** they are signed up, authenticated, and redirected to the app with their display name visible.
2. **Given** an unauthenticated user, **When** they attempt to access a protected route directly, **Then** they are redirected to sign in and returned to their intended destination after authentication.
3. **Given** a user on the sign-in page, **When** they complete the social login flow, **Then** no local username/password option is presented (social-only).

---

### User Story 2 - Returning User Signs In (Priority: P1)

An existing customer returns to the application and signs in using their previously registered social identity. They are authenticated quickly and see their existing data.

**Why this priority**: Core authentication flow; users must be able to return to the app without re-registering.

**Independent Test**: After initial sign-up, sign out, then sign in again and verify the same user identity is recognized.

**Acceptance Scenarios**:

1. **Given** a returning user who previously signed up, **When** they sign in with the same Microsoft Account, **Then** they are authenticated and see their previously created items.
2. **Given** an authenticated session that has expired, **When** the user attempts an action, **Then** they are prompted to re-authenticate seamlessly.

---

### User Story 3 - API Calls Require Valid Token (Priority: P1)

The API must reject requests without a valid access token, ensuring only authenticated users can access data.

**Why this priority**: Security foundation; all API access must be gated by authentication to protect user data.

**Independent Test**: Make direct API calls without a token and verify 401 responses; make calls with an invalid token and verify rejection.

**Acceptance Scenarios**:

1. **Given** an API request without an Authorization header, **When** the request reaches any protected endpoint, **Then** a 401 Unauthorized response is returned.
2. **Given** an API request with an expired or malformed token, **When** the request reaches any protected endpoint, **Then** a 401 Unauthorized response is returned.
3. **Given** an API request with a valid token but missing the required scope, **When** the request reaches a scope-protected endpoint, **Then** a 403 Forbidden response is returned.

---

### User Story 4 - User Views Their Own Identity (Priority: P2)

An authenticated user can call a "me" endpoint to retrieve their own identity information, confirming their authenticated state and identity attributes.

**Why this priority**: Enables the frontend to display user information and helps with debugging authentication issues.

**Independent Test**: Sign in, call GET /api/v1/me, and verify the response contains the user's subject identifier, display name, and email.

**Acceptance Scenarios**:

1. **Given** an authenticated user with a valid access token, **When** they call GET /api/v1/me, **Then** they receive their subject identifier, display name, and email (if present).
2. **Given** the me endpoint response, **When** inspecting the payload, **Then** no sensitive claims (refresh tokens, secrets) are exposed.

---

### User Story 5 - User Data Isolation (Priority: P1)

Each user's items, tags, and collections are isolated from other users. A user can only see, create, update, and delete their own data.

**Why this priority**: Critical security and privacy requirement; data leakage between users would be a fundamental breach.

**Independent Test**: Create items as User A, sign in as User B, and verify User B cannot see User A's items. Attempt to update/delete User A's items as User B and verify failure.

**Acceptance Scenarios**:

1. **Given** User A creates an item, **When** User B lists items, **Then** User A's item is not visible to User B.
2. **Given** User A creates a collection, **When** User B attempts to access it by ID, **Then** a 404 Not Found is returned (not 403, to avoid leaking existence).
3. **Given** User A creates a tag, **When** User B lists tags, **Then** User A's tag is not visible.
4. **Given** User A's item ID is known, **When** User B attempts to update or delete it, **Then** a 404 Not Found is returned.

---

### User Story 6 - User Signs Out (Priority: P2)

An authenticated user can sign out of the application, clearing their session and being returned to an unauthenticated state.

**Why this priority**: Standard user expectation; users must be able to end their session.

**Independent Test**: Sign in, click "Sign Out", and verify the user is logged out and cannot access protected routes.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they click "Sign Out", **Then** their session is cleared and they see the landing/sign-in page.
2. **Given** a signed-out user, **When** they attempt to access a protected route, **Then** they are redirected to sign in.

---

### User Story 7 - Frontend Handles Auth Errors Gracefully (Priority: P2)

When API calls fail due to authentication or authorization issues, the frontend displays appropriate messages and guides the user.

**Why this priority**: User experience; clear error handling prevents confusion and supports troubleshooting.

**Independent Test**: Simulate a 401 response and verify the user is prompted to sign in; simulate a 403 and verify a permission message is shown.

**Acceptance Scenarios**:

1. **Given** an API call that returns 401, **When** the frontend processes the response, **Then** the user is prompted to sign in again.
2. **Given** an API call that returns 403, **When** the frontend processes the response, **Then** a message indicating missing permissions or consent is displayed.

---

### Edge Cases

- What happens when a user's social account is deleted or disabled at the provider level?
  - User cannot sign in; they see an error from the identity provider.
- How does the system handle clock skew causing token validation failures?
  - Standard JWT libraries allow configurable clock tolerance; API should use reasonable tolerance (5 minutes default).
- What happens if the External ID tenant or user flow is misconfigured?
  - Users see an error page from External ID; the app should document common misconfigurations.
- What happens when a user tries to create data before completing authentication?
  - All protected routes redirect to sign-in; API rejects with 401.

## Requirements *(mandatory)*

### Functional Requirements

#### Authentication & Identity

- **FR-001**: System MUST use Microsoft Entra External ID (external tenant, Customers configuration) for user authentication.
- **FR-002**: System MUST use a combined "Sign-up and sign-in" user flow for customer authentication.
- **FR-003**: User flow MUST support ONLY social identity providers (no local accounts, no email/password method).
- **FR-004**: User flow MUST support Microsoft Account as a social identity provider at minimum.
- **FR-004a**: Refresh token lifetime SHOULD be configured for 7 days to maximize user convenience.
- **FR-005**: Additional social providers (Google, Facebook, etc.) MAY be added in future iterations but are not required.

#### App Registrations

- **FR-006**: Web API app registration MUST be created in the external tenant with Application ID URI format: `api://<API_CLIENT_ID>`.
- **FR-007**: Web API app registration MUST expose a delegated scope named `access_as_user`.
- **FR-008**: SPA app registration MUST be created in the external tenant with SPA platform enabled.
- **FR-009**: SPA app registration MUST configure redirect URI for local development: `http://localhost:5173`.
- **FR-010**: SPA app registration MUST request API permission for the `access_as_user` delegated scope.

#### API Protection

- **FR-011**: API MUST validate JWT Bearer tokens using Microsoft identity platform settings for the external tenant.
- **FR-012**: API MUST reject requests without a valid access token with 401 Unauthorized.
- **FR-013**: API MUST enforce the `access_as_user` scope (via `scp` claim) on all protected endpoints.
- **FR-014**: API MUST return 403 Forbidden when a valid token is present but the required scope is missing.
- **FR-014a**: API MUST log authentication failures (401/403 responses) and sign-in/sign-out events for security monitoring.
- **FR-015**: API MUST expose a GET /api/v1/me endpoint returning the authenticated user's safe identity subset: subject identifier, display name, email/username (if present), tenant ID.

#### Data Isolation

- **FR-016**: Items entity MUST include a `userId` field (string) to store the owning user's identifier.
- **FR-017**: Collections entity MUST include a `userId` field (string) to store the owning user's identifier.
- **FR-018**: Tags entity MUST include a `userId` field (string) to store the owning user's identifier.
- **FR-019**: The `userId` MUST be derived from a stable token claim; the `sub` (subject) claim is the preferred source.
- **FR-020**: All read operations MUST filter results by the authenticated user's `userId`.
- **FR-021**: All create operations MUST assign the authenticated user's `userId` to new records.
- **FR-022**: All update and delete operations MUST verify ownership by `userId`; if the resource does not exist under that user, return 404 Not Found (not 403).
- **FR-022a**: Pre-existing records without a `userId` MUST be treated as orphaned and inaccessible to all users until manually migrated or deleted.

#### Frontend Authentication

- **FR-023**: SPA MUST use MSAL for React to handle authentication.
- **FR-024**: SPA MUST use the External ID authority corresponding to the customer tenant and user flow for sign-in.
- **FR-025**: SPA MUST acquire access tokens for the API scope: `api://<API_CLIENT_ID>/access_as_user`.
- **FR-026**: SPA MUST attach `Authorization: Bearer <token>` header to all /api/v1 API calls.
- **FR-027**: SPA MUST protect routes (inbox, details, tags, collections) to require authentication.
- **FR-028**: SPA MUST display authenticated user's name/email in the UI.
- **FR-029**: SPA MUST provide Sign In and Sign Out functionality.
- **FR-030**: SPA MUST handle 401 responses by prompting the user to sign in.
- **FR-031**: SPA MUST handle 403 responses by displaying a missing permission/consent message.
- **FR-031a**: SPA MUST perform silent token refresh in background; user interaction required only when refresh token expires.

#### Developer Experience

- **FR-032**: No secrets (client secrets, provider credentials) MUST be committed to source control.
- **FR-033**: Documentation MUST be provided at `/docs/auth/external-id-setup.md` covering: external tenant creation, user flow configuration, social provider setup, app registrations, and scope configuration.
- **FR-034**: Documentation MUST be provided at `/docs/auth/troubleshooting.md` covering: redirect URI mismatch, invalid audience, missing scp, wrong authority, and consent issues.
- **FR-035**: Frontend configuration MUST support `.env.local` for MSAL settings (tenant ID, client ID, authority, API scope).
- **FR-036**: Backend configuration MUST support user-secrets or environment variables for Azure AD settings (tenant ID, client ID, instance/authority, audience).
- **FR-036a**: Automated tests MUST be able to bypass authentication via test-only configuration; this bypass MUST NOT be available in production environments.

### Key Entities

- **User Identity**: Represents the authenticated user; identified by the `sub` claim from the token. Key attributes: subject identifier (sub), display name, email (optional), tenant ID.
- **Item**: A user-owned content item; extended with `userId` to scope ownership.
- **Collection**: A user-owned grouping of items; extended with `userId` to scope ownership.
- **Tag**: A user-owned label; extended with `userId` to scope ownership.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can complete sign-up via social login (Microsoft Account) in under 60 seconds.
- **SC-002**: A returning user can sign in and reach their data in under 15 seconds.
- **SC-003**: 100% of API calls without a valid token return 401 Unauthorized.
- **SC-004**: 100% of API calls with a valid token but missing scope return 403 Forbidden.
- **SC-005**: Data isolation is complete: two different users see zero overlap in items, tags, or collections (verified by cross-user test).
- **SC-006**: GET /api/v1/me returns user identity information within 500ms.
- **SC-007**: Setup documentation enables a developer unfamiliar with the project to configure External ID and run the app locally within 30 minutes.
- **SC-008**: All existing functionality remains operational after authentication is added (no regressions).
- **SC-009**: Application builds and all existing tests pass with authentication enabled.

## Clarifications

### Session 2026-01-24

- Q: How should the system handle pre-existing records without a userId? → A: Orphan existing data (inaccessible until manually migrated)
- Q: How should the SPA handle token refresh when access token expires? → A: Silent refresh in background (no user interaction unless refresh token expires)
- Q: What session/refresh token lifetime is acceptable? → A: 7 days (maximum convenience, standard consumer app)
- Q: Should authentication events be logged for security monitoring? → A: Log auth failures + sign-in/sign-out events only
- Q: How should automated tests authenticate to the API? → A: Allow auth bypass via test-only configuration in non-production

## Assumptions

- The organization has access to create a Microsoft Entra External ID tenant (Customers configuration).
- Microsoft Account is available as a social identity provider in the target region.
- The MSAL library for React supports the External ID authority URL format.
- The existing API endpoints (Items, Tags, Collections) are already implemented and follow a consistent pattern.
- MongoDB (or the current data store) supports adding a field to existing entities without data loss.
- Local development uses `localhost:5173` for the frontend and `localhost:5080` for the API.
