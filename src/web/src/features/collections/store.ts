import { create } from 'zustand';
import { ApiError } from '../../lib/api/client';
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

export const useCollectionsStore = create<CollectionsState>((set, get) => ({
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
  updateCollection: async (id, data) => {
    const { collections } = get();
    const target = collections.find((collection) => collection.id === id);
    if (!target) {
      set({ error: 'Collection not found.' });
      return;
    }

    const previousCollections = [...collections];

    set((state) => ({
      collections: state.collections.map((collection) => {
        if (collection.id !== id) return collection;

        return {
          ...collection,
          name: data.name ?? collection.name,
          description: data.description ?? collection.description,
          parentId: data.parentId ?? collection.parentId,
        };
      }),
      error: null,
    }));

    try {
      const dto = await collectionsApi.update(id, data);
      const updatedCollection = mapCollectionDtoToCollection(dto);
      set((state) => ({
        collections: state.collections.map((collection) =>
          collection.id === id ? updatedCollection : collection,
        ),
      }));
    } catch (error) {
      set({ collections: previousCollections });
      const message = error instanceof ApiError ? error.message : 'Failed to update collection.';
      set({ error: message });
      throw error;
    }
  },
  deleteCollection: async (id, mode) => {
    const { collections } = get();
    const previousCollections = [...collections];

    set({
      collections: collections.filter((collection) => collection.id !== id),
      error: null,
    });

    try {
      await collectionsApi.delete(id, mode);
    } catch (error) {
      set({ collections: previousCollections });
      const message = error instanceof ApiError ? error.message : 'Failed to delete collection.';
      set({ error: message });
      throw error;
    }
  },
}));
