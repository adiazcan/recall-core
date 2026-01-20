# Quickstart: recall-core Development Environment

Get the full stack running locally in under 10 minutes.

## Prerequisites

Ensure the following are installed:

| Tool | Version | Verify Command |
|------|---------|----------------|
| .NET SDK | 10.0+ | `dotnet --version` |
| Node.js | 22 LTS | `node --version` |
| Docker | 24.0+ | `docker --version` |

> **Note**: Docker Desktop must be running for MongoDB container.

## Quick Start (Recommended)

Run the entire stack with Aspire:

```bash
# Clone and navigate to repo
git clone <repo-url>
cd recall-core

# Restore dependencies
dotnet restore
cd src/web && npm install && cd ../..

# Start everything
dotnet run --project src/Recall.Core.AppHost
```

The Aspire Dashboard will open automatically, showing:
- **api**: Backend API at http://localhost:5080
- **web**: Frontend at http://localhost:5173
- **mongodb**: MongoDB container

## Manual Start (Alternative)

If you prefer to run services individually:

### 1. Start MongoDB

```bash
docker run -d --name recall-mongo -p 27017:27017 mongo:7
```

### 2. Start Backend

```bash
cd src/Recall.Core.Api
dotnet run
```

Backend available at: http://localhost:5080

### 3. Start Frontend

```bash
cd src/web
npm install
npm run dev
```

Frontend available at: http://localhost:5173

## Verify Setup

### Health Check (Backend)

```bash
curl http://localhost:5080/health
# Expected: {"status":"ok"}
```

### Swagger UI (Development only)

Open in browser: http://localhost:5080/swagger

### Frontend Health Display

Open in browser: http://localhost:5173

You should see the health status displayed on the page.

## Common Commands

### Backend

```bash
# Build
dotnet build

# Run tests
dotnet test

```

### Frontend

```bash
cd src/web

# Development server
npm run dev

# Production build
npm run build

# Lint check
npm run lint

# Lint fix
npm run lint -- --fix

# Run tests
npm run test
```

### Full Stack

```bash
# Build everything
dotnet build src/RecallCore.sln
cd src/web && npm run build && cd ../..

# Test everything
dotnet test
cd src/web && npm run test && cd ../..
```

## Troubleshooting

### Port already in use

If port 5080 or 5173 is in use:

```bash
# Find process using port
lsof -i :5080

# Kill process (use PID from above)
kill -9 <PID>
```

### Docker not running

Aspire requires Docker for MongoDB. Start Docker Desktop or:

```bash
# Linux
sudo systemctl start docker
```

### CORS errors in browser

Ensure backend is running on http://localhost:5080. The frontend expects this exact origin for CORS.

### MongoDB connection failed

Check Docker container is running:

```bash
docker ps | grep mongo
```

If not listed, start manually or restart Aspire.

## IDE Setup

### VS Code

Recommended extensions:
- C# Dev Kit
- ESLint
- Tailwind CSS IntelliSense
- Prettier

### Visual Studio 2022

Open `src/RecallCore.sln` and set `Recall.Core.AppHost` as startup project.

### JetBrains Rider

Open solution, configure compound run configuration for AppHost.

## Next Steps

Once the environment is running:

1. Explore the Aspire Dashboard for telemetry
2. Review API documentation at `/swagger`
3. Check constitution.md for development guidelines
4. Read the feature spec for implementation details
