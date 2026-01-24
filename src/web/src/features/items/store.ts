import { create } from 'zustand';
import { ApiError } from '../../lib/api/client';
import { itemsApi } from '../../lib/api/items';
import { mapItemDtoToItem, type UpdateItemRequest } from '../../lib/api/types';
import type { Item, ItemStatus } from '../../types/entities';
import type { ItemFilterParams, ViewState } from '../../types/views';
import { useUiStore } from '../../stores/ui-store';
import { useCollectionsStore } from '../collections/store';
import { useTagsStore } from '../tags/store';

const refreshCollections = () => {
  void useCollectionsStore.getState().fetchCollections();
};

const refreshTags = () => {
  void useTagsStore.getState().fetchTags();
};

const normalizeTagList = (tags: string[]) => [...tags].sort().join('|');

const matchesViewState = (item: Item, viewState: ViewState): boolean => {
  switch (viewState.type) {
    case 'collection':
      return viewState.id ? item.collectionId === viewState.id : true;
    case 'tag':
      return viewState.id ? item.tags.includes(viewState.id) : true;
    case 'favorites':
      return item.isFavorite;
    case 'archive':
      return item.status === 'archived';
    case 'inbox':
      return item.status === 'unread';
    default:
      return true;
  }
};

export interface ItemsState {
  items: Item[];
  selectedItemId: string | null;
  selectedItemSnapshot: Item | null;
  nextCursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isSaving: boolean;
  error: string | null;
  fetchItems: (params: ItemFilterParams) => Promise<void>;
  fetchMore: () => Promise<void>;
  createItem: (url: string, tags?: string[]) => Promise<{ item: Item; created: boolean } | null>;
  updateItem: (id: string, data: UpdateItemRequest) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  toggleArchive: (id: string) => Promise<void>;
  selectItem: (id: string | null) => void;
  clearError: () => void;
}

export const useItemsStore = create<ItemsState>((set, get) => ({
  items: [],
  selectedItemId: null,
  selectedItemSnapshot: null,
  nextCursor: null,
  hasMore: false,
  isLoading: false,
  isLoadingMore: false,
  isSaving: false,
  error: null,
  fetchItems: async (params) => {
    set({ isLoading: true, error: null });

    try {
      const response = await itemsApi.list(params);
      const items = response.items.map(mapItemDtoToItem);

      set({
        items,
        nextCursor: response.nextCursor,
        hasMore: response.hasMore,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to load items.';
      set({ error: message, isLoading: false });
    }
  },
  fetchMore: async () => {
    const { nextCursor, hasMore, isLoadingMore } = get();

    if (!hasMore || isLoadingMore || !nextCursor) {
      return;
    }

    set({ isLoadingMore: true, error: null });

    try {
      const response = await itemsApi.list({ cursor: nextCursor });
      const newItems = response.items.map(mapItemDtoToItem);

      set((state) => ({
        items: [...state.items, ...newItems],
        nextCursor: response.nextCursor,
        hasMore: response.hasMore,
        isLoadingMore: false,
      }));
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to load more items.';
      set({ error: message, isLoadingMore: false });
    }
  },
  createItem: async (url, tags) => {
    set({ isSaving: true, error: null });

    try {
      const response = await itemsApi.create({
        url,
        tags: tags && tags.length > 0 ? tags : undefined,
      });
      const item = mapItemDtoToItem(response.item);

      set((state) => {
        const existingIndex = state.items.findIndex((entry) => entry.id === item.id);
        if (existingIndex >= 0) {
          const nextItems = [...state.items];
          nextItems[existingIndex] = item;
          return { items: nextItems };
        }

        return { items: [item, ...state.items] };
      });

      if (response.created && tags && tags.length > 0) {
        refreshTags();
      }
      return { item, created: response.created };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to save URL.';
      set({ error: message });
      throw error;
    } finally {
      set({ isSaving: false });
    }
  },
  updateItem: async (id, data) => {
    const { items } = get();
    const item = items.find((i) => i.id === id);
    if (!item) {
      set({ error: 'Item not found.' });
      return;
    }

    const previousItems = [...items];
    const previousCollectionId = item.collectionId;
    const previousTags = item.tags;
    const normalizedRequest: UpdateItemRequest =
      data.collectionId === null ? { ...data, collectionId: '' } : data;
    const nextCollectionId =
      data.collectionId === undefined ? previousCollectionId : data.collectionId === '' ? null : data.collectionId;
    const shouldRefreshCollections =
      data.collectionId !== undefined && nextCollectionId !== previousCollectionId;
    const shouldRefreshTags =
      data.tags !== undefined && normalizeTagList(data.tags) !== normalizeTagList(previousTags);
    const viewState = useUiStore.getState().viewState;
    const nextStatus = data.status ?? item.status;
    const nextFavorite = data.isFavorite ?? item.isFavorite;
    const nextTags = data.tags ?? item.tags;
    const shouldRemoveFromView = !matchesViewState(
      {
        ...item,
        collectionId: nextCollectionId,
        status: nextStatus,
        isArchived: nextStatus === 'archived',
        isFavorite: nextFavorite,
        tags: nextTags,
      },
      viewState,
    );

    // Optimistic update - create a properly typed updated item
    set((state) => {
      const nextItems = state.items.map((i) => {
        if (i.id !== id) return i;

        const updated: Item = { ...i };

        if (data.title !== undefined) updated.title = data.title;
        if (data.excerpt !== undefined) updated.excerpt = data.excerpt;
        if (data.status !== undefined && data.status !== null) {
          updated.status = data.status;
          updated.isArchived = data.status === 'archived';
        }
        if (data.isFavorite !== undefined && data.isFavorite !== null) {
          updated.isFavorite = data.isFavorite;
        }
        if (data.collectionId !== undefined) {
          updated.collectionId = data.collectionId === '' ? null : data.collectionId;
        }
        if (data.tags !== undefined && data.tags !== null) updated.tags = data.tags;

        return updated;
      });

      const updatedSnapshot =
        state.selectedItemId === id
          ? (nextItems.find((i) => i.id === id) ?? null)
          : state.selectedItemSnapshot;

      return {
        items: shouldRemoveFromView ? nextItems.filter((i) => i.id !== id) : nextItems,
        selectedItemSnapshot: updatedSnapshot,
        error: null,
      };
    });

    try {
      await itemsApi.update(id, normalizedRequest);
      if (shouldRefreshCollections) {
        refreshCollections();
      }
      if (shouldRefreshTags) {
        refreshTags();
      }
    } catch (error) {
      // Rollback on error
      set({ items: previousItems });
      const message = error instanceof ApiError ? error.message : 'Unable to update item.';
      set({ error: message });
      throw error;
    }
  },
  deleteItem: async (id) => {
    const { items, selectedItemId } = get();
    const previousItems = [...items];
    const wasSelected = selectedItemId === id;
    const target = items.find((i) => i.id === id);
    const hadCollection = Boolean(target?.collectionId);
    const hadTags = (target?.tags?.length ?? 0) > 0;

    // Optimistically remove from UI
    set({
      items: items.filter((i) => i.id !== id),
      selectedItemId: wasSelected ? null : selectedItemId,
      error: null,
    });

    try {
      await itemsApi.delete(id);
      if (hadCollection) {
        refreshCollections();
      }
      if (hadTags) {
        refreshTags();
      }
    } catch (error) {
      // Rollback on error
      set({ items: previousItems, selectedItemId: wasSelected ? id : selectedItemId });
      const message = error instanceof ApiError ? error.message : 'Unable to delete item.';
      set({ error: message });
      throw error;
    }
  },
  toggleFavorite: async (id) => {
    const { items } = get();
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const newFavoriteState = !item.isFavorite;
    const previousItems = [...items];
    const viewState = useUiStore.getState().viewState;
    const shouldRemoveFromView = !matchesViewState(
      {
        ...item,
        isFavorite: newFavoriteState,
      },
      viewState,
    );

    // Optimistic update
    set((state) => {
      const nextItems = state.items.map((i) =>
        i.id === id ? { ...i, isFavorite: newFavoriteState } : i,
      );
      const updatedSnapshot =
        state.selectedItemId === id
          ? (nextItems.find((i) => i.id === id) ?? null)
          : state.selectedItemSnapshot;

      return {
        items: shouldRemoveFromView ? nextItems.filter((i) => i.id !== id) : nextItems,
        selectedItemSnapshot: updatedSnapshot,
      };
    });

    try {
      await itemsApi.update(id, { isFavorite: newFavoriteState });
    } catch (error) {
      // Rollback on error
      set({ items: previousItems });
      const message = error instanceof ApiError ? error.message : 'Unable to update favorite status.';
      set({ error: message });
      throw error;
    }
  },
  toggleArchive: async (id) => {
    const { items } = get();
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const newStatus: ItemStatus = item.status === 'archived' ? 'unread' : 'archived';
    const previousItems = [...items];
    const viewState = useUiStore.getState().viewState;
    const shouldRemoveFromView = !matchesViewState(
      {
        ...item,
        status: newStatus,
        isArchived: newStatus === 'archived',
      },
      viewState,
    );

    // Optimistic update
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, status: newStatus, isArchived: newStatus === 'archived' } : i,
      ),
      selectedItemSnapshot:
        state.selectedItemId === id
          ? ({ ...item, status: newStatus, isArchived: newStatus === 'archived' } as Item)
          : state.selectedItemSnapshot,
    }));

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      await itemsApi.update(id, { status: newStatus });
      // Remove from list after successful archive/unarchive when it no longer matches view
      if (shouldRemoveFromView) {
        if (newStatus === 'archived') {
          timeoutId = setTimeout(() => {
            set((state) => ({
              items: state.items.filter((i) => i.id !== id),
            }));
          }, 300); // Wait for animation to complete
        } else {
          set((state) => ({
            items: state.items.filter((i) => i.id !== id),
          }));
        }
      }
    } catch (error) {
      // Cancel pending removal and rollback on error
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      set({ items: previousItems });
      const message = error instanceof ApiError ? error.message : 'Unable to update archive status.';
      set({ error: message });
      throw error;
    }
  },
  selectItem: (id) =>
    set((state) => ({
      selectedItemId: id,
      selectedItemSnapshot: id ? state.items.find((item) => item.id === id) ?? null : null,
    })),
  clearError: () => set({ error: null }),
}));
