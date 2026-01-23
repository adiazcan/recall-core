import { create } from 'zustand';
import { ApiError } from '../../lib/api/client';
import { itemsApi } from '../../lib/api/items';
import { mapItemDtoToItem, type UpdateItemRequest } from '../../lib/api/types';
import type { Item, ItemStatus } from '../../types/entities';
import type { ItemFilterParams } from '../../types/views';

export interface ItemsState {
  items: Item[];
  selectedItemId: string | null;
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

    // Optimistic update - create a properly typed updated item
    set((state) => ({
      items: state.items.map((i) => {
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
        if (data.collectionId !== undefined) updated.collectionId = data.collectionId;
        if (data.tags !== undefined && data.tags !== null) updated.tags = data.tags;

        return updated;
      }),
      error: null,
    }));

    try {
      await itemsApi.update(id, data);
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

    // Optimistically remove from UI
    set({
      items: items.filter((i) => i.id !== id),
      selectedItemId: wasSelected ? null : selectedItemId,
      error: null,
    });

    try {
      await itemsApi.delete(id);
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

    // Optimistic update
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, isFavorite: newFavoriteState } : i)),
    }));

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

    // Optimistic update
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, status: newStatus, isArchived: newStatus === 'archived' } : i,
      ),
    }));

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      await itemsApi.update(id, { status: newStatus });
      
      // Remove from list after successful archive (will be animated in UI)
      if (newStatus === 'archived') {
        timeoutId = setTimeout(() => {
          set((state) => ({
            items: state.items.filter((i) => i.id !== id),
          }));
        }, 300); // Wait for animation to complete
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
  selectItem: (id) => set({ selectedItemId: id }),
  clearError: () => set({ error: null }),
}));
