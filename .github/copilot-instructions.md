# GitHub Copilot Instructions

## Priority Guidelines
When generating code for this repository:
1. **Version Compatibility**: Detect and respect exact language, framework, and library versions in the repo.
2. **Context Files**: Prioritize guidance in .github/copilot/* and .github/copilot-instructions.md.
3. **Codebase Patterns**: If guidance is missing, follow established patterns in existing files.
4. **Architectural Consistency**: Maintain the minimal API + Aspire AppHost + Vite/React separation observed in the repo.
5. **Code Quality**: Prioritize maintainability, performance, security, accessibility, and testability as reflected in current code and tests.

## Technology Version Detection
Use these sources to identify exact versions and constraints:
- .NET: TargetFramework net10.0 in project files under src/.
- Aspire: Aspire.Hosting.* 13.1.0 in AppHost project.
- OpenTelemetry: 1.10.0 packages in ServiceDefaults.
- Frontend: versions in src/web/package.json.
- TypeScript target: ES2022 in src/web/tsconfig.json.

Never use language/framework features beyond these versions.

## Context Files
If present, prioritize the following in .github/copilot/:
- architecture.md
- tech-stack.md
- coding-standards.md
- folder-structure.md
- exemplars.md

Also apply existing guidance in .github/copilot-instructions.md.

## Codebase Scanning Rules
When context files are insufficient:
1. Find similar files and follow their structure and style.
2. Match naming, organization, error handling, logging, documentation, and testing patterns.
3. Prefer the most consistent and most recently updated patterns.
4. Do not introduce new patterns or dependencies without precedent in the repo.

## Architecture & Project Structure
- Aspire AppHost orchestrates MongoDB, API, and Vite app (see src/Recall.Core.AppHost/AppHost.cs).
- Backend is .NET 10 minimal API with service defaults (OpenTelemetry, service discovery, health checks) in src/Recall.Core.ServiceDefaults/Extensions.cs.
- Frontend is React 19 + Vite 6 + Tailwind 4 using React Router in src/web/src/.
- Backend root namespace is Recall.Core.

## Backend (.NET) Guidelines
- Target framework: net10.0 (do not use newer APIs).
- Namespace root: Recall.Core.
- Minimal API endpoints are defined in Program.cs and use .WithTags(...) and .AddOpenApiOperationTransformer(...) for OpenAPI documentation.
- Development-only OpenAPI setup is configured in Program.cs; keep it consistent.
- CORS is configured to allow loopback origins only; follow existing policy.
- Use ServiceDefaults via AddServiceDefaults() for telemetry, health checks, and service discovery.
- Health endpoint contract: GET /health returns { status: "ok" }.

## Authentication & Authorization (.NET)
- Use Microsoft.Identity.Web for JWT Bearer validation with External ID tenants.
- Authority URL format: `https://<tenant-subdomain>.ciamlogin.com/<tenant-id>` (External ID specific).
- Configure AzureAd section in appsettings.json; never commit secrets.
- Define authorization policy "ApiScope" requiring `access_as_user` scope via `scp` claim.
- Apply `.RequireAuthorization("ApiScope")` to all protected endpoint groups.
- Use IUserContext interface (scoped) to extract userId from ClaimsPrincipal `sub` claim.
- All repository/service methods requiring user isolation must accept userId parameter.
- Return 404 (not 403) when resource exists but belongs to different user to avoid leaking existence.
- Test authentication bypass: use TestAuthHandler + X-Test-UserId header in non-production only.
- Log auth failures (401/403) via OpenTelemetry; never log tokens or secrets.

## Data Isolation Patterns
- Item and Collection entities have `UserId` property (string, BsonElement `userId`).
- Tags are embedded as `List<string>` in Item; no separate Tag entity.
- All queries must filter by `userId` first for efficient index usage.
- Planned compound indexes (to be created in `IndexInitializer.cs`): `{ userId: 1, normalizedUrl: 1 }` unique, `{ userId: 1, createdAt: -1, _id: -1 }`.
- Uniqueness constraints (normalizedUrl, collection name) are scoped per user.
- Pre-existing records without userId are orphaned (inaccessible until migrated).

## Frontend (React/TypeScript) Guidelines
- React 19 with React Router 7.1.1 (createBrowserRouter + RouterProvider).
- TypeScript target ES2022, module resolution Bundler, strict enabled.
- Use function components and hooks (useState/useEffect) like in HealthStatus.
- Use import.meta.env.VITE_API_BASE_URL with fallback http://localhost:5080 for API base URL.
- Tailwind CSS v4 classes are used directly in JSX; follow existing utility styling.

## Frontend Authentication (MSAL)
- Use @azure/msal-browser and @azure/msal-react for authentication.
- Authority URL: `https://<tenant>.ciamlogin.com` (External ID CIAM format).
- Scope for API access: `api://<api-client-id>/access_as_user`.
- Wrap App with MsalProvider in main.tsx; create PublicClientApplication instance.
- Create useAuth hook for token acquisition with acquireTokenSilent fallback to acquireTokenRedirect.
- AuthGuard component wraps protected routes; redirects unauthenticated users to sign-in.
- SignInButton uses loginRedirect; SignOutButton uses logoutRedirect.
- UserDisplay component shows authenticated user info from account claims.
- API client must attach `Authorization: Bearer <token>` header to all /api/v1 requests.
- Handle 401 responses by prompting user to sign in again.
- Handle 403 responses by showing permission/consent message.
- Silent token refresh runs in background; user interaction only when refresh token expires.
- Store MSAL config in .env.local: VITE_AUTHORITY, VITE_CLIENT_ID, VITE_API_SCOPE.

## Testing Guidelines
- Backend tests use xUnit with WebApplicationFactory<Program> and HttpClient.
- Frontend tests use Vitest and @testing-library/react.
- Follow existing naming patterns (e.g., GetHealth_ReturnsOkStatusAndPayload, describe/it blocks).
- Use vi.stubGlobal for mocking fetch in frontend tests.
- Test authentication bypass: set Authentication:TestMode to true and use X-Test-UserId header.
- Never use test bypass in production; enforce via configuration check.
- Test data isolation by verifying User A cannot access User B resources (expect 404).

## Error Handling & Logging
- Backend uses minimal APIs and OpenTelemetry logging configured in ServiceDefaults.
- Follow existing error handling patterns in API and frontend components.
- Do not log secrets or sensitive data.
- Log auth failures (401/403) via OpenTelemetry; never log tokens or secrets.

## Documentation Style
- Comments are minimal in code; prefer clear naming over extra commentary.
- Follow existing inline documentation patterns and avoid introducing verbose doc blocks.

## Versioning & Dependencies
- Frontend package versioning is currently 0.1.0 in src/web/package.json.
- Package versions in .csproj and package.json are exact references for compatibility.
- Do not introduce new dependencies unless necessary and consistent with existing stack.

## Project-Specific Constraints
- Keep API routes aligned with specs/001-repo-bootstrap/contracts/openapi.yaml.
- Maintain the /health contract for frontend and test compatibility.
- When adding services, update AppHost with references and wait-for dependencies.
- All protected endpoints require JWT Bearer token with `access_as_user` scope.
- Planned Phase 4 (US4): The /api/v1/me endpoint will return authenticated user info (sub, displayName, email, tenantId); do not assume it exists in current phases.

## General Best Practices
- Preserve existing code style and formatting.
- Keep functions focused and small, matching current patterns.
- Use explicit configuration consistent with existing files.
- Favor consistency with repo patterns over external best practices.
