# Implementation Plan: Web App Integration

**Branch**: `003-web-app-integration` | **Date**: 2026-01-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-web-app-integration/spec.md`

## Summary

Transform the Figma-generated React UI (`/design`) into a functional web application connected to the Items/Tags/Collections backend API from feature 002. The integration uses Zustand for state management, a typed API client layer with Vite proxy for CORS-free development, and preserves the existing shadcn/ui design system while replacing mock data with real API calls.

## Technical Context

**Language/Version**: TypeScript 5.7+ / React 19 / Vite 6  
**Primary Dependencies**: React Router 7.1, Zustand 5, shadcn/ui (Radix), Tailwind CSS 4, lucide-react, motion  
**Storage**: N/A (backend handles persistence via MongoDB)  
**Testing**: Vitest (unit/integration), Playwright (e2e smoke)  
**Target Platform**: Modern browsers (Chrome/Firefox/Safari/Edge latest 2 versions)  
**Project Type**: Web (frontend SPA consuming backend API)  
**Performance Goals**: <3s LCP on 3G, <200KB gzip bundle, <1s filter switch response  
**Constraints**: <200ms p95 for optimistic UI updates, keyboard accessible, WCAG 2.1 AA  
**Scale/Scope**: Single user, ~8 main views (inbox/favorites/archive/collection/tag/detail), 3 main entities (items, collections, tags)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| **Product Focus** (minimal scope) | ✅ PASS | Feature scope is strictly save/browse/organize items - core bookmarking functionality |
| **Privacy-First** (no tracking) | ✅ PASS | No analytics, no third-party scripts, all data via private API |
| **Code Quality** (layered architecture) | ✅ PASS | Frontend follows features/lib/stores pattern; API client layer separates data from UI |
| **Testing Discipline** | ✅ PASS | Vitest for units, Playwright for e2e smoke (create→list→detail→delete) |
| **Performance** | ✅ PASS | Optimistic updates for favorites/archive; pagination for lists; <200KB bundle target |
| **Reliability** (graceful degradation) | ✅ PASS | Loading/empty/error states for all async operations; retry on failure |
| **User Experience** (keyboard, a11y) | ✅ PASS | Keyboard navigation required; focus management for modals; ARIA labels |
| **Observability** | ✅ PASS | Frontend logs errors to console; correlation via request tracing headers |
| **Development Workflow** (spec-first) | ✅ PASS | Spec approved, plan in progress |

## Project Structure

### Documentation (this feature)

```text
specs/003-web-app-integration/
├── plan.md              # This file
├── research.md          # Phase 0 output - integration decisions
├── data-model.md        # Phase 1 output - frontend entities & view models
├── quickstart.md        # Phase 1 output - setup and run instructions
├── contracts/           # Phase 1 output - N/A (consuming existing OpenAPI from 002)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/web/
├── src/
│   ├── main.tsx                    # App entry point
│   ├── index.css                   # Global styles (Tailwind)
│   ├── routes.tsx                  # React Router configuration
│   ├── App.tsx                     # Root component with providers
│   ├── components/                 # Reusable UI components
│   │   ├── ui/                     # shadcn/ui primitives (from /design)
│   │   ├── layout/                 # Shell components (Sidebar, Header)
│   │   └── common/                 # Shared components (LoadingState, ErrorState)
│   ├── features/                   # Feature modules
│   │   ├── items/                  # Items feature
│   │   │   ├── components/         # ItemList, ItemRow, ItemDetail, SaveUrlForm
│   │   │   ├── hooks/              # useItems, useItem, useSaveItem
│   │   │   └── store.ts            # Zustand slice for items
│   │   ├── collections/            # Collections feature
│   │   │   ├── components/         # CollectionList, CreateCollectionDialog
│   │   │   ├── hooks/              # useCollections
│   │   │   └── store.ts            # Zustand slice for collections
│   │   └── tags/                   # Tags feature
│   │       ├── components/         # TagList, TagChip
│   │       ├── hooks/              # useTags
│   │       └── store.ts            # Zustand slice for tags
│   ├── lib/                        # Utilities and API client
│   │   ├── api/                    # API client layer
│   │   │   ├── client.ts           # Base fetch wrapper
│   │   │   ├── items.ts            # Items API endpoints
│   │   │   ├── collections.ts      # Collections API endpoints
│   │   │   ├── tags.ts             # Tags API endpoints
│   │   │   └── types.ts            # API request/response types
│   │   ├── utils.ts                # General utilities
│   │   └── constants.ts            # App constants
│   ├── stores/                     # Global Zustand stores
│   │   ├── ui-store.ts             # UI state (view, sidebar, modals)
│   │   └── toast-store.ts          # Toast notifications
│   └── types/                      # Shared TypeScript types
│       ├── entities.ts             # Frontend entity types
│       └── views.ts                # View state types
├── e2e/                            # Playwright tests
│   └── smoke.spec.ts               # Basic e2e smoke test
├── package.json
├── tsconfig.json
├── vite.config.ts                  # Vite config with API proxy
└── vitest.config.ts
```

**Structure Decision**: Web application following features-based architecture. Migrating `/design` components into `/src/web` preserving shadcn/ui primitives. API client in `lib/api/` with typed endpoints. Zustand stores per feature domain plus global UI store.

## Complexity Tracking

> No constitution violations identified. No justifications required.
