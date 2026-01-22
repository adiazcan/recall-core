import { create } from 'zustand';
import { ApiError } from '../../lib/api/client';
import { itemsApi } from '../../lib/api/items';
import { mapItemDtoToItem, type UpdateItemRequest } from '../../lib/api/types';
import type { Item } from '../../types/entities';
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
  updateItem: async (_id, _data) => {
    set({ error: null });
  },
  deleteItem: async (_id) => {
    set({ error: null });
  },
  toggleFavorite: async (_id) => {
    set({ error: null });
  },
  toggleArchive: async (_id) => {
    set({ error: null });
  },
  selectItem: (id) => set({ selectedItemId: id }),
  clearError: () => set({ error: null }),
}));
