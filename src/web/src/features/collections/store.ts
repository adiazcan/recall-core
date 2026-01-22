import { create } from 'zustand';
import type { Collection } from '../../types/entities';
import type { UpdateCollectionRequest } from '../../lib/api/types';

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
    set({ isLoading: false });
  },
  createCollection: async (_name, _description) => {
    set({ error: null });
    return null;
  },
  updateCollection: async (_id, _data) => {
    set({ error: null });
  },
  deleteCollection: async (_id, _mode) => {
    set({ error: null });
  },
}));
