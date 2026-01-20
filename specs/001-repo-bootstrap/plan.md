# Implementation Plan: Repository Bootstrap

**Branch**: `001-repo-bootstrap` | **Date**: 2026-01-20 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-repo-bootstrap/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Bootstrap initial solution/repo structure for recall-core personal read-it-later knowledge vault. This iteration establishes minimal end-to-end smoke path: .NET 10 Minimal API backend with health endpoint, React/Vite frontend displaying health status, orchestrated via Aspire 13.1 AppHost with MongoDB persistence.

## Technical Context

**Language/Version**: C# / .NET 10.0, TypeScript 5.x  
**Primary Dependencies**: Aspire 13.1 AppHost SDK, Aspire.Hosting.MongoDB 13.1.0, Aspire.Hosting.JavaScript 13.1.0, React 19, Vite  
**Storage**: MongoDB (via Aspire container with data volume)  
**Testing**: xUnit (backend), Vitest (frontend)  
**Target Platform**: Linux/macOS/Windows (local dev), containerized deployment  
**Project Type**: web (frontend + backend with Aspire orchestration)  
**Performance Goals**: Health endpoint <100ms p95, frontend LCP <2s  
**Constraints**: Single command startup, no manual docker-compose, README-driven onboarding <10 min  
**Scale/Scope**: Bootstrap scope only—1 API endpoint, 1 frontend page, CI pipeline

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Feature aligns with Product Focus (minimal scope)? | ✅ PASS | Bootstrap only—no product features, minimal smoke path |
| Privacy requirements addressed (sanitization, no tracking)? | ✅ N/A | No user data in this iteration |
| Architecture follows domain/app/infra layers? | ✅ PASS | Will establish layered structure in src/backend |
| Testing strategy defined for each layer? | ✅ PASS | xUnit for backend, Vitest for frontend (FR-007, FR-017) |
| Performance budget established (<200ms save, pagination)? | ✅ PASS | Health endpoint <100ms (SC-002) |
| Reliability patterns included (timeouts, retries)? | ✅ N/A | No external calls in bootstrap scope |
| Accessibility requirements specified? | ✅ DEFERRED | Not in scope for minimal smoke path |
| Observability hooks planned (logs, correlation IDs)? | ✅ PASS | Aspire provides built-in telemetry and dashboard |

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── Recall.Core.AppHost/           # Aspire 13.1 orchestrator
│   ├── AppHost.cs                 # Resource definitions
│   ├── Recall.Core.AppHost.csproj # SDK="Aspire.AppHost.Sdk/13.1"
│   └── Properties/
│       └── launchSettings.json
├── Recall.Core.ServiceDefaults/   # Shared service configuration
│   └── Extensions.cs              # OpenTelemetry, health checks
├── Recall.Core.Api/               # .NET 10 Minimal API
│   ├── Program.cs                 # Health endpoint, Swagger
│   ├── Recall.Core.Api.csproj
│   └── Properties/
│       └── launchSettings.json
└── web/                           # React + Vite frontend
    ├── src/
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── components/
    │       └── HealthStatus.tsx
    ├── package.json
    ├── vite.config.ts
    └── tsconfig.json

src/tests/
├── Recall.Core.Api.Tests/         # Backend unit/integration tests
│   └── HealthEndpointTests.cs
└── web/                           # Frontend tests
    └── HealthStatus.test.tsx

.github/
└── workflows/
    └── ci.yml                     # Build + test pipeline
```

**Structure Decision**: Web application structure with Aspire AppHost orchestration. Backend uses `Recall.Core` namespace per constitution. Frontend in `src/web/` integrates via `AddViteApp()`. ServiceDefaults project provides shared OpenTelemetry configuration.

## Complexity Tracking

> **No Constitution Check violations.** All gates passed. No justification needed.

---

## Post-Design Constitution Re-check

*Re-evaluated after Phase 1 artifacts generated.*

| Gate | Status | Post-Design Notes |
|------|--------|-------------------|
| Feature aligns with Product Focus? | ✅ PASS | Confirmed: health endpoint only, no business logic |
| Privacy requirements addressed? | ✅ N/A | Confirmed: no user data collected or stored |
| Architecture follows layers? | ✅ PASS | Structure defined: AppHost → API → (future domain) |
| Testing strategy defined? | ✅ PASS | xUnit + Vitest confirmed in research.md |
| Performance budget established? | ✅ PASS | Health <100ms, LCP <2s documented |
| Reliability patterns included? | ✅ N/A | Confirmed: no external HTTP calls |
| Accessibility specified? | ✅ DEFERRED | Confirmed deferred to product feature phase |
| Observability hooks planned? | ✅ PASS | ServiceDefaults with OpenTelemetry configured |

**All gates passed. Ready for Phase 2 (/speckit.tasks).**
