# Quickstart: Web App Integration

**Feature**: 003-web-app-integration  
**Date**: 2026-01-22

## Prerequisites

- Node.js 20+ (LTS recommended)
- pnpm 9+ (or npm 10+)
- .NET 10 SDK (for backend)
- Docker Desktop (for MongoDB via Aspire)

## Quick Start (Full Stack)

The easiest way to run everything is via Aspire AppHost:

```bash
# From repo root
cd src/Recall.Core.AppHost
dotnet run
```

This starts:
- MongoDB (container)
- Backend API at http://localhost:5080
- Web app at http://localhost:5173 (or assigned port)

Open the Aspire Dashboard URL shown in terminal to monitor all services.

## Web App Only (Frontend Development)

If the backend is already running elsewhere:

```bash
cd src/web

# Install dependencies
pnpm install

# Start dev server (proxies /api to backend)
pnpm dev
```

The app will be available at http://localhost:5173

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:5080` | Backend API URL (for proxy target) |
| `PORT` | `5173` | Dev server port (set by Aspire when orchestrated) |

Create `.env.local` to override:
```env
VITE_API_BASE_URL=http://localhost:5080
```

## Available Scripts

```bash
# Development
pnpm dev          # Start dev server with HMR
pnpm build        # Build for production
pnpm preview      # Preview production build

# Testing
pnpm test         # Run unit tests (Vitest)
pnpm test:e2e     # Run e2e tests (Playwright)

# Code Quality
pnpm lint         # Run ESLint
pnpm format       # Check Prettier formatting
pnpm format:write # Fix formatting
pnpm typecheck    # TypeScript type checking
```

## Project Structure

```
src/web/
├── src/
│   ├── main.tsx           # App entry
│   ├── routes.tsx         # React Router config
│   ├── App.tsx            # Root component
│   ├── components/        # Reusable UI
│   │   ├── ui/            # shadcn/ui primitives
│   │   └── layout/        # Shell components
│   ├── features/          # Feature modules
│   │   ├── items/         # Items CRUD
│   │   ├── collections/   # Collections management
│   │   └── tags/          # Tags management
│   ├── lib/               # Utilities
│   │   └── api/           # API client
│   ├── stores/            # Global Zustand stores
│   └── types/             # TypeScript types
├── e2e/                   # Playwright tests
└── public/                # Static assets
```

## Troubleshooting

### "Failed to fetch" or Network Errors

1. Ensure backend is running:
   ```bash
   curl http://localhost:5080/health
   # Should return: {"status":"ok"}
   ```

2. Check Vite proxy config in `vite.config.ts`

3. If running outside Aspire, ensure `VITE_API_BASE_URL` is set

### Port Conflicts

If port 5173 is busy:
```bash
PORT=3000 pnpm dev
```

Or when using Aspire, it auto-assigns ports and sets `PORT` env var.

### MongoDB Connection Issues

When running via Aspire, MongoDB starts automatically. If you see connection errors:

1. Check Docker is running
2. Check Aspire Dashboard for MongoDB container status
3. Try restarting: `dotnet run` in AppHost directory

### TypeScript Errors After Pull

```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## API Testing

Quick manual test to verify backend connection:

```typescript
// In browser console or a test component
fetch('/api/v1/collections')
  .then(r => r.json())
  .then(console.log);
// Should return: { collections: [...] }
```

Or use curl:
```bash
# Health check
curl http://localhost:5080/health

# List collections
curl http://localhost:5080/api/v1/collections

# Create an item
curl -X POST http://localhost:5080/api/v1/items \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

## Development Workflow

1. **Start full stack** via Aspire (`dotnet run` in AppHost)
2. **Make UI changes** - Vite HMR updates instantly
3. **Run tests** - `pnpm test` for units, `pnpm test:e2e` for e2e
4. **Check types** - `pnpm typecheck`
5. **Build** - `pnpm build` to verify production bundle

## Key Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite config with API proxy |
| `routes.tsx` | All app routes |
| `lib/api/client.ts` | Base fetch wrapper |
| `features/items/store.ts` | Items Zustand store |
| `stores/ui-store.ts` | UI state (view, sidebar) |
| `components/ui/*` | shadcn/ui primitives |
