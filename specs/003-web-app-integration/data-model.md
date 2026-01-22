# Data Model: Web App Integration

**Feature**: 003-web-app-integration  
**Date**: 2026-01-22  
**Status**: Complete

## Overview

This document defines the frontend entity types, view models, and their relationships to backend DTOs for the Recall web application.

---

## Entities

### Item (Frontend ViewModel)

The primary entity representing a saved URL/bookmark.

```typescript
// src/types/entities.ts

export type ItemStatus = 'unread' | 'archived';

export interface Item {
  // Core identity
  id: string;
  url: string;
  normalizedUrl: string;
  
  // Display content
  title: string | null;
  excerpt: string | null;
  domain: string;           // Computed: extracted from URL
  imageUrl?: string;        // Future: thumbnail/OpenGraph image
  
  // Organization
  collectionId: string | null;
  tags: string[];           // Tag names (not IDs)
  
  // State
  status: ItemStatus;
  isFavorite: boolean;
  
  // Computed convenience booleans
  isArchived: boolean;      // Computed: status === 'archived'
  isRead: boolean;          // Computed: status !== 'unread'
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

**Mapping from `ItemDto`**:
```typescript
// lib/api/types.ts

export function mapItemDtoToItem(dto: ItemDto): Item {
  return {
    id: dto.id,
    url: dto.url,
    normalizedUrl: dto.normalizedUrl,
    title: dto.title,
    excerpt: dto.excerpt,
    domain: extractDomain(dto.url),
    collectionId: dto.collectionId,
    tags: dto.tags,
    status: dto.status as ItemStatus,
    isFavorite: dto.isFavorite,
    isArchived: dto.status === 'archived',
    isRead: dto.status !== 'unread',
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
```

**Validation Rules**:
- `url`: Required, must be valid http/https URL
- `title`: Optional, max 500 characters (if manually set)
- `tags`: Array of strings, each max 50 characters, max 20 tags per item
- `status`: One of 'unread' | 'archived'

---

### Collection (Frontend ViewModel)

Represents a folder-like container for organizing items.

```typescript
// src/types/entities.ts

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;    // For nested collections (future)
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

**Mapping from `CollectionDto`**:
```typescript
export function mapCollectionDtoToCollection(dto: CollectionDto): Collection {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    parentId: dto.parentId,
    itemCount: dto.itemCount,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}
```

**Validation Rules**:
- `name`: Required, 1-100 characters, unique per user
- `description`: Optional, max 500 characters

---

### Tag (Frontend ViewModel)

Represents a label that can be applied to multiple items.

```typescript
// src/types/entities.ts

export interface Tag {
  name: string;             // Primary identifier (no separate ID)
  count: number;            // Number of items with this tag
  color?: string;           // Display color (computed client-side)
}

// Tag colors for UI display (assigned deterministically by hash)
const TAG_COLORS = [
  'bg-orange-100 text-orange-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
  'bg-yellow-100 text-yellow-700',
  'bg-cyan-100 text-cyan-700',
  'bg-red-100 text-red-700',
] as const;
```

**Mapping from `TagDto`**:
```typescript
export function mapTagDtoToTag(dto: TagDto): Tag {
  return {
    name: dto.name,
    count: dto.count,
    color: getTagColor(dto.name),
  };
}

function getTagColor(name: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TAG_COLORS[hash % TAG_COLORS.length];
}
```

**Validation Rules**:
- `name`: Required, 1-50 characters, case-insensitive unique

---

## View State Types

### ViewState

Tracks the current navigation state in the UI.

```typescript
// src/types/views.ts

export type ViewType = 'inbox' | 'favorites' | 'archive' | 'collection' | 'tag';

export interface ViewState {
  type: ViewType;
  id?: string;              // Collection ID or Tag name if applicable
  title: string;            // Display title for the view
}

// Predefined views
export const DEFAULT_VIEWS: Record<string, ViewState> = {
  inbox: { type: 'inbox', title: 'Inbox' },
  favorites: { type: 'favorites', title: 'Favorites' },
  archive: { type: 'archive', title: 'Archive' },
};
```

---

### FilterParams

API filter parameters derived from ViewState.

```typescript
// src/types/views.ts

export interface ItemFilterParams {
  status?: 'unread' | 'archived';
  collectionId?: string;
  tag?: string;
  isFavorite?: boolean;
  cursor?: string;
  limit?: number;
}

export function viewStateToFilterParams(view: ViewState): ItemFilterParams {
  switch (view.type) {
    case 'inbox':
      return { status: 'unread' };
    case 'favorites':
      return { isFavorite: true };
    case 'archive':
      return { status: 'archived' };
    case 'collection':
      return { collectionId: view.id };
    case 'tag':
      return { tag: view.id };
    default:
      return {};
  }
}
```

---

## API Request/Response Types

### Items API

```typescript
// lib/api/types.ts

// Backend DTOs (matching OpenAPI spec)
export interface ItemDto {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string | null;
  excerpt: string | null;
  status: string;
  isFavorite: boolean;
  collectionId: string | null;
  tags: string[];
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
}

export interface ItemListResponse {
  items: ItemDto[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CreateItemRequest {
  url: string;
  title?: string;
  tags?: string[];
}

export interface UpdateItemRequest {
  title?: string;
  excerpt?: string;
  status?: 'unread' | 'archived';
  isFavorite?: boolean;
  collectionId?: string | null;
  tags?: string[];
}
```

### Collections API

```typescript
export interface CollectionDto {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionListResponse {
  collections: CollectionDto[];
}

export interface CreateCollectionRequest {
  name: string;
  description?: string;
  parentId?: string;
}

export interface UpdateCollectionRequest {
  name?: string;
  description?: string;
  parentId?: string | null;
}
```

### Tags API

```typescript
export interface TagDto {
  name: string;
  count: number;
}

export interface TagListResponse {
  tags: TagDto[];
}

export interface RenameTagRequest {
  newName: string;
}
```

---

## Store State Types

### Items Store

```typescript
// features/items/store.ts

export interface ItemsState {
  // Data
  items: Item[];
  selectedItemId: string | null;
  
  // Pagination
  nextCursor: string | null;
  hasMore: boolean;
  
  // Loading states
  isLoading: boolean;
  isLoadingMore: boolean;
  isSaving: boolean;
  
  // Error state
  error: string | null;
  
  // Actions
  fetchItems: (params: ItemFilterParams) => Promise<void>;
  fetchMore: () => Promise<void>;
  createItem: (url: string, tags?: string[]) => Promise<Item | null>;
  updateItem: (id: string, data: UpdateItemRequest) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  toggleArchive: (id: string) => Promise<void>;
  selectItem: (id: string | null) => void;
  clearError: () => void;
}
```

### Collections Store

```typescript
// features/collections/store.ts

export interface CollectionsState {
  collections: Collection[];
  isLoading: boolean;
  error: string | null;
  
  fetchCollections: () => Promise<void>;
  createCollection: (name: string, description?: string) => Promise<Collection | null>;
  updateCollection: (id: string, data: UpdateCollectionRequest) => Promise<void>;
  deleteCollection: (id: string, mode?: 'default' | 'cascade') => Promise<void>;
}
```

### Tags Store

```typescript
// features/tags/store.ts

export interface TagsState {
  tags: Tag[];
  isLoading: boolean;
  error: string | null;
  
  fetchTags: () => Promise<void>;
  renameTag: (name: string, newName: string) => Promise<void>;
  deleteTag: (name: string) => Promise<void>;
}
```

### UI Store

```typescript
// stores/ui-store.ts

export interface UIState {
  // Navigation
  viewState: ViewState;
  setViewState: (view: ViewState) => void;
  
  // Sidebar
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  
  // Modals
  isSaveUrlOpen: boolean;
  openSaveUrl: () => void;
  closeSaveUrl: () => void;
  
  isCreateCollectionOpen: boolean;
  openCreateCollection: () => void;
  closeCreateCollection: () => void;
}
```

### Toast Store

```typescript
// stores/toast-store.ts

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}
```

---

## Entity Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend State                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    has many    ┌──────────────┐           │
│  │  Collection  │◄───────────────│     Item     │           │
│  │              │  collectionId  │              │           │
│  └──────────────┘                └──────┬───────┘           │
│                                         │                    │
│                                   has many                   │
│                                         │                    │
│                                         ▼                    │
│                                  ┌──────────────┐           │
│                                  │     Tag      │           │
│                                  │  (by name)   │           │
│                                  └──────────────┘           │
│                                                              │
│  ┌──────────────┐    controls    ┌──────────────┐           │
│  │   UIState    │───────────────►│  ViewState   │           │
│  │              │                │              │           │
│  └──────────────┘                └──────────────┘           │
│                                         │                    │
│                                   filters                    │
│                                         ▼                    │
│                                  ┌──────────────┐           │
│                                  │ ItemsStore   │           │
│                                  │ (filtered)   │           │
│                                  └──────────────┘           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
User Action                     Store                    API
    │                             │                       │
    │ click "Save URL"            │                       │
    ├────────────────────────────►│                       │
    │                             │ POST /api/v1/items    │
    │                             ├──────────────────────►│
    │                             │                       │
    │                             │◄──────────────────────┤
    │                             │ ItemDto (201 or 200)  │
    │                             │                       │
    │                             │ map to Item           │
    │                             │ prepend to list       │
    │◄────────────────────────────┤ show toast            │
    │ UI updates                  │                       │
```

---

## Validation Summary

| Field | Rule | Error Message |
|-------|------|---------------|
| Item.url | Valid http/https URL | "Please enter a valid URL" |
| Item.title | Max 500 chars | "Title is too long" |
| Item.tags | Max 20 tags, each ≤50 chars | "Too many tags" / "Tag name too long" |
| Collection.name | 1-100 chars, required | "Collection name is required" |
| Tag.name | 1-50 chars, required | "Tag name is required" |

---

## State Transitions

### Item Status

```
                    ┌─────────────┐
    CREATE ────────►│   unread    │◄─────── UNARCHIVE
                    └──────┬──────┘
                           │
                      ARCHIVE
                           │
                           ▼
                    ┌─────────────┐
                    │  archived   │
                    └─────────────┘
                           │
                      DELETE
                           │
                           ▼
                       (removed)
```

### Favorite Toggle

```
                    ┌─────────────┐
    TOGGLE ────────►│ isFavorite  │◄─────── TOGGLE
   (false→true)     │   = true    │       (true→false)
                    └─────────────┘
```
