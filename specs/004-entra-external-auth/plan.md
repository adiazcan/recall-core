# Implementation Plan: Microsoft Entra External ID Authentication

**Branch**: `004-entra-external-auth` | **Date**: 2026-01-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-entra-external-auth/spec.md`

## Summary

Implement customer self-service registration and sign-in using Microsoft Entra External ID with social-only providers (Microsoft Account). The React SPA authenticates via MSAL and acquires delegated access tokens for the API. The .NET minimal API validates JWT Bearer tokens and enforces scope-based authorization (`access_as_user`). All user data (Items, Tags, Collections) is partitioned by `userId` derived from the `sub` claim, ensuring complete data isolation per user.

## Technical Context

**Language/Version**: C# / .NET 10, TypeScript ES2022  
**Primary Dependencies**:
- Backend: `Microsoft.Identity.Web` (JWT validation for External ID), `Microsoft.AspNetCore.Authentication.JwtBearer`
- Frontend: `@azure/msal-browser`, `@azure/msal-react`  
**Storage**: MongoDB (existing) - entities extended with `userId` field  
**Testing**: xUnit (backend), Vitest + React Testing Library (frontend), Playwright (e2e)  
**Target Platform**: Linux containers (backend), modern browsers (frontend)  
**Project Type**: Web application (backend + frontend)  
**Performance Goals**: Sign-in redirect <60s, returning sign-in <15s, GET /api/v1/me <500ms  
**Constraints**: No secrets in source control, CORS for localhost:5173, silent token refresh in background  
**Scale/Scope**: Single external tenant, social-only sign-up, ~10 protected endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| **Product Focus**: Feature aligns with minimal scope? | ✅ PASS | Authentication is foundational for multi-user support; required to enable per-user data isolation |
| **Privacy-First**: Sanitization, no tracking? | ✅ PASS | External ID handles auth; no third-party tracking; tokens stored client-side only; no secrets in logs |
| **Code Quality**: Domain/app/infra layers? | ✅ PASS | Auth middleware at infrastructure layer; user context injected into services |
| **Testing Strategy**: Defined for each layer? | ✅ PASS | Unit tests for auth helpers, integration tests for protected endpoints, test bypass for CI |
| **Performance Budget**: <200ms save, pagination? | ✅ PASS | Auth adds ~50ms token validation overhead; within budget |
| **Reliability Patterns**: Timeouts, retries? | ✅ PASS | MSAL handles token retry/refresh automatically; API uses standard JWT validation with clock tolerance |
| **Accessibility**: WCAG 2.1 AA? | ✅ PASS | External ID branded pages meet accessibility; SPA uses existing accessible components |
| **Observability**: Logs, correlation IDs? | ✅ PASS | FR-014a: Auth failures and sign-in/sign-out events logged via OpenTelemetry |

## Project Structure

### Documentation (this feature)

```text
specs/004-entra-external-auth/
├── plan.md              # This file
├── research.md          # Phase 0: Technology decisions and best practices
├── data-model.md        # Phase 1: Entity changes with userId field
├── quickstart.md        # Phase 1: Local setup guide
├── contracts/           # Phase 1: API contracts for /me endpoint
│   └── openapi.yaml     # Updated OpenAPI with auth and /me endpoint
└── tasks.md             # Phase 2: Implementation tasks (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── Recall.Core.Api/
│   ├── Program.cs                    # Add auth middleware, /me endpoint
│   ├── Entities/
│   │   ├── Item.cs                   # +userId field
│   │   └── Collection.cs             # +userId field
│   ├── Models/
│   │   └── UserInfoResponse.cs       # NEW: /me response model
│   ├── Endpoints/
│   │   ├── ItemsEndpoints.cs         # Inject userId, ownership checks
│   │   ├── CollectionsEndpoints.cs   # Inject userId, ownership checks
│   │   ├── TagsEndpoints.cs          # Inject userId, ownership checks
│   │   └── MeEndpoints.cs            # NEW: GET /api/v1/me
│   ├── Repositories/                 # Update queries with userId filter
│   └── Services/                     # Add userId parameter to all methods
└── web/
    └── src/
        ├── lib/
        │   ├── authConfig.ts         # NEW: MSAL configuration
        │   └── msalInstance.ts       # NEW: PublicClientApplication instance
        ├── components/
        │   ├── auth/
        │   │   ├── SignInButton.tsx  # NEW
        │   │   ├── SignOutButton.tsx # NEW
        │   │   └── AuthGuard.tsx     # NEW: Protected route wrapper
        │   └── layout/
        │       └── UserMenu.tsx      # NEW or modified: Show user info
        ├── hooks/
        │   └── useAuth.ts            # NEW: Custom auth hook
        └── App.tsx                   # Wrap with MsalProvider, protected routes

docs/
└── auth/
    ├── external-id-setup.md          # NEW: Tenant + user flow setup guide
    └── troubleshooting.md            # NEW: Common auth issues
```

**Structure Decision**: Web application with React frontend and .NET minimal API backend. Auth integrates at the API middleware level and the React router/provider level. No new projects required; changes extend existing structure.

## Complexity Tracking

> No Constitution Check violations requiring justification.

N/A - All gates pass without violations.

---

## Post-Design Constitution Re-evaluation

*Completed after Phase 1 design artifacts generated: 2026-01-24*

| Gate | Status | Design Verification |
|------|--------|---------------------|
| **Product Focus** | ✅ PASS | Design adds only what's needed: userId field, /me endpoint, MSAL integration |
| **Privacy-First** | ✅ PASS | No additional data collection; userId from standard `sub` claim; tokens ephemeral |
| **Code Quality** | ✅ PASS | Auth middleware at infrastructure layer; clean separation maintained |
| **Testing Strategy** | ✅ PASS | Test bypass via X-Test-UserId header; no external dependencies in unit tests |
| **Performance Budget** | ✅ PASS | JWT validation is local (no network call after initial JWKS fetch) |
| **Reliability Patterns** | ✅ PASS | MSAL handles token lifecycle; API uses standard JWT handler with retries |
| **Accessibility** | ✅ PASS | External ID provides accessible sign-in UI; no custom auth UI needed |
| **Observability** | ✅ PASS | research.md confirms logging strategy for auth events |

**Design Compliance Summary**: All design decisions align with constitution requirements. The implementation uses standard Microsoft libraries (Microsoft.Identity.Web, MSAL) which follow platform best practices. No custom auth protocol implementation required.
