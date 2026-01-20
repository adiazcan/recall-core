# recall-core

Bootstrap the Recall Core stack locally with Aspire.

## Prerequisites

- .NET SDK 10.0+
- Node.js 22 LTS+
- Docker 24.0+ (running)

## Quick Start

1. Restore dependencies:
    - .NET: `dotnet restore`
    - Web: `cd src/web && npm install`
2. Run the full stack:
    - `dotnet run --project src/Recall.Core.AppHost`

The Aspire dashboard will open and list:

- API: http://localhost:5080
- Web: http://localhost:5173

## Health Check

`curl http://localhost:5080/health`

Expected response:

`{"status":"ok"}`

## Swagger UI

Swagger is available in development mode at:

`http://localhost:5080/swagger`

OpenAPI JSON is served at:

`http://localhost:5080/openapi/v1.json`

## Development Notes

- Frontend source lives in `src/web`
- Backend API lives in `src/Recall.Core.Api`
- Orchestration is handled by Aspire in `src/Recall.Core.AppHost`
