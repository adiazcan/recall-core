# Research: Web App Integration

**Feature**: 003-web-app-integration  
**Date**: 2026-01-22  
**Status**: Complete

## Overview

This document consolidates research findings for integrating the Figma-generated React UI (`/design`) with the backend Items/Tags/Collections API. All NEEDS CLARIFICATION items from Technical Context are resolved below.

---

## Research Topics

### 1. Migration Strategy: /design → /src/web

**Decision**: Merge `/design` components into `/src/web`, making it the primary web app

**Rationale**:
- `/design` contains a complete shadcn/ui component library (48 primitives) already styled with Tailwind
- Existing app structure (RecallContext, Sidebar, ItemList, ItemDetail) provides working UI foundation
- `/src/web` has React 19 + Vite 6 + existing build/test infrastructure
- Preserves design fidelity without reimplementation

**Alternatives Considered**:
- **Keep separate**: Would duplicate components and diverge from design over time
- **Start fresh in /src/web**: Discards significant UI work; slower to functional app

**Migration Steps**:
1. Copy `/design/src/app/components/ui/` → `/src/web/src/components/ui/`
2. Copy `/design/src/styles/` → `/src/web/src/styles/` (merge with existing)
3. Add missing dependencies from `/design/package.json` to `/src/web/package.json`
4. Adapt `/design` components to use feature-based architecture

---

### 2. State Management: Zustand vs Context

**Decision**: Use Zustand for global state with feature-scoped slices

**Rationale**:
- Constitution mandates Zustand for state management
- Current `/design` uses React Context (RecallContext) which works but doesn't scale
- Zustand offers: no providers needed, TypeScript-friendly, immer middleware for nested updates
- Enables selective subscription (atomic selectors) for performance

**Alternatives Considered**:
- **Keep React Context**: Already works in `/design`, but verbose and causes unnecessary re-renders
- **TanStack Query**: Great for server state but adds complexity; Zustand with manual fetch is simpler

**Store Structure**:
```typescript
// Global stores
stores/
├── ui-store.ts        // viewState, sidebar open, selected item
└── toast-store.ts     // toast notifications queue

// Feature stores
features/
├── items/store.ts     // items list, loading, error, CRUD actions
├── collections/store.ts // collections list, loading, error
└── tags/store.ts      // tags list, loading, error
```

---

### 3. API Client Architecture

**Decision**: Typed fetch wrapper with endpoint modules, using Vite proxy for CORS-free development

**Rationale**:
- Backend returns standard DTOs (ItemDto, CollectionDto, TagDto) - need type mapping
- Vite proxy avoids CORS configuration in development
- Base client handles: error mapping, abort controller, headers, timeout
- Per-entity modules provide typed CRUD functions

**Alternatives Considered**:
- **axios**: Adds dependency; native fetch is sufficient
- **TanStack Query**: More setup; manual fetch with Zustand is simpler for this scope
- **Direct fetch in components**: No reuse; error handling scattered

**Client Structure**:
```typescript
// lib/api/client.ts
export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T>

// lib/api/items.ts
export const itemsApi = {
  list: (params: ItemListParams) => apiRequest<ItemListResponse>('/api/v1/items', ...),
  get: (id: string) => apiRequest<ItemDto>(`/api/v1/items/${id}`),
  create: (data: CreateItemRequest) => apiRequest<ItemDto>('/api/v1/items', ...),
  update: (id: string, data: UpdateItemRequest) => apiRequest<ItemDto>(...),
  delete: (id: string) => apiRequest<void>(...),
}
```

---

### 4. Vite Proxy Configuration

**Decision**: Configure Vite dev server proxy to forward `/api` requests to backend

**Rationale**:
- Aspire AppHost runs API on port 5080 by default
- Proxy avoids CORS entirely in development
- Production deployment handles routing at infrastructure level
- Environment variable `VITE_API_BASE_URL` allows override

**Configuration**:
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:5080',
        changeOrigin: true,
      },
    },
  },
})
```

---

### 5. Entity Mapping: Backend DTO → Frontend ViewModel

**Decision**: Create mapping layer to transform API responses into UI-friendly models

**Rationale**:
- Backend `ItemDto.Status` is string ("unread"/"archived"), frontend needs `isArchived` boolean
- Backend uses `collectionId` string, frontend may enrich with collection name
- Domain extraction (URL → hostname) done client-side
- Decouples UI from API shape changes

**Mappings Required**:

| Backend (API)        | Frontend (ViewModel)   | Transform                          |
|----------------------|------------------------|------------------------------------|
| `ItemDto.status`     | `Item.isArchived`      | `status === 'archived'`            |
| `ItemDto.status`     | `Item.isRead`          | `status !== 'unread'`              |
| `ItemDto.url`        | `Item.domain`          | `new URL(url).hostname`            |
| `ItemDto.tags[]`     | `Item.tags[]`          | Tag names (backend stores names)   |
| `CollectionDto`      | `Collection`           | Direct mapping + computed fields   |
| `TagDto`             | `Tag`                  | Add display color client-side      |

---

### 6. Optimistic Updates Strategy

**Decision**: Optimistic updates for favorite/archive toggles with rollback on error

**Rationale**:
- Constitution requires "instant" feel for quick actions
- Favorite toggle and archive are low-risk operations (reversible)
- Rollback pattern: store previous state → apply optimistic → revert on failure

**Implementation Pattern**:
```typescript
// In items store
toggleFavorite: async (id: string) => {
  const prev = get().items.find(i => i.id === id);
  // Optimistic update
  set(state => {
    const item = state.items.find(i => i.id === id);
    if (item) item.isFavorite = !item.isFavorite;
  });
  try {
    await itemsApi.update(id, { isFavorite: !prev?.isFavorite });
  } catch (error) {
    // Rollback
    set(state => {
      const item = state.items.find(i => i.id === id);
      if (item) item.isFavorite = prev?.isFavorite ?? false;
    });
    toastStore.error('Failed to update favorite');
  }
}
```

---

### 7. Pagination Strategy

**Decision**: Cursor-based pagination with "load more" button (not infinite scroll)

**Rationale**:
- Backend API supports cursor-based pagination (`cursor`, `limit` params)
- "Load more" is simpler than infinite scroll; avoids scroll position issues
- Cursor invalidation on data change: refetch from beginning with notification

**Response Shape** (from backend):
```typescript
interface ItemListResponse {
  items: ItemDto[];
  nextCursor: string | null;
  hasMore: boolean;
}
```

---

### 8. Error Handling & User Feedback

**Decision**: Centralized error mapping + toast notifications for user feedback

**Rationale**:
- Consistent error messages improve UX
- Toast system for transient feedback (success, errors)
- Inline validation errors for forms (URL input)

**Error Mapping**:
```typescript
// lib/api/client.ts
function mapApiError(status: number, body: unknown): string {
  if (status === 404) return 'Item not found';
  if (status === 409) return 'This URL already exists';
  if (status === 400) return 'Invalid request. Please check your input.';
  if (status >= 500) return 'Server error. Please try again later.';
  return 'An unexpected error occurred';
}
```

---

### 9. Routing Strategy

**Decision**: React Router 7 with flat route structure (no nested data loaders)

**Rationale**:
- Simple SPA with single layout (sidebar + main content)
- Routes map to view states, not separate pages
- Item detail is a slide-over panel, not a route
- Zustand handles all data fetching (consistent with constitution)

**Routes**:
```typescript
// routes.tsx
const routes = [
  { path: '/', element: <Layout />, children: [
    { index: true, element: <Navigate to="/inbox" /> },
    { path: 'inbox', element: <ItemsView filter="inbox" /> },
    { path: 'favorites', element: <ItemsView filter="favorites" /> },
    { path: 'archive', element: <ItemsView filter="archive" /> },
    { path: 'collections/:id', element: <ItemsView filter="collection" /> },
    { path: 'tags/:name', element: <ItemsView filter="tag" /> },
  ]},
];
```

---

### 10. Dependencies to Add

**Decision**: Add minimal new dependencies; leverage existing from `/design`

**From /design (to copy)**:
- `zustand` + `immer` - state management (constitution requirement)
- `sonner` - toast notifications (already in /design)
- `lucide-react` - icons (already in /design)
- `motion` - animations (already in /design)
- `date-fns` - date formatting (already in /design)
- `clsx` + `tailwind-merge` - class utilities (already in /design)
- `class-variance-authority` - component variants (already in /design)
- Radix UI primitives - accessible components (already in /design)

**New dependencies**:
- `@playwright/test` - e2e testing (dev dependency)

**Not needed** (removing from /design):
- `@mui/material`, `@emotion/*` - not used in actual components
- `react-dnd` - out of scope
- `recharts` - out of scope
- Various unused Radix primitives

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Figma-generated code quality (deep nesting) | Wrap generated components with containers; minimize direct edits |
| API shape mismatch | DTO → ViewModel mapping layer in `lib/api/types.ts` |
| Cache consistency after tag/collection rename | Explicit invalidation rules; prefer refetch for complex ops |
| Proxy/CORS issues | Vite proxy default; `VITE_API_BASE_URL` for override |
| Bundle size growth | Tree-shake unused Radix; monitor with `vite-bundle-visualizer` |

---

## Decisions Summary

| Topic | Decision |
|-------|----------|
| Migration approach | Merge /design into /src/web |
| State management | Zustand with feature slices |
| API client | Typed fetch wrapper + Vite proxy |
| Entity mapping | DTO → ViewModel transformation |
| Optimistic updates | Favorite/archive with rollback |
| Pagination | Cursor-based with "load more" |
| Error handling | Centralized mapping + toasts |
| Routing | React Router 7, flat structure |
| Testing | Vitest (unit) + Playwright (e2e smoke) |

---

## Open Questions

None - all clarifications resolved.
