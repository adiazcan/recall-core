````markdown
# Research: Repository Bootstrap

**Feature**: 001-repo-bootstrap
**Date**: 2026-01-20

This document captures technology decisions and research findings for the repository bootstrap phase.

## Research Tasks

### 1. Aspire 13.1 AppHost Configuration

**Task**: Determine best practices for .NET Aspire 13.1 AppHost configuration with MongoDB and Vite/React frontend.

**Sources**: 
- https://aspire.dev/get-started/first-app/\?lang\=csharp
- https://aspire.dev/app-host/configuration/
- https://aspire.dev/get-started/aspire-sdk/
- https://aspire.dev/integrations/databases/mongodb/

#### Prerequisites

| Requirement | Version |
|-------------|---------|
| .NET SDK | 10.0 (required for Aspire CLI) |
| Aspire CLI | 13.0.0+ |
| Aspire SDK | **13.1** (mandatory) |
| Container Runtime | Docker Desktop or Podman |

#### Aspire CLI Installation (Linux/macOS)

```bash
# Download and install Aspire CLI
curl -fsSL https://aspire.dev/install.sh | bash

# Verify installation
aspire --version
# Expected: 13.0.0+{commitSHA}
```

#### Project Structure with Aspire 13.1 SDK

The AppHost project **must** use the `Aspire.AppHost.Sdk/13.1` in the project file:

```xml
<!-- Recall.Core.AppHost.csproj -->
<Project Sdk="Aspire.AppHost.Sdk/13.1">
    <PropertyGroup>
        <OutputType>Exe</OutputType>
        <TargetFramework>net10.0</TargetFramework>
        <ImplicitUsings>enable</ImplicitUsings>
        <Nullable>enable</Nullable>
    </PropertyGroup>

    <ItemGroup>
        <PackageReference Include="Aspire.Hosting.AppHost" Version="13.1.0" />
        <PackageReference Include="Aspire.Hosting.MongoDB" Version="13.1.0" />
        <PackageReference Include="Aspire.Hosting.JavaScript" Version="13.1.0" />
    </ItemGroup>

    <ItemGroup>
        <ProjectReference Include="..\Recall.Core.Api\Recall.Core.Api.csproj" />
    </ItemGroup>
</Project>
```

#### AppHost Configuration Pattern

```csharp
// AppHost.cs
var builder = DistributedApplication.CreateBuilder(args);

// Add MongoDB with persistent container and data volume
var mongo = builder.AddMongoDB("mongo")
    .WithLifetime(ContainerLifetime.Persistent)
    .WithDataVolume();

var mongodb = mongo.AddDatabase("recalldb");

// Add backend API with MongoDB reference
var api = builder.AddProject<Projects.Recall_Core_Api>("api")
    .WithReference(mongodb)
    .WaitFor(mongodb)
    .WithHttpHealthCheck("/health");

// Add Vite frontend with API reference
builder.AddViteApp("frontend", "../frontend")
    .WithHttpEndpoint(env: "PORT")
    .WithReference(api)
    .WaitFor(api);

builder.Build().Run();
```

#### Key Configuration Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ASPNETCORE_URLS` | Auto-generated | Dashboard address (must be HTTPS unless `ASPIRE_ALLOW_UNSECURED_TRANSPORT=true`) |
| `ASPIRE_DASHBOARD_OTLP_ENDPOINT_URL` | Auto-generated | OTLP telemetry endpoint |
| `ASPIRE_RESOURCE_SERVICE_ENDPOINT_URL` | Auto-generated | Resource service for dashboard |
| `ASPIRE_CONTAINER_RUNTIME` | `docker` | Container runtime (`docker` or `podman`) |
| `ASPIRE_DASHBOARD_FRONTEND_BROWSERTOKEN` | Auto-generated | Auth token for dashboard access |
| `ASPIRE_DASHBOARD_RESOURCESERVICE_APIKEY` | Auto-generated | API key for resource service auth |

#### Launch Settings Configuration

```json
{
  "$schema": "https://json.schemastore.org/launchsettings.json",
  "profiles": {
    "https": {
      "commandName": "Project",
      "dotnetRunMessages": true,
      "launchBrowser": true,
      "applicationUrl": "https://localhost:17134;http://localhost:15170",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development",
        "DOTNET_ENVIRONMENT": "Development",
        "ASPIRE_DASHBOARD_OTLP_ENDPOINT_URL": "https://localhost:21030",
        "ASPIRE_RESOURCE_SERVICE_ENDPOINT_URL": "https://localhost:22057"
      }
    }
  }
}
```

#### MongoDB Integration Details (Aspire 13.1)

The `Aspire.Hosting.MongoDB` package (version 13.1.0) provides:

**Server Resource Configuration:**
```csharp
var mongo = builder.AddMongoDB("mongo")
    .WithLifetime(ContainerLifetime.Persistent)  // Avoid slow restarts
    .WithDataVolume();                           // Persist data across restarts
```

**Default Credentials:**
- `MONGO_INITDB_ROOT_USERNAME`: `admin`
- `MONGO_INITDB_ROOT_PASSWORD`: Auto-generated, stored in AppHost secrets

**Connection Properties Exposed:**
| Property | Description |
|----------|-------------|
| `Host` | MongoDB server hostname |
| `Port` | Listening port |
| `Username` | Auth username |
| `Password` | Auth password |
| `Uri` | Full connection URI |
| `DatabaseName` | Database name (for database resources) |

**Client Integration:**
```csharp
// In consuming project - add package Aspire.MongoDB.Driver v13.1.0
builder.AddMongoDBClient("mongodb");

// Inject IMongoClient or IMongoDatabase
public class MyService(IMongoDatabase database) { }
```

#### Running the AppHost

```bash
# Using Aspire CLI (recommended)
aspire run

# Or using dotnet directly
dotnet run --project src/Recall.Core.AppHost

# Output includes dashboard URL with auth token:
# Dashboard: https://localhost:17068/login\?t\=ea559845d54cea66b837dc0ff33c3bd3
```

**Decision**: Use Aspire 13.1 SDK with built-in resource builders
- `AddMongoDB()` for container-based MongoDB with data volume persistence
- `AddViteApp()` for Vite frontend integration (from `Aspire.Hosting.JavaScript`)
- `AddProject<T>()` for .NET projects with automatic service discovery

**Rationale**:
- Aspire 13.1 is the required minimum version with full MongoDB and JavaScript framework support
- Built-in health checks, telemetry, and dashboard integration
- Connection strings injected automatically via environment variables
- Persistent containers avoid slow restarts during development
- No need for manual docker-compose for local dev

**Alternatives Considered**:
- docker-compose.yml: Rejected - Aspire provides superior DX with dashboard, health checks, and telemetry
- Manual process management: Rejected - error-prone and lacks observability
- Aspire 13.0 or lower: **Rejected - 13.1 is mandatory per requirements**

---

### 2. Frontend-to-Backend Communication

**Task**: Decide between Vite dev proxy vs CORS for local development API calls.

**Decision**: Direct fetch with CORS enabled on backend

**Rationale**:
- Simpler configuration - no proxy middleware needed
- Matches production behavior where frontend/backend are separate origins
- CORS is already required for production; this validates the setup early
- Easier debugging - no request transformation in dev tools

**Alternatives Considered**:
- Vite proxy (`/api` -> backend): Rejected for this scope - adds configuration complexity without significant benefit for a health check
- Same-origin deployment: Rejected - doesn't reflect intended architecture

**Implementation**:
```csharp
// Backend CORS configuration
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});
```

---

### 3. .NET 10 Minimal API Structure

**Task**: Determine minimal API patterns for health endpoint and Swagger setup.

**Decision**: Use endpoint groups with Swagger conditional on environment

**Rationale**:
- Minimal API provides cleaner code than controllers for simple endpoints
- Swagger only in Development prevents API exposure in production
- Follows ASP.NET Core conventions

**Implementation Pattern**:
```csharp
var builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen();
}

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
   .WithName("GetHealth")
   .WithOpenApi();

app.Run();
```

---

### 4. React 19 + React Router 7 Setup

**Task**: Determine routing configuration for single-page app with health check UI.

**Decision**: Use `createBrowserRouter` with layout-based routing

**Rationale**:
- React Router 7 is the current stable version per constitution
- `createBrowserRouter` enables future data loading patterns
- Layout routes allow shared UI (header/nav) as app grows

**Implementation Pattern**:
```typescript
// routes.tsx
import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from './pages/RootLayout';
import { HomePage } from './pages/HomePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
    ],
  },
]);
```

---

### 5. Tailwind CSS 4 Configuration

**Task**: Determine Tailwind CSS 4 setup with Vite.

**Decision**: Use Tailwind CSS 4 with `@tailwindcss/vite` plugin

**Rationale**:
- Tailwind CSS 4 uses new Rust-based engine (Lightning CSS)
- Vite plugin provides automatic content detection
- Zero-config for standard React projects

**Implementation**:
```typescript
// vite.config.ts
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

```css
/* src/index.css */
@import "tailwindcss";
```

---

### 6. Testing Framework Setup

**Task**: Determine test framework configuration for backend and frontend.

**Decision**: 
- Backend: xUnit with `Microsoft.AspNetCore.Mvc.Testing` for integration tests
- Frontend: Vitest with React Testing Library

**Rationale**:
- xUnit is the constitution-specified testing framework
- `WebApplicationFactory` enables real HTTP testing without full deployment
- Vitest provides fast, ESM-native testing aligned with Vite

**Backend Test Pattern**:
```csharp
public class HealthEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public HealthEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetHealth_ReturnsOk()
    {
        var response = await _client.GetAsync("/health");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
```

---

### 7. Service Defaults Project

**Task**: Determine Aspire service defaults configuration.

**Decision**: Create `Recall.Core.ServiceDefaults` project with OpenTelemetry and health check extensions

**Rationale**:
- Centralizes observability configuration per Aspire conventions
- Enables consistent telemetry across all .NET services
- Provides `AddServiceDefaults()` extension for easy opt-in

**Key Extensions**:
- OpenTelemetry logging, tracing, metrics
- Health check endpoints
- Service discovery configuration

**Service Defaults Project (Aspire 13.1)**:
```xml
<!-- Recall.Core.ServiceDefaults.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
    <PropertyGroup>
        <TargetFramework>net10.0</TargetFramework>
        <ImplicitUsings>enable</ImplicitUsings>
        <Nullable>enable</Nullable>
        <IsAspireSharedProject>true</IsAspireSharedProject>
    </PropertyGroup>

    <ItemGroup>
        <FrameworkReference Include="Microsoft.AspNetCore.App" />
        <PackageReference Include="Microsoft.Extensions.Http.Resilience" Version="10.0.0" />
        <PackageReference Include="Microsoft.Extensions.ServiceDiscovery" Version="13.1.0" />
        <PackageReference Include="OpenTelemetry.Exporter.OpenTelemetryProtocol" Version="1.10.0" />
        <PackageReference Include="OpenTelemetry.Extensions.Hosting" Version="1.10.0" />
        <PackageReference Include="OpenTelemetry.Instrumentation.AspNetCore" Version="1.10.0" />
        <PackageReference Include="OpenTelemetry.Instrumentation.Http" Version="1.10.0" />
        <PackageReference Include="OpenTelemetry.Instrumentation.Runtime" Version="1.10.0" />
    </ItemGroup>
</Project>
```

---

### 8. Port Configuration

**Task**: Confirm port assignments for local development.

**Decision**:
- Backend HTTP: `http://localhost:5080`
- Backend HTTPS: `https://localhost:7080` (optional, disabled by default)
- Frontend: `http://localhost:5173` (Vite default)
- MongoDB: `27017` (container internal, mapped by Aspire)
- Aspire Dashboard: Auto-assigned (typically 17xxx range)

**Rationale**:
- Non-conflicting with common development ports
- Vite default port reduces configuration
- HTTPS optional for local dev (Aspire handles service-to-service)

---

## Resolved Clarifications

All NEEDS CLARIFICATION items from Technical Context have been resolved:

| Item | Resolution |
|------|------------|
| Aspire version | **13.1 (mandatory)** |
| Frontend-backend communication | CORS with direct fetch |
| Aspire frontend integration | `AddViteApp()` for Vite (from `Aspire.Hosting.JavaScript`) |
| MongoDB connection | Aspire-injected connection string via `WithReference()` |
| Test framework setup | xUnit + Vitest |
| Port assignments | 5080/5173/27017 |

## Open Questions (None)

All technical decisions for bootstrap phase are resolved. No blockers for Phase 1.

````
