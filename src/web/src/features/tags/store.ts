import { create } from 'zustand';
import type { Tag } from '../../types/entities';
import { tagsApi } from '../../lib/api/tags';
import { mapTagDtoToTag } from '../../lib/api/types';

export interface TagsState {
  tags: Tag[];
  isLoading: boolean;
  error: string | null;
  fetchTags: () => Promise<void>;
  renameTag: (name: string, newName: string) => Promise<void>;
  deleteTag: (name: string) => Promise<void>;
}

export const useTagsStore = create<TagsState>((set, get) => ({
  tags: [],
  isLoading: false,
  error: null,
  fetchTags: async () => {
    const { isLoading } = get();
    // Prevent concurrent fetches
    if (isLoading) {
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      const response = await tagsApi.list();
      const tags = response.tags.map(mapTagDtoToTag);
      set({ tags, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch tags:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load tags',
        isLoading: false 
      });
    }
  },
  renameTag: async (name, newName) => {
    set({ error: null });
    try {
      await tagsApi.rename(name, { newName });
      // Re-fetch to update counts
      await get().fetchTags();
    } catch (error) {
      console.error('Failed to rename tag:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to rename tag' });
    }
  },
  deleteTag: async (name) => {
    set({ error: null });
    try {
      await tagsApi.delete(name);
      // Remove from local state
      set((state) => ({
        tags: state.tags.filter(t => t.name !== name)
      }));
    } catch (error) {
      console.error('Failed to delete tag:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to delete tag' });
    }
  },
}));
