# Feature Specification: Repository Bootstrap

**Feature Branch**: `001-repo-bootstrap`  
**Created**: 2026-01-20  
**Status**: Draft  
**Input**: User description: "Bootstrap initial solution/repo structure for personal read-it-later knowledge vault app inspired by Pocket/Raindrop. No product features yet—minimal end-to-end smoke path only."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Runs Full Stack Locally (Priority: P1)

As a developer, I want to clone the repository and run the entire application stack locally with a single command so that I can start contributing immediately without manual configuration.

**Why this priority**: This is the foundation for all future development. Without a working local environment, no other work can proceed.

**Independent Test**: Can be fully tested by cloning the repo, running the start command, and observing both backend and frontend running together.

**Acceptance Scenarios**:

1. **Given** a fresh clone of the repository, **When** I follow the README instructions, **Then** the backend API starts and responds to requests within 60 seconds
2. **Given** a fresh clone of the repository, **When** I follow the README instructions, **Then** the frontend web application starts and is accessible in a browser
3. **Given** both services are running, **When** I access the web application, **Then** it successfully communicates with the backend API

---

### User Story 2 - Developer Verifies System Health (Priority: P1)

As a developer, I want to verify that the backend API is running and healthy so that I can confirm the system is operational before development.

**Why this priority**: Health verification is essential for debugging and ensures the minimal smoke path works end-to-end.

**Independent Test**: Can be fully tested by calling the health endpoint and verifying the response.

**Acceptance Scenarios**:

1. **Given** the backend API is running, **When** I call GET /health, **Then** I receive a 200 status with `{ "status": "ok" }`
2. **Given** the frontend is running, **When** I view the main page, **Then** I see the health status displayed from the backend

---

### User Story 3 - Developer Explores API Documentation (Priority: P2)

As a developer, I want to access interactive API documentation so that I can understand and test available endpoints without reading source code.

**Why this priority**: Swagger documentation accelerates onboarding and reduces friction for new contributors.

**Independent Test**: Can be fully tested by accessing the Swagger UI in a browser when running in development mode.

**Acceptance Scenarios**:

1. **Given** the backend API is running in development mode, **When** I navigate to the Swagger endpoint, **Then** I see interactive API documentation
2. **Given** the Swagger UI is displayed, **When** I expand the /health endpoint, **Then** I can see its description and try it out

---

### User Story 4 - CI Pipeline Validates Code Changes (Priority: P2)

As a developer, I want automated builds to run on every push so that I catch compilation errors and test failures early.

**Why this priority**: CI pipeline prevents broken code from being merged and establishes quality gates from day one.

**Independent Test**: Can be fully tested by pushing a commit and observing the GitHub Actions workflow execute.

**Acceptance Scenarios**:

1. **Given** a push to any branch, **When** the CI pipeline runs, **Then** the backend compiles successfully
2. **Given** a push to any branch, **When** the CI pipeline runs, **Then** the frontend builds successfully
3. **Given** a push to any branch, **When** the CI pipeline runs, **Then** all tests pass

---

### User Story 5 - Developer Maintains Code Quality (Priority: P3)

As a developer, I want consistent code formatting and linting enforced across the codebase so that code reviews focus on logic rather than style.

**Why this priority**: Establishing quality standards early prevents technical debt accumulation.

**Independent Test**: Can be fully tested by running the format/lint commands and verifying no violations.

**Acceptance Scenarios**:

1. **Given** the repository is cloned, **When** I run the backend formatting check, **Then** it completes without errors on the bootstrap code
2. **Given** the repository is cloned, **When** I run the frontend linting check, **Then** it completes without errors on the bootstrap code

---

### Edge Cases

- What happens when the backend is not running? Frontend should display a clear error message indicating the API is unavailable.
- What happens when running on a different port? Environment configuration should allow overriding default ports.
- What happens when prerequisites are missing? README should clearly list all prerequisites and the system should fail with informative errors.

## Requirements *(mandatory)*

### Functional Requirements

#### Repository Structure

- **FR-001**: Repository MUST have `src/Recall.Core.Api/`, `src/Recall.Core.AppHost/`, and `src/Recall.Core.ServiceDefaults/` directories for the backend projects
- **FR-002**: Repository MUST have `src/web/` directory containing the React frontend application
- **FR-003**: Repository MUST have `docs/` directory for project documentation

#### Backend API

- **FR-004**: Backend MUST expose a GET /health endpoint that returns HTTP 200 with `{ "status": "ok" }`
- **FR-005**: Backend MUST have Swagger/OpenAPI documentation enabled in Development environment
- **FR-006**: Backend MUST support environment-based configuration (development vs production settings)
- **FR-007**: Backend MUST include at least one placeholder test file demonstrating the test setup

#### Frontend Web Application

- **FR-008**: Frontend MUST render a page that calls the backend /health endpoint
- **FR-009**: Frontend MUST display the health check result to the user
- **FR-010**: Frontend MUST have a basic routing structure (even if only one route exists)

#### Developer Experience

- **FR-011**: Repository MUST include a README with prerequisites and step-by-step run instructions
- **FR-012**: Repository MUST include an .editorconfig file for consistent editor settings
- **FR-013**: Backend MUST have formatting configuration (dotnet format compatible)
- **FR-014**: Frontend MUST have ESLint configuration for code linting

#### CI/CD (Optional but Preferred)

- **FR-015**: Repository SHOULD include a GitHub Actions workflow that builds the backend
- **FR-016**: Repository SHOULD include a GitHub Actions workflow that builds the frontend
- **FR-017**: CI pipeline SHOULD run tests for both backend and frontend

### Assumptions

- Developers have .NET 10 SDK installed (per constitution technology stack)
- Developers have Node.js LTS installed for frontend development
- Developers have basic familiarity with terminal/command line
- Local development does not require Docker for this bootstrap phase
- No database, authentication, or external services are needed for this iteration
- Dapr sidecars are deferred to a future iteration; this bootstrap uses Aspire-only orchestration

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new developer can clone the repo and have both services running within 10 minutes following the README
- **SC-002**: The health endpoint responds with 200 OK in under 100ms
- **SC-003**: Frontend successfully displays backend health status without console errors
- **SC-004**: All code passes formatting and linting checks with zero violations
- **SC-005**: CI pipeline completes successfully (build + test) within 5 minutes
- **SC-006**: Swagger UI is accessible and displays the health endpoint documentation
