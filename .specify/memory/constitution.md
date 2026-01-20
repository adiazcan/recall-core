<!--
=============================================================================
SYNC IMPACT REPORT
=============================================================================
Version change: 1.3.0 → 1.3.1 (patch: added backend namespace convention)

Modified sections:
- Technical Standards: Added backend namespace convention (Recall.Core)

Templates requiring updates:
- ✅ plan-template.md (Constitution Check section aligns)
- ✅ spec-template.md (requirements/success criteria structure compatible)
- ✅ tasks-template.md (phase structure supports these principles)

Follow-up TODOs: None
=============================================================================
-->

# recall-core Constitution

**recall-core** is a personal bookmarking application (backend + web app) inspired by Pocket and Raindrop. This constitution defines the non-negotiable principles that ALL `/speckit.*` commands and implementation work MUST follow.

## Core Principles

### I. Product Focus

**Mission**: Fast save, clean reader view, powerful search—keep scope minimal.

- Features MUST directly support saving, reading, or finding bookmarks
- New feature proposals MUST justify necessity against existing functionality
- Scope creep MUST be rejected; prefer removing complexity over adding it
- Every UI element MUST serve a clear purpose; decorative elements are prohibited
- YAGNI applies strictly: do not build for hypothetical future requirements

### II. Privacy-First

**Mission**: All user data is private by default; no tracking, no leaks.

- All stored data MUST be accessible only to its owner; no public endpoints without explicit opt-in
- Stored HTML content MUST be sanitized before persistence to remove scripts, tracking pixels, and unsafe elements
- All user-facing output MUST be XSS-protected (escape HTML in templates, use CSP headers)
- No analytics, telemetry, or third-party tracking scripts are permitted
- External requests (fetching URLs) MUST NOT leak user information (strip cookies, use clean User-Agent)
- Secrets and credentials MUST never appear in logs or error messages

### III. Code Quality

**Mission**: Clear modular architecture, consistent naming, no hidden magic.

- Architecture MUST follow domain/application/infrastructure layering:
  - **Domain**: Pure business logic, entities, value objects—no framework dependencies
  - **Application**: Use cases, services, orchestration—depends only on domain
  - **Infrastructure**: Database, HTTP, external APIs—implements interfaces from domain/application
- Naming MUST be consistent: `snake_case` for Python/DB, `camelCase` for TypeScript/JavaScript
- No "magic" behavior: explicit configuration over convention, no hidden side effects
- Dependencies MUST flow inward: infrastructure → application → domain (never reverse)
- Each module MUST have a single responsibility; files exceeding 300 LOC SHOULD be split

### IV. Testing Discipline

**Mission**: Confidence through layered testing appropriate to each component.

- **Domain layer**: Unit tests MUST cover all business logic; aim for >90% branch coverage
- **Application layer**: Unit tests for services with mocked dependencies
- **Infrastructure layer**: Integration tests MUST verify API endpoints + database operations together
- **Web frontend**: Basic e2e smoke tests MUST verify critical user flows (save URL, view reader, search)
- Tests MUST be written before or alongside implementation; PRs without tests for new logic will be rejected
- Test names MUST describe behavior: `test_<action>_<condition>_<expected_result>`

### V. Performance

**Mission**: Saving a URL must be instant; heavy work runs asynchronously.

- **Save latency**: POST to save a URL MUST return <200ms p95 (acknowledgment only)
- **Async processing**: HTML fetching, parsing, content extraction MUST run in background jobs
- **Pagination**: All list endpoints MUST support pagination; default page size ≤50 items
- **Database queries**: N+1 queries are prohibited; use eager loading or batching
- **Frontend**: Initial page load (LCP) MUST be <2s on 3G; bundle size MUST stay <200KB gzipped
- Expensive operations MUST be profiled; add performance regression tests for critical paths

### VI. Reliability

**Mission**: Graceful handling of the unreliable external web.

- **Timeouts**: All external HTTP requests MUST have timeouts (default: 10s connect, 30s read); use Dapr resiliency policies
- **Retries**: Failed fetches MUST retry with exponential backoff (3 attempts max); configured via Dapr resiliency
- **Circuit breaker**: Repeated failures to a domain MUST trigger temporary skip via Dapr circuit breaker policies
- **Deduplication**: URLs MUST be normalized to canonical form before storage; duplicates rejected
- **Idempotency**: Save operations MUST be idempotent; re-saving same URL updates metadata only
- **Graceful degradation**: If parsing fails, store raw URL with error flag; never lose the bookmark

### VII. User Experience

**Mission**: Inbox-first UI that is accessible, keyboard-friendly, and minimal.

- **Default view**: Inbox (unread items) MUST be the landing page
- **Item states**: Every bookmark MUST support: unread → archived, favorite (toggle)
- **Keyboard navigation**: All primary actions MUST be accessible via keyboard shortcuts
- **Accessibility**: WCAG 2.1 AA compliance required; semantic HTML, ARIA labels, sufficient contrast
- **Responsive**: UI MUST work on mobile (320px) through desktop (1920px)
- **Loading states**: All async operations MUST show loading indicators; no empty flashes
- **Error feedback**: User-facing errors MUST be actionable; technical details logged, not displayed

### VIII. Observability

**Mission**: Understand system behavior through structured data, not guesswork.

- **OpenTelemetry**: All services MUST use OpenTelemetry SDK for logging, tracing, and metrics via Aspire service defaults
- **Structured logging**: All logs MUST be JSON-formatted with consistent fields: `timestamp`, `level`, `message`, `context`
- **Distributed tracing**: Every request MUST propagate trace context; Aspire Dashboard provides local trace visualization
- **Correlation IDs**: Every ingestion job MUST have a unique `correlation_id` propagated through all related logs
- **Request tracing**: HTTP requests MUST log: method, path, status, duration, user_id (if authenticated)
- **Metrics**: Track at minimum: request count, latency histograms, error rates, queue depths (exported via OTLP)
- **No sensitive data**: Logs MUST NOT contain passwords, tokens, or full URL contents
- **Health checks**: `/health` endpoint MUST verify database and queue connectivity; Aspire monitors resource health automatically

### IX. Development Workflow

**Mission**: No implementation without an approved spec; small PRs; clear Definition of Done.

- **Spec-first**: Implementation MUST NOT begin until a spec is approved via `/speckit.spec` → `/speckit.plan`
- **Small PRs**: Each PR SHOULD address a single task or logical unit; PRs >400 lines require justification
- **Definition of Done** for every PR:
  1. Code implements the spec requirements
  2. Tests pass (unit + integration as applicable)
  3. No new linting errors or warnings
  4. Documentation updated if public API changed
  5. Reviewed and approved by at least one other contributor
- **Branch naming**: `###-feature-name` where `###` is the issue/spec number
- **Commit messages**: Follow conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`

## Technical Standards

**Stack decisions** (for reference; change requires constitution amendment):

| Component         | Technology                     | Rationale                                |
|-------------------|--------------------------------|------------------------------------------|
| **Orchestration** | **Aspire 13 AppHost**          | Code-first dev orchestration, service discovery, built-in telemetry |
| **Microservices** | **Dapr 1.14+**                 | Service invocation, pub/sub, state, resiliency |
| Backend API       | C# / .NET 10 minimal API       | Async support, type safety, performance  |
| **Backend Namespace** | `Recall.Core`              | Root namespace for all backend projects  |
| Database          | MongoDB                        | Full-text search, flexible documents     |
| Cache/Queue       | Redis                          | Async ingestion, caching, simple queues  |
| Frontend          | TypeScript + React 19          | Type safety, component model, ecosystem  |
| State Management  | Zustand                        | Minimal boilerplate, no providers, TypeScript-friendly |
| Routing           | React Router 7                 | Declarative routing, nested layouts, loaders |
| Styling           | Tailwind CSS 4                 | Utility-first, minimal bundle, design tokens |
| Testing           | xUnit (backend), Vitest (frontend), Playwright (e2e) | Industry standards |
| Observability     | OpenTelemetry + Aspire Dashboard | Unified logs, traces, metrics           |

**API conventions**:

- RESTful resource naming: `/api/v1/bookmarks`, `/api/v1/bookmarks/{id}`
- Consistent error response: `{ "error": { "code": "...", "message": "..." } }`
- Pagination: `?page=1&per_page=20` with `Link` headers for navigation

**Frontend Architecture**:

```
web/
├── src/
│   ├── components/      # Reusable UI components (Button, Card, Modal)
│   ├── features/        # Feature modules (bookmarks/, reader/, search/)
│   │   └── bookmarks/
│   │       ├── components/   # Feature-specific components
│   │       ├── hooks/        # Feature-specific hooks
│   │       └── store.ts      # Zustand slice for this feature
│   ├── pages/           # Route components (mapped 1:1 to routes)
│   ├── stores/          # Global Zustand stores
│   ├── lib/             # Utilities, API client, helpers
│   └── routes.tsx       # React Router configuration
└── tests/
```

**Zustand conventions**:

- One store per feature domain (e.g., `bookmarksStore`, `uiStore`)
- Actions MUST be defined inside the store, not as separate functions
- Use `immer` middleware for complex nested state updates
- Selectors MUST be memoized; prefer atomic selectors over large object returns
- Async actions MUST handle loading/error states within the store

```typescript
// Example store pattern
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface BookmarksState {
  items: Bookmark[];
  isLoading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  archive: (id: string) => Promise<void>;
}

export const useBookmarksStore = create<BookmarksState>()(immer((set, get) => ({
  items: [],
  isLoading: false,
  error: null,
  fetch: async () => {
    set({ isLoading: true, error: null });
    // ... fetch logic
  },
  archive: async (id) => {
    set((state) => {
      const item = state.items.find(b => b.id === id);
      if (item) item.isArchived = true;
    });
  },
})));
```

**React Router conventions**:

- Routes defined in single `routes.tsx` file using `createBrowserRouter`
- Use loaders for data fetching where appropriate (prefer Zustand for complex state)
- Nested layouts for shared UI (e.g., sidebar, header)
- Protected routes via layout wrapper component
- Use `<Link>` for navigation; never `window.location`

**Tailwind CSS conventions**:

- Use design tokens via `tailwind.config.ts` for colors, spacing, typography
- Component variants via `class-variance-authority` (cva)
- No arbitrary values (`[]`) unless absolutely necessary; extend config instead
- Dark mode support via `class` strategy
- Responsive breakpoints: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px)

**Dapr Integration**:

Dapr provides portable, event-driven runtime building blocks for microservices:

| Building Block     | Usage in recall-core                              |
|--------------------|---------------------------------------------------|
| **Service Invocation** | API-to-worker communication with automatic retries |
| **Pub/Sub**        | Async ingestion events (URL saved → fetch → parse) |
| **State Management** | Distributed caching, session state (via Redis)   |
| **Bindings**       | Input triggers (e.g., scheduled cleanup jobs)    |
| **Resiliency**     | Timeouts, retries, circuit breakers (policy-based) |

**Dapr conventions**:

- Services MUST use Dapr SDK (`Dapr.AspNetCore`) for service-to-service calls
- Pub/Sub topics MUST follow naming: `{domain}.{event}` (e.g., `bookmarks.saved`, `ingestion.completed`)
- State store keys MUST be namespaced: `{service}:{entity}:{id}` (e.g., `api:bookmark:abc123`)
- All Dapr components defined in `dapr/components/` directory
- Resiliency policies defined in `dapr/config/resiliency.yaml`

```yaml
# Example: dapr/components/pubsub.yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: pubsub
spec:
  type: pubsub.redis
  version: v1
  metadata:
    - name: redisHost
      value: redis:6379
```

```yaml
# Example: dapr/config/resiliency.yaml
apiVersion: dapr.io/v1alpha1
kind: Resiliency
metadata:
  name: recall-resiliency
spec:
  policies:
    retries:
      ingestionRetry:
        policy: exponential
        maxRetries: 3
        maxInterval: 10s
    circuitBreakers:
      fetchCircuitBreaker:
        maxRequests: 1
        interval: 30s
        timeout: 60s
        trip: consecutiveFailures >= 3
  targets:
    apps:
      ingestion-worker:
        retry: ingestionRetry
        circuitBreaker: fetchCircuitBreaker
```

**Dapr + Aspire integration**:

```csharp
// AppHost with Dapr sidecars
var builder = DistributedApplication.CreateBuilder(args);

var mongo = builder.AddMongoDB("mongodb")
    .AddDatabase("recalldb")
    .WithDataVolume();

var redis = builder.AddRedis("redis")
    .WithDataVolume();

var api = builder.AddProject<Projects.RecallCore_Api>("api")
    .WithDaprSidecar()
    .WithReference(mongo)
    .WithReference(redis)
    .WaitFor(mongo);

var worker = builder.AddProject<Projects.RecallCore_Worker>("worker")
    .WithDaprSidecar()
    .WithReference(mongo)
    .WithReference(redis)
    .WaitFor(redis);

builder.AddViteApp("web", "../web")
    .WithReference(api)
    .WithHttpEndpoint(env: "PORT");

builder.Build().Run();
```

**Dapr requirements**:

- All backend services MUST run with Dapr sidecars (`.WithDaprSidecar()`)
- Service invocation MUST use Dapr app IDs, not direct HTTP URLs
- Pub/Sub MUST be used for async workflows; no direct queue access
- Resiliency policies MUST be defined for all external calls (fetch URLs, third-party APIs)
- Local development uses Dapr self-hosted mode via Aspire; production uses Kubernetes sidecar injection
- Dapr components MUST NOT contain secrets; use secret stores or environment injection

**Development Orchestration (Aspire AppHost)**:

The `.AppHost` project defines the distributed application architecture in code:

```csharp
// Example AppHost configuration
var builder = DistributedApplication.CreateBuilder(args);

var mongo = builder.AddMongoDB("mongodb")
    .AddDatabase("recalldb")
    .WithDataVolume();

var redis = builder.AddRedis("redis")
    .WithDataVolume();

var api = builder.AddProject<Projects.RecallCore_Api>("api")
    .WithReference(mongo)
    .WithReference(redis)
    .WaitFor(mongo);

builder.AddViteApp("web", "../web")
    .WithReference(api)
    .WithHttpEndpoint(env: "PORT");

builder.Build().Run();
```

**Aspire requirements**:

- All services MUST be declared in the AppHost with explicit `.WithReference()` dependencies
- Database and cache resources MUST use `.WithDataVolume()` for local persistence
- Services MUST use `.WaitFor()` to declare startup dependencies
- Service defaults project MUST configure OpenTelemetry exporters
- Local development MUST use `aspire run` or F5 debugging to launch the full stack
- Connection strings and endpoints are injected automatically—no hardcoded values

## Development Workflow

**Required flow for new features**:

```
1. /speckit.spec   → Define user stories, requirements, success criteria
2. /speckit.plan   → Research, architecture, Constitution Check
3. /speckit.tasks  → Break down into implementable tasks
4. Implement       → One task per PR, tests included
5. Review          → Verify against spec and constitution
6. Merge           → Squash merge to main
```

**Constitution Check gates** (must pass before implementation):

- [ ] Feature aligns with Product Focus (minimal scope)?
- [ ] Privacy requirements addressed (sanitization, no tracking)?
- [ ] Architecture follows domain/app/infra layers?
- [ ] Testing strategy defined for each layer?
- [ ] Performance budget established (<200ms save, pagination)?
- [ ] Reliability patterns included (timeouts, retries)?
- [ ] Accessibility requirements specified?
- [ ] Observability hooks planned (logs, correlation IDs)?

## Governance

**Authority**: This constitution supersedes all other development practices for recall-core. Conflicts between this document and external guidance MUST be resolved in favor of this constitution.

**Compliance**:

- All PRs MUST be verified against applicable principles before merge
- Reviewers MUST check Constitution Check gates in plan.md
- Violations MUST be documented and justified; repeated violations require constitution amendment

**Amendments**:

- Amendments require documented rationale and impact analysis
- Version increments follow semantic versioning:
  - MAJOR: Principle removal or incompatible redefinition
  - MINOR: New principle or material expansion
  - PATCH: Clarifications, wording improvements
- All amendments MUST update dependent templates (plan-template.md, spec-template.md, tasks-template.md)

**Guidance**: For runtime development guidance, refer to project README.md and `/specs/` documentation.

**Version**: 1.3.1 | **Ratified**: 2026-01-20 | **Last Amended**: 2026-01-20
