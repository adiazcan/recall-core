import { create } from 'zustand';
import type { Tag } from '../../types/entities';

export interface TagsState {
  tags: Tag[];
  isLoading: boolean;
  error: string | null;
  fetchTags: () => Promise<void>;
  renameTag: (name: string, newName: string) => Promise<void>;
  deleteTag: (name: string) => Promise<void>;
}

export const useTagsStore = create<TagsState>((set) => ({
  tags: [],
  isLoading: false,
  error: null,
  fetchTags: async () => {
    set({ isLoading: true, error: null });
    set({ isLoading: false });
  },
  renameTag: async (_name, _newName) => {
    set({ error: null });
  },
  deleteTag: async (_name) => {
    set({ error: null });
  },
}));
