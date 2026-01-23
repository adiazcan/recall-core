import { create } from 'zustand';
import type { Collection } from '../../types/entities';
import type { UpdateCollectionRequest } from '../../lib/api/types';
import { collectionsApi } from '../../lib/api/collections';
import { mapCollectionDtoToCollection } from '../../lib/api/types';

export interface CollectionsState {
  collections: Collection[];
  isLoading: boolean;
  error: string | null;
  fetchCollections: () => Promise<void>;
  createCollection: (name: string, description?: string) => Promise<Collection | null>;
  updateCollection: (id: string, data: UpdateCollectionRequest) => Promise<void>;
  deleteCollection: (id: string, mode?: 'default' | 'cascade') => Promise<void>;
}

export const useCollectionsStore = create<CollectionsState>((set) => ({
  collections: [],
  isLoading: false,
  error: null,
  fetchCollections: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await collectionsApi.list();
      const collections = response.collections.map(mapCollectionDtoToCollection);
      set({ collections, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load collections', isLoading: false });
    }
  },
  createCollection: async (name, description) => {
    set({ error: null });
    try {
      const dto = await collectionsApi.create({ name, description: description || null });
      const newCollection = mapCollectionDtoToCollection(dto);
      set((state) => ({ collections: [...state.collections, newCollection] }));
      return newCollection;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create collection' });
      return null;
    }
  },
  updateCollection: async (_id, _data) => {
    set({ error: null });
  },
  deleteCollection: async (_id, _mode) => {
    set({ error: null });
  },
}));
